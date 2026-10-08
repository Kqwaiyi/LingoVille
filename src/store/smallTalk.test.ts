import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { describe, expect, it } from 'vitest';
import {
  LEARN_NAME_TOOL,
  REVEAL_FAVOURITE_TOOL,
  WRAP_UP_SCENE,
  type NpcSession,
  type Recap,
  type RecapRequest,
  type ToolResponse,
} from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS, placeHours, type ItemId, type TownNpcId } from '../content/index.ts';
import { createSave, FAMILIARITY, memoryOf, MOOD, rollOnTheHouse, type GameState, type NpcMemory } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  createJournal,
  DEV_SETUP,
  selectClosingCard,
  selectConversation,
  selectGiftsToGive,
  selectSmallTalkKey,
  selectToast,
  type GameStoreDeps,
} from './index.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let databases = 0;

/** A store whose NPC the test speaks for, recording what the store sends it and answers its tool calls with. */
function town(game: GameState = createSave(DEV_SETUP)) {
  const npc = {
    session: null as NpcSession | null,
    events: null as VoiceSessionEvents | null,
    sent: [] as string[],
    answers: [] as ToolResponse[],
    says(text: string) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      npc.events!.onToolCall({ id: `call-${npc.answers.length}`, name, args });
    },
  };
  const openVoiceSession: OpenVoiceSession = (session, events) => {
    npc.session = session;
    npc.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: (text) => npc.sent.push(text),
      sendToolResponse: (_, response) => npc.answers.push(response),
      close: () => {},
    };
  };
  const recaps: { request: RecapRequest; arrives: (recap: Recap) => Promise<void> }[] = [];
  const requestRecap: GameStoreDeps['requestRecap'] = (request) =>
    new Promise((resolve) => {
      recaps.push({
        request,
        arrives: async (recap) => {
          resolve(recap);
          await flush();
          await flush();
        },
      });
    });
  const journal = createJournal(() => createStore(`small-talk-test-${++databases}`, 'entries'));
  const store = createGameStore(game, { openVoiceSession, requestRecap, journal });
  return { store, npc, recaps, journal };
}

function nextTo(npcId: TownNpcId, placeId: GameState['placeId'], game: GameState = createSave(DEV_SETUP)) {
  // In the park, a regular has already waved the Character over today, so it's the Player who starts any chat.
  const setup = town(placeId === 'park' ? { ...game, parkWavedOnDay: game.clock.day } : game);
  setup.store.getState().enterPlace(placeId);
  setup.store.getState().setInteractable(npcId);
  return setup;
}

describe('starting Small Talk', () => {
  it('starts with E on a Named NPC who has nothing else to talk about', () => {
    const { store, npc } = nextTo('park-regular-1', 'park');

    expect(selectSmallTalkKey(store.getState())).toBe('E');
    store.getState().talk('E');

    expect(selectConversation(store.getState())).toMatchObject({ npcId: 'park-regular-1', interaction: null });
    expect(npc.session?.tools.map((tool) => tool.name)).toEqual([LEARN_NAME_TOOL, REVEAL_FAVOURITE_TOOL, 'not_understood']);
  });

  it('starts with T on staff, whose E is still their Goal Interaction', () => {
    const { store, npc } = nextTo('barista', 'cafe');

    expect(selectSmallTalkKey(store.getState())).toBe('T');
    store.getState().talk('T');

    expect(selectConversation(store.getState())).toMatchObject({ npcId: 'barista', interaction: null });
    expect(npc.session?.systemInstruction).toContain('This is Small Talk');
  });

  it('still orders with E at the barista', () => {
    const { store } = nextTo('barista', 'cafe');

    store.getState().talk('E');

    expect(selectConversation(store.getState())?.interaction).toBe(INTERACTIONS.orderDrink);
  });

  it("doesn't chat with the cashier while the Character is carrying shopping: E pays", () => {
    const opening = createSave(DEV_SETUP);
    const { opensAt } = placeHours('supermarket', DEV_SETUP.culturePackId)!;
    const { store } = nextTo('cashier', 'supermarket', { ...opening, clock: { ...opening.clock, minuteOfDay: opensAt + 60 } });
    expect(selectSmallTalkKey(store.getState())).toBe('T');
    store.getState().setInteractable('eggs');
    store.getState().takeFromShelf();
    store.getState().setInteractable('cashier');

    expect(store.getState().basket).not.toEqual([]);
    expect(selectSmallTalkKey(store.getState())).toBeNull();
  });

  it('has nothing to say to someone who is not a Named NPC', () => {
    const { store } = nextTo('passer-by-1', 'tram-stop');

    expect(selectSmallTalkKey(store.getState())).toBeNull();
    store.getState().talk('E');

    expect(selectConversation(store.getState())).toBeNull();
    expect(selectToast(store.getState())).toEqual({ kind: 'nothingToSay', npcId: 'passer-by-1' });
  });
});

