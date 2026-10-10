import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { describe, expect, it } from 'vitest';
import type { Recap, RecapRequest } from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS } from '../content/index.ts';
import { CLOCK, createSave, type GameState, type LanguageCode } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  createJournal,
  DEV_SETUP,
  selectClosingCard,
  selectConversation,
  selectJournal,
  selectRecap,
  selectTimeScale,
  selectToast,
  SAVE_SCHEMA_VERSION,
  type GameStoreDeps,
} from './index.ts';
import { recordingSaves } from './testSaves.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const RECAP: Recap = {
  outcome: 'You ordered a hot latte.',
  corrections: [{ said: 'ラテ ください', natural: 'ラテをください', why: 'を marks what you want.' }],
  newWords: [{ base: 'いらっしゃいませ', reading: 'いらっしゃいませ', gloss: 'welcome' }],
  cefrEstimate: 'A1',
};

let databases = 0;

/**
 * A store whose NPC the test speaks for, whose Recaps arrive when the test says,
 * and whose Journal is a fresh IndexedDB database.
 */
function cafe(game = createSave(DEV_SETUP)) {
  const npc = {
    events: null as VoiceSessionEvents | null,
    closed: false,
    says(text: string) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      npc.events!.onToolCall({ id: 'call', name, args });
    },
  };
  const openVoiceSession: OpenVoiceSession = (_, events) => {
    npc.events = events;
    npc.closed = false;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: () => {},
      sendToolResponse: () => {},
      close: () => (npc.closed = true),
    };
  };

  const recaps: { request: RecapRequest; arrives: (recap: Recap) => Promise<void>; fails: () => Promise<void> }[] = [];
  const requestRecap: GameStoreDeps['requestRecap'] = (request) =>
    new Promise((resolve, reject) => {
      recaps.push({
        request,
        arrives: async (recap) => {
          resolve(recap);
          await flush();
        },
        fails: async () => {
          reject(new Error('recap_unavailable'));
          await flush();
        },
      });
    });

  const autosaves: { game: GameState; closingCardShown: boolean }[] = [];
  const said: { text: string; targetLanguage: LanguageCode }[] = [];
  const journal = createJournal(() => createStore(`recap-test-${++databases}`, 'entries'));
  const store = createGameStore(game, {
    openVoiceSession,
    requestRecap,
    journal,
    saves: {
      ...recordingSaves().saves,
      write: async (slotId, game) => {
        autosaves.push({ game, closingCardShown: selectClosingCard(store.getState()) !== null });
        return { schemaVersion: SAVE_SCHEMA_VERSION, slotId, createdAt: '', lastPlayedAt: '', game };
      },
    },
    hearItSaid: async (text, targetLanguage) => void said.push({ text, targetLanguage }),
  });
  store.getState().enterPlace('cafe');
  store.getState().setInteractable('barista');
  // Walking in through the door saved; these tests count the saves after that.
  autosaves.length = 0;
  return { store, npc, recaps, journal, autosaves, said };
}

/** Orders a latte with the Typed Fallback; the barista says goodbye, and the closing card shows. */
function orderALatte() {
  const setup = cafe();
  const { store, npc } = setup;
  store.getState().talk();
  npc.says('いらっしゃいませ！');
  store.getState().sendTypedLine('ラテ ください');
  npc.says('ラテですね。よろしいですか？');
  store.getState().sendTypedLine('はい');
  npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
  npc.says('ありがとうございました。');
  return setup;
}