/** Small Talk with a park regular, who has greeted the Character. */
function chattingInThePark(game?: GameState) {
  const setup = nextTo('park-regular-1', 'park', game);
  setup.store.getState().talk('E');
  setup.npc.says('こんにちは！いい天気ですね。');
  return setup;
}

/** The Player says something, and the NPC answers: understood, or not (calling not_understood first). */
function exchange({ store, npc }: Pick<ReturnType<typeof town>, 'store' | 'npc'>, understood = true) {
  store.getState().sendTypedLine('はい、いい天気です');
  if (!understood) npc.calls('not_understood', { reason: 'unintelligible' });
  npc.says(understood ? 'そうですね。' : 'すみません、もう一度？');
}

const smallTalkOf = (store: ReturnType<typeof town>['store']) => selectConversation(store.getState())?.smallTalk;

describe('Small Talk under way', () => {
  it('lifts Mood with each exchange the NPC understood, and not with one they did not', () => {
    const setup = chattingInThePark();
    const mood = () => setup.store.getState().game.character.mood;
    const before = mood();

    exchange(setup);
    const afterOne = mood();
    exchange(setup, false);

    expect(afterOne).toBe(before + MOOD.changes.smallTalkExchange.stranger);
    expect(mood()).toBe(afterOne);
    expect(memoryOf(setup.store.getState().game, 'park-regular-1').familiarity).toBe(FAMILIARITY.smallTalkExchange);
  });

  it("can't fail, however little the NPC understands", () => {
    const setup = chattingInThePark();

    for (let i = 0; i < 5; i++) {
      setup.store.getState().sendTypedLine('???');
      setup.npc.calls('not_understood', { reason: 'unintelligible' });
    }

    expect(setup.npc.answers.every((answer) => answer.result === 'noted')).toBe(true);
    expect(selectConversation(setup.store.getState())?.outcome).toBeNull();
  });

  it("counts a turn the NPC didn't understand as not understood even with Help open, and never answers out_of_patience", () => {
    const setup = chattingInThePark();
    const mood = setup.store.getState().game.character.mood;

    setup.store.getState().sendTypedLine('xqzt');
    setup.store.getState().toggleHelp();
    expect(selectConversation(setup.store.getState())?.tab).toBe('help');
    setup.npc.calls('not_understood', { reason: 'unintelligible' });
    setup.store.getState().toggleHelp();
    setup.npc.says('すみません、もう一度？');

    expect(setup.store.getState().game.character.mood).toBe(mood);
    expect(setup.npc.answers).toEqual([{ result: 'noted' }]);
  });

  it('has the NPC wrap up once the chat has gone on for its 6–8 exchanges, then shows the closing card', () => {
    const setup = chattingInThePark();
    const { exchanges } = smallTalkOf(setup.store)!;
    const met = memoryOf(setup.store.getState().game, 'park-regular-1').timesMet;

    for (let i = 0; i < exchanges - 1; i++) exchange(setup);
    expect(setup.npc.sent).not.toContain(WRAP_UP_SCENE);
    exchange(setup);

    expect(setup.npc.sent.at(-1)).toBe(WRAP_UP_SCENE);
    setup.npc.says('じゃあ、またね！');
    const card = selectClosingCard(setup.store.getState());
    expect(card?.kind).toBe('smallTalk');
    // The cap allows only some of the exchanges to lift Mood.
    expect(card?.moodChange).toBe(MOOD.changes.smallTalkExchange.stranger * (FAMILIARITY.dailyCapPerNpc / FAMILIARITY.smallTalkExchange));
    expect(memoryOf(setup.store.getState().game, 'park-regular-1').timesMet).toBe(met + 1);
  });

  it('has the NPC wrap up when they become busy: their place has closed', () => {
    const { store, npc } = nextTo('barista', 'cafe');
    store.getState().talk('T');
    npc.says('こんにちは！');
    // The café closes while they chat.
    const game = store.getState().game;
    const { closesAt } = placeHours('cafe', DEV_SETUP.culturePackId)!;
    store.setState({ game: { ...game, clock: { ...game.clock, minuteOfDay: closesAt } } });

    exchange({ store, npc });

    expect(npc.sent.at(-1)).toBe(WRAP_UP_SCENE);
  });

  it('counts as meeting the NPC when the Player leaves early, keeping the Mood it lifted, with no Recap', () => {
    const setup = chattingInThePark();
    exchange(setup);
    const mood = setup.store.getState().game.character.mood;

    setup.store.getState().leaveConversation();

    expect(selectConversation(setup.store.getState())).toBeNull();
    expect(setup.store.getState().game.character.mood).toBe(mood);
    expect(memoryOf(setup.store.getState().game, 'park-regular-1').timesMet).toBe(1);
    expect(setup.recaps).toHaveLength(0);
  });

  it('counts as meeting the NPC when the connection is lost for good', () => {
    const setup = chattingInThePark();
    setup.npc.events!.onDisconnect();
    setup.npc.events!.onDisconnect();

    expect(selectConversation(setup.store.getState())).toBeNull();
    expect(memoryOf(setup.store.getState().game, 'park-regular-1').timesMet).toBe(1);
  });
});

describe('learn_name', () => {
  it("lets the NPC know the Character's name when it's the one from setup", () => {
    const setup = chattingInThePark();

    setup.npc.calls(LEARN_NAME_TOOL, { name: DEV_SETUP.characterName });

    expect(setup.npc.answers).toEqual([{ result: 'learned' }]);
    expect(memoryOf(setup.store.getState().game, 'park-regular-1').knowsName).toBe(true);
  });

  it('tells the NPC they misheard any other name', () => {
    const setup = chattingInThePark();

    setup.npc.calls(LEARN_NAME_TOOL, { name: 'Pam' });

    expect(setup.npc.answers).toEqual([{ result: 'wrong_name' }]);
    expect(memoryOf(setup.store.getState().game, 'park-regular-1').knowsName).toBe(false);
  });

  it('works in a Goal Interaction too', () => {
    const { store, npc } = nextTo('barista', 'cafe');
    store.getState().talk('E');

    npc.calls(LEARN_NAME_TOOL, { name: DEV_SETUP.characterName });

    expect(memoryOf(store.getState().game, 'barista').knowsName).toBe(true);
  });
});

/** The DEV_SETUP game with these gifts in the inventory, one of each. */
function holding(...gifts: ItemId[]): GameState {
  const game = createSave(DEV_SETUP);
  return { ...game, possessions: { ...game.possessions, inventory: gifts.map((itemId) => ({ itemId, quantity: 1, expiresOnDay: null })) } };
}

const regular = NAMED_NPCS['park-regular-1'];
const notTheirFavourite = (['flowers', 'chocolates'] as const).find((gift) => gift !== regular.favouriteGift)!;