describe('the Recap', () => {
  it('applies the outcome, then autosaves, then shows the closing card, then asks for the Recap', () => {
    const { store, npc, autosaves, recaps } = cafe();
    store.getState().talk();
    npc.says('いらっしゃいませ！');
    store.getState().sendTypedLine('ラテ ください');
    npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });

    expect(autosaves).toHaveLength(1);
    expect(autosaves[0]!.game).toBe(store.getState().game);
    expect(autosaves[0]!.closingCardShown).toBe(false);
    expect(recaps).toHaveLength(0);

    npc.says('ありがとうございました。');

    expect(selectClosingCard(store.getState())?.kind).toBe('success');
    expect(recaps).toHaveLength(1);
  });

  it('asks for a Recap of the whole conversation, with typed lines marked, as soon as it ends', () => {
    const { recaps } = orderALatte();

    expect(recaps[0]!.request).toEqual({
      kind: 'goal',
      culturePackId: DEV_SETUP.culturePackId,
      step: DEV_SETUP.startingStep,
      nativeLanguage: 'en',
      conversation: {
        interactionId: INTERACTIONS.orderDrink.id,
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: 'いらっしゃいませ！' },
          { speaker: 'player', text: 'ラテ ください', typed: true },
          { speaker: 'npc', text: 'ラテですね。よろしいですか？' },
          { speaker: 'player', text: 'はい', typed: true },
          { speaker: 'npc', text: 'ありがとうございました。' },
        ],
        helpLog: [],
      },
    });
  });

  it('writes the Recap in the Native Language set at the time', () => {
    const setup = cafe();
    setup.store.setState({ nativeLanguage: 'de' });
    setup.store.getState().talk();
    setup.npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    setup.npc.says('ありがとうございました。');

    expect(setup.recaps[0]!.request.nativeLanguage).toBe('de');
  });

  it('shows a loading state from See Recap until the Recap arrives, then the Recap as a Journal page', async () => {
    const { store, recaps } = orderALatte();
    expect(selectRecap(store.getState())).toBeNull();

    store.getState().seeRecap();
    expect(selectRecap(store.getState())).toEqual({ status: 'writing' });

    await recaps[0]!.arrives(RECAP);

    expect(selectRecap(store.getState())).toMatchObject({
      status: 'ready',
      entry: {
        recap: { outcome: RECAP.outcome, corrections: RECAP.corrections, newWords: RECAP.newWords },
        outcome: 'success',
        nativeLanguage: 'en',
        placeName: CULTURE_PACKS.ja.cafe.name,
        noHelpNeeded: true,
      },
    });
  });

  it('saves the Recap to the Journal, and Done closes it', async () => {
    const { store, recaps, journal } = orderALatte();
    store.getState().seeRecap();
    await recaps[0]!.arrives(RECAP);
    const shown = selectRecap(store.getState());

    store.getState().closeRecap();

    expect(selectConversation(store.getState())).toBeNull();
    expect(shown?.status).toBe('ready');
    expect(await journal.list('slot-1')).toEqual([expect.objectContaining(shown?.status === 'ready' ? shown.entry : {})]);
  });

  it('keeps the NPC’s name in the Journal only once the Character knows it', async () => {
    const stranger = cafe();
    stranger.store.getState().talk();
    stranger.npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    stranger.npc.says('ありがとうございました。');
    await stranger.recaps[0]!.arrives(RECAP);

    const regular = cafe();
    const game = regular.store.getState().game;
    const memory = {
      familiarity: 4,
      todaysGain: { day: 1, amount: 0 },
      timesMet: 3,
      knowsName: true,
      usualOrder: null,
      lastOrder: null,
      lastTopic: null,
      favouriteKnown: false,
      lastGiftDay: null,
      lastOnTheHouseDay: null,
      registerOffered: false,
    };
    regular.store.setState({ game: { ...game, people: { barista: memory } } });
    regular.store.getState().talk();
    regular.npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    regular.npc.says('ありがとうございました。');
    await regular.recaps[0]!.arrives(RECAP);

    expect((await stranger.journal.list('slot-1'))[0]).toMatchObject({ npcName: null });
    expect((await regular.journal.list('slot-1'))[0]).toHaveProperty('npcName',CULTURE_PACKS[DEV_SETUP.culturePackId].personas.barista.name);
  });

  it('Skip Recap still saves the Recap to the Journal when it arrives, and says so', async () => {
    const { store, recaps, journal } = orderALatte();

    store.getState().skipRecap();

    expect(selectConversation(store.getState())).toBeNull();
    expect(selectToast(store.getState())).toEqual({ kind: 'recapSaved' });

    await recaps[0]!.arrives(RECAP);

    expect(selectConversation(store.getState())).toBeNull();
    expect((await journal.list('slot-1')).map((entry) => entry.recap?.outcome)).toEqual([RECAP.outcome]);
  });

  it('a Recap that arrives late never lands in the next conversation', async () => {
    const { store, npc, recaps } = orderALatte();
    store.getState().skipRecap();
    store.getState().talk();
    npc.says('いらっしゃいませ！');

    await recaps[0]!.arrives(RECAP);

    expect(selectConversation(store.getState())?.recap).toBeNull();
  });

  it('keeps the conversation in the Journal with no Recap when the Recap cannot be written', async () => {
    const { store, recaps, journal } = orderALatte();
    store.getState().seeRecap();

    await recaps[0]!.fails();

    expect(selectRecap(store.getState())).toEqual({ status: 'failed' });
    const [entry] = await journal.list('slot-1');
    expect(entry?.recap).toBeNull();
    expect(entry?.lines).toHaveLength(5);
  });

  it('gives a failed Goal Interaction a Recap too', () => {
    // Past the First Morning, whose café order can't fail.
    const { store, npc, recaps } = cafe(createSave({ ...DEV_SETUP, skipFirstMorning: true }));
    store.getState().talk();
    for (let i = 0; i < 10 && !selectConversation(store.getState())?.outcome; i++) {
      store.getState().sendTypedLine('asdf');
      npc.calls('not_understood', { reason: 'unintelligible' });
    }
    npc.says('申し訳ございません…。');

    expect(recaps[0]!.request).toMatchObject({ kind: 'goal', conversation: { outcome: 'failure' } });
  });

  it('has no Recap when the Player leaves before the outcome', async () => {
    const { store, npc, recaps, autosaves, journal } = cafe();
    store.getState().talk();
    npc.says('いらっしゃいませ！');

    store.getState().leaveConversation();
    await flush();

    expect(recaps).toEqual([]);
    expect(autosaves).toEqual([]);
    expect(await journal.list('slot-1')).toEqual([]);
  });

  it('says a phrase aloud in the Target Language', async () => {
    const { store, said } = cafe();

    store.getState().hearItSaid('ラテをください');
    await flush();

    expect(said).toEqual([{ text: 'ラテをください', targetLanguage: DEV_SETUP.targetLanguage }]);
  });
});

describe('the Journal screen', () => {
  it('opens with every entry, newest first, and pauses the clock until it closes', async () => {
    const { store, npc, recaps } = orderALatte();
    store.getState().skipRecap();
    await recaps[0]!.arrives(RECAP);
    store.getState().talk();
    npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    npc.says('ありがとうございました。');
    store.getState().skipRecap();
    await recaps[1]!.arrives({ ...RECAP, outcome: 'Another latte.' });

    store.getState().openJournal();
    expect(selectJournal(store.getState())).toEqual({ entries: null, failed: false });
    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.paused);

    await expect
      .poll(() => selectJournal(store.getState())?.entries?.map((entry) => entry.recap?.outcome))
      .toEqual(['Another latte.', RECAP.outcome]);

    store.getState().closeJournal();
    expect(selectJournal(store.getState())).toBeNull();
    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.normal);
  });

  it('does not open during a conversation', () => {
    const { store } = cafe();
    store.getState().talk();

    store.getState().openJournal();

    expect(selectJournal(store.getState())).toBeNull();
  });
});