describe('giving a gift', () => {
  it('hands a gift from the inventory to the NPC in Small Talk, who is told it by its local name', () => {
    const setup = chattingInThePark(holding(notTheirFavourite, 'cake'));
    expect(selectGiftsToGive(setup.store.getState())).toEqual([{ itemId: notTheirFavourite, quantity: 1, favourite: false }]);

    setup.store.getState().giveGift(notTheirFavourite);

    const { game } = setup.store.getState();
    expect(game.possessions.inventory.map((item) => item.itemId)).toEqual(['cake']);
    expect(memoryOf(game, 'park-regular-1').familiarity).toBe(FAMILIARITY.gift);
    expect(setup.npc.sent.at(-1)).toMatch(new RegExp(`^\\[SCENE: .*gift: ${CULTURE_PACKS.ja.goods[notTheirFavourite].name}\\.`));
    expect(selectGiftsToGive(setup.store.getState())).toEqual([]);
  });

  it("doesn't count the gift as a Small Talk exchange", () => {
    const setup = chattingInThePark(holding(notTheirFavourite));

    setup.store.getState().giveGift(notTheirFavourite);
    setup.npc.says('わあ、ありがとう！');

    expect(selectConversation(setup.store.getState())?.smallTalk?.turns).toBe(0);
  });

  it('works in a Goal Interaction too', () => {
    const { store, npc } = nextTo('barista', 'cafe', holding('flowers'));
    store.getState().talk('E');
    npc.says('いらっしゃいませ！');

    store.getState().giveGift('flowers');

    expect(store.getState().game.possessions.inventory).toEqual([]);
    expect(memoryOf(store.getState().game, 'barista').lastGiftDay).toBe(store.getState().game.clock.day);
    expect(selectConversation(store.getState())?.outcome).toBeNull();
  });

  it('has the NPC delighted by their favourite', () => {
    const setup = chattingInThePark(holding(regular.favouriteGift));

    setup.store.getState().giveGift(regular.favouriteGift);

    expect(memoryOf(setup.store.getState().game, 'park-regular-1').familiarity).toBe(FAMILIARITY.favouriteGift);
    expect(setup.npc.sent.at(-1)).toContain('the gift you would love most');
  });

  it("counts only one gift a week, and the NPC says the Character shouldn't have", () => {
    const setup = chattingInThePark(holding(notTheirFavourite, regular.favouriteGift));

    setup.store.getState().giveGift(notTheirFavourite);
    setup.store.getState().giveGift(regular.favouriteGift);

    expect(setup.store.getState().game.possessions.inventory).toEqual([]);
    expect(memoryOf(setup.store.getState().game, 'park-regular-1').familiarity).toBe(FAMILIARITY.gift);
    expect(setup.npc.sent.at(-1)).toMatch(/only a few days ago/);
  });

  it('marks the favourite only once the NPC has told it', () => {
    const setup = chattingInThePark(holding(regular.favouriteGift));
    expect(selectGiftsToGive(setup.store.getState())).toEqual([{ itemId: regular.favouriteGift, quantity: 1, favourite: false }]);

    setup.npc.calls(REVEAL_FAVOURITE_TOOL, { gift: '花' });

    expect(selectGiftsToGive(setup.store.getState())).toEqual([{ itemId: regular.favouriteGift, quantity: 1, favourite: true }]);
  });

  it('offers nothing to give once the outcome is decided, or outside a conversation', () => {
    const setup = chattingInThePark(holding(notTheirFavourite));
    for (let i = 0; i < smallTalkOf(setup.store)!.exchanges; i++) exchange(setup);

    expect(selectConversation(setup.store.getState())?.outcome).not.toBeNull();
    expect(selectGiftsToGive(setup.store.getState())).toEqual([]);
    setup.store.getState().giveGift(notTheirFavourite);
    expect(setup.store.getState().game.possessions.inventory).toHaveLength(1);
    expect(selectGiftsToGive(nextTo('park-regular-1', 'park', holding(notTheirFavourite)).store.getState())).toEqual([]);
  });
});

describe('reveal_favourite', () => {
  it('remembers the NPC told the Character their favourite gift', () => {
    const setup = chattingInThePark();

    setup.npc.calls(REVEAL_FAVOURITE_TOOL, { gift: '花' });

    expect(setup.npc.answers).toEqual([{ result: 'remembered' }]);
    expect(memoryOf(setup.store.getState().game, 'park-regular-1').favouriteKnown).toBe(true);
  });

  it('works in a Goal Interaction too', () => {
    const { store, npc } = nextTo('barista', 'cafe');
    store.getState().talk('E');

    npc.calls(REVEAL_FAVOURITE_TOOL, { gift: 'チョコレート' });

    expect(memoryOf(store.getState().game, 'barista').favouriteKnown).toBe(true);
  });
});

const CHAT_RECAP: Recap = {
  outcome: 'A nice chat about the weather.',
  corrections: [],
  newWords: [{ base: '天気', reading: 'てんき', gloss: 'weather' }],
  cefrEstimate: 'A1',
  lastTopic: 'the sunny weather',
};

/** Chats until the NPC wraps up and says goodbye, so the closing card shows. */
function chatToTheEnd(setup: ReturnType<typeof chattingInThePark>) {
  const { exchanges } = smallTalkOf(setup.store)!;
  for (let i = 0; i < exchanges; i++) exchange(setup);
  setup.npc.says('じゃあ、またね！');
}

describe("Small Talk's Recap", () => {
  it('asks for the lighter Small Talk Recap, with the NPC and the transcript', () => {
    const setup = chattingInThePark();

    chatToTheEnd(setup);

    expect(setup.recaps).toHaveLength(1);
    expect(setup.recaps[0]!.request).toMatchObject({ kind: 'smallTalk', npcId: 'park-regular-1', culturePackId: DEV_SETUP.culturePackId });
    expect(setup.recaps[0]!.request.kind === 'smallTalk' && setup.recaps[0]!.request.transcript[0]).toEqual({
      speaker: 'npc',
      text: 'こんにちは！いい天気ですね。',
    });
  });

  it("remembers the Recap's topic as what the NPC talked about last, in place of the one before", async () => {
    const before = createSave(DEV_SETUP);
    const known: NpcMemory = { ...memoryOf(before, 'park-regular-1'), lastTopic: 'the rain' };
    const setup = chattingInThePark({ ...before, people: { 'park-regular-1': known } });

    chatToTheEnd(setup);
    await setup.recaps[0]!.arrives(CHAT_RECAP);

    expect(memoryOf(setup.store.getState().game, 'park-regular-1').lastTopic).toBe('the sunny weather');
  });

  it('keeps it in the Journal as a Small Talk page', async () => {
    const setup = chattingInThePark();

    chatToTheEnd(setup);
    await setup.recaps[0]!.arrives(CHAT_RECAP);

    const [entry] = await setup.journal.list(setup.store.getState().slotId);
    expect(entry).toMatchObject({ kind: 'smallTalk', npcId: 'park-regular-1', npcName: null, placeName: '桜ヶ丘公園' });
  });
});

describe('what the NPC remembers, in the session', () => {
  const friendOf = (npcId: 'barista' | 'park-regular-1'): GameState => {
    const game = createSave(DEV_SETUP);
    const friend: NpcMemory = { ...memoryOf(game, npcId), familiarity: FAMILIARITY.tierThresholds.friend, knowsName: true };
    return { ...game, people: { [npcId]: friend } };
  };

  it('greets a friend by name, in Small Talk and in a Goal Interaction', () => {
    const chat = chattingInThePark(friendOf('park-regular-1'));
    const { store, npc } = nextTo('barista', 'cafe', friendOf('barista'));
    store.getState().talk('E');

    expect(chat.npc.session?.systemInstruction).toContain(`Greet them by name: ${DEV_SETUP.characterName}.`);
    expect(npc.session?.systemInstruction).toContain(`Greet them by name: ${DEV_SETUP.characterName}.`);
  });

  it('gives a friend one more Patience', () => {
    const stranger = nextTo('barista', 'cafe');
    const friend = nextTo('barista', 'cafe', friendOf('barista'));
    stranger.store.getState().talk('E');
    friend.store.getState().talk('E');

    const patience = (s: typeof stranger) => selectConversation(s.store.getState())!.patience.starting;
    expect(patience(friend)).toBe(patience(stranger) + FAMILIARITY.friendPatienceBonus);
  });
});

describe('park regulars waving the Player over', () => {
  /** Out at the tram stop on `day`, about to walk into the park. */
  function atTheTramStop(day = 3) {
    const game = createSave(DEV_SETUP);
    const setup = town({ ...game, placeId: 'tram-stop', clock: { day, minuteOfDay: 10 * 60 } });
    return setup;
  }

  it('has a park regular wave the Character over as they come into the park, and speak first', () => {
    const { store, npc } = atTheTramStop();

    store.getState().enterPlace('park');

    const conversation = selectConversation(store.getState());
    expect(conversation?.smallTalk).not.toBeNull();
    expect(NAMED_NPCS[conversation!.npcId!].placeId).toBe('park');
    expect(npc.session?.openingScene).toMatch(/^\[SCENE: .*wave them over.*\]$/);
    expect(store.getState().heldStill).toBe(true);
  });

  it('waves at most once a day', () => {
    const { store } = atTheTramStop();
    store.getState().enterPlace('park');
    store.getState().leaveConversation();

    store.getState().enterPlace('tram-stop');
    store.getState().enterPlace('park');
    expect(selectConversation(store.getState())).toBeNull();

    const game = store.getState().game;
    store.setState({ game: { ...game, clock: { day: game.clock.day + 1, minuteOfDay: 9 * 60 } } });
    store.getState().enterPlace('tram-stop');
    store.getState().enterPlace('park');
    expect(selectConversation(store.getState())?.smallTalk).not.toBeNull();
  });
});

/** The barista, a friend who knows the Character's name, as `memory` changes. */
function friendlyBarista(change: Partial<NpcMemory> = {}, game = createSave(DEV_SETUP)): GameState {
  const friend: NpcMemory = { ...memoryOf(game, 'barista'), familiarity: FAMILIARITY.tierThresholds.friend, knowsName: true, ...change };
  return { ...game, people: { barista: friend } };
}

/** Small Talk with the barista, who has greeted the Character. */
function chattingAtTheCafe(game: GameState) {
  const setup = nextTo('barista', 'cafe', game);
  setup.store.getState().talk('T');
  setup.npc.says('あ、こんにちは！');
  return setup;
}

describe('the casual register', () => {
  it('is offered by a friend, and noted in the Recap once the chat is over', () => {
    const setup = chattingAtTheCafe(friendlyBarista());
    expect(setup.npc.session?.systemInstruction).toContain(CULTURE_PACKS.ja.casualRegister.offer);

    chatToTheEnd(setup);

    expect(memoryOf(setup.store.getState().game, 'barista').registerOffered).toBe(true);
    expect(setup.recaps[0]!.request).toMatchObject({ kind: 'smallTalk', registerOffered: true });
  });

  it('is offered only once', () => {
    const offered = chattingAtTheCafe(friendlyBarista());
    chatToTheEnd(offered);
    offered.store.getState().leaveConversation();

    offered.store.getState().talk('T');

    expect(offered.npc.session?.systemInstruction).not.toContain(CULTURE_PACKS.ja.casualRegister.offer);
    expect(offered.npc.session?.systemInstruction).toContain(CULTURE_PACKS.ja.casualRegister.inUse);
  });

  it('is offered again next time when the Player left before the chat was over', () => {
    const setup = chattingAtTheCafe(friendlyBarista());

    setup.store.getState().leaveConversation();

    expect(memoryOf(setup.store.getState().game, 'barista').registerOffered).toBe(false);
  });

  it('is noted in the Recap of a Goal Interaction too, and not when it was offered before', () => {
    const recapOf = (game: GameState) => {
      const { store, npc, recaps } = nextTo('barista', 'cafe', game);
      store.getState().talk('E');
      npc.says('いらっしゃいませ！');
      npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
      npc.says('ありがとうございました！');
      return recaps[0]!.request;
    };
    const withMoney = (game: GameState): GameState => ({ ...game, character: { ...game.character, moneyInShifts: 5 } });

    expect(recapOf(withMoney(friendlyBarista()))).toMatchObject({ kind: 'goal', registerOffered: true });
    expect(recapOf(withMoney(friendlyBarista({ registerOffered: true })))).not.toHaveProperty('registerOffered');
  });
});

describe('the casual register, when the NPC came over', () => {
  it('is not offered by a friend who came over with something to say: the landlord about rent', () => {
    const game = createSave(DEV_SETUP);
    const landlord: NpcMemory = { ...memoryOf(game, 'landlord'), familiarity: FAMILIARITY.tierThresholds.friend };
    const rentDay: GameState = { ...game, clock: { day: game.rent.dueDay, minuteOfDay: 9 * 60 }, people: { landlord } };
    const { store, npc } = town(rentDay);

    store.getState().setInteractable('landlord');

    expect(selectConversation(store.getState())?.npcId).toBe('landlord');
    expect(npc.session?.systemInstruction).not.toContain(CULTURE_PACKS.ja.casualRegister.offer);
  });
});

describe('"on the house"', () => {
  /** A friendly barista on a day whose roll gives something on the house, or (`given: false`) doesn't. */
  function friendWhoRolls(given: boolean): GameState {
    for (let seed = 1; ; seed++) {
      const game = friendlyBarista({}, createSave({ ...DEV_SETUP, rngSeed: seed }));
      if (rollOnTheHouse(game, INTERACTIONS.orderDrink).onTheHouse === given) return game;
    }
  }

  it("has a friend add a little something to the order now and then, as the save's RNG draws it", () => {
    const lucky = nextTo('barista', 'cafe', friendWhoRolls(true));
    const unlucky = nextTo('barista', 'cafe', friendWhoRolls(false));
    lucky.store.getState().talk('E');
    unlucky.store.getState().talk('E');

    expect(lucky.npc.session?.systemInstruction).toMatch(/on the house/);
    expect(unlucky.npc.session?.systemInstruction).not.toMatch(/on the house/);
  });

  /** Orders a latte from the barista, who serves it. */
  function orderALatte({ store, npc }: ReturnType<typeof nextTo>) {
    store.getState().talk('E');
    npc.says('いらっしゃいませ！');
    npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    npc.says('ありがとうございました！');
    store.getState().leaveConversation();
  }

  it('comes at most once a week, counted from the order it came with', () => {
    const lucky = friendWhoRolls(true);
    const setup = nextTo('barista', 'cafe', { ...lucky, character: { ...lucky.character, moneyInShifts: 50 } });
    orderALatte(setup);
    expect(setup.npc.session?.systemInstruction).toMatch(/on the house/);

    for (let i = 0; i < 30; i++) {
      setup.store.getState().talk('E');
      expect(setup.npc.session?.systemInstruction).not.toMatch(/on the house/);
      setup.store.getState().leaveConversation();
    }
  });

  it('uses up nothing when the Player leaves before the order is served', () => {
    const { store } = nextTo('barista', 'cafe', friendWhoRolls(true));
    store.getState().talk('E');

    store.getState().leaveConversation();

    expect(memoryOf(store.getState().game, 'barista').lastOnTheHouseDay).toBeNull();
  });
});
