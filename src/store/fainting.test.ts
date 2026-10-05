import { describe, expect, it, vi } from 'vitest';
import { GREETING_SCENE, type NpcSession, type RecapRequest, type ToolResponse } from '../ai/index.ts';
import { CULTURE_PACKS } from '../content/index.ts';
import { CLOCK, createSave, ECONOMY, METER_MAX, type GameState } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  JOURNAL_SCHEMA_VERSION,
  selectClosingCard,
  selectConversation,
  selectDebts,
  selectFainting,
  selectHelpOpen,
  selectMoneyInShifts,
  selectTimeScale,
  selectToast,
  selectTramArrival,
  selectWardArrival,
  selectWorldKeysOff,
  type GameStoreDeps,
  type Journal,
  type NewJournalEntry,
} from './index.ts';
import { recordingSaves } from './testSaves.ts';

const HOUR = 60;

/** A stand-in NPC the test speaks for, recording the session it was opened with and the answers to its tool calls. */
function fakeNpc() {
  const npc = {
    session: null as NpcSession | null,
    events: null as VoiceSessionEvents | null,
    answers: [] as ToolResponse[],
    closed: false,
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
    npc.closed = false;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: () => {},
      sendToolResponse: (_, response) => void npc.answers.push(response),
      close: () => (npc.closed = true),
    };
  };
  return { npc, openVoiceSession };
}

/** Out in the park on day 3, with Hunger and Thirst empty and Health about to run out. */
function starving(character: Partial<GameState['character']> = {}, deps: Partial<GameStoreDeps> = {}) {
  const { saves, written } = recordingSaves();
  const { npc, openVoiceSession } = fakeNpc();
  const game = createSave(DEV_SETUP);
  const store = createGameStore(
    {
      ...game,
      placeId: 'park',
      clock: { day: 3, minuteOfDay: 15 * HOUR },
      character: { ...game.character, health: 0.01, hunger: 0, thirst: 0, ...character },
    },
    { saves, openVoiceSession, ...deps },
  );
  return { store, written, npc };
}

/** Faints, then wakes in the ward, where the nurse speaks first. */
function wokenInTheWard(deps: Partial<GameStoreDeps> = {}) {
  const fainted = starving({}, deps);
  fainted.store.getState().advance(CLOCK.maxRealDeltaMs);
  fainted.store.getState().wakeInWard();
  fainted.npc.says('目が覚めましたね。気分はどうですか？');
  return fainted;
}

describe('Fainting', () => {
  it('shows the Fainting screen once Health runs out, with the Character already in the ward at 08:00 the next day', () => {
    const { store } = starving({ moneyInShifts: ECONOMY.faintingBillInShifts + 0.5 });

    store.getState().advance(CLOCK.maxRealDeltaMs);

    expect(selectFainting(store.getState())).toEqual({ billInShifts: ECONOMY.faintingBillInShifts, paid: true });
    expect(store.getState().game.clock).toEqual({ day: 4, minuteOfDay: CLOCK.faintWakeAt });
    expect(store.getState().game.placeId).toBe('clinic');
  });

  it('stops time and the world’s keys behind the Fainting screen', () => {
    const { store } = starving();
    store.getState().advance(CLOCK.maxRealDeltaMs);
    const clock = store.getState().game.clock;

    store.getState().advance(CLOCK.maxRealDeltaMs);

    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.paused);
    expect(selectWorldKeysOff(store.getState())).toBe(true);
    expect(store.getState().game.clock).toEqual(clock);
  });

  it('moves the Character to the ward bed at once, and keeps them in the ward while the world catches up', () => {
    const { store } = starving();

    store.getState().advance(CLOCK.maxRealDeltaMs);
    // Until the world has moved them, the Character still stands where they collapsed.
    store.getState().enterPlace('park');

    expect(selectWardArrival(store.getState())).toEqual({ wokeInWardOnDay: 4 });
    expect(store.getState().game.placeId).toBe('clinic');
  });

  it('says when the bill became hospital debt, and the dock shows the debt next to the money', () => {
    const { store } = starving({ moneyInShifts: ECONOMY.faintingBillInShifts - 0.5 });

    store.getState().advance(CLOCK.maxRealDeltaMs);

    expect(selectFainting(store.getState())).toEqual({ billInShifts: ECONOMY.faintingBillInShifts, paid: false });
    expect(selectDebts(store.getState())).toEqual([{ kind: 'hospital', amountInShifts: ECONOMY.faintingBillInShifts }]);
    expect(selectMoneyInShifts(store.getState())).toBe(ECONOMY.faintingBillInShifts - 0.5);
  });

  it('saves the Character waking in the ward as the start of the new day', () => {
    const { store, written } = starving();

    store.getState().advance(CLOCK.maxRealDeltaMs);

    expect(written.at(-1)).toMatchObject({ game: { placeId: 'clinic', clock: { day: 4, minuteOfDay: CLOCK.faintWakeAt } }, startsDay: true });
  });
});

describe('the nurse, when the Character wakes from Fainting', () => {
  it('starts talking without the Player pressing E, once the Player wakes the Character', () => {
    const { store, npc } = starving();
    store.getState().advance(CLOCK.maxRealDeltaMs);
    expect(selectConversation(store.getState())).toBeNull();

    store.getState().wakeInWard();

    expect(selectFainting(store.getState())).toBeNull();
    expect(selectConversation(store.getState())).toMatchObject({ npcId: 'nurse', interaction: { id: 'wake-in-ward' } });
    expect(npc.session?.voice).toMatchObject({ npcId: 'nurse' });
    expect(npc.session?.openingScene).not.toBe(GREETING_SCENE);
  });

  it('waits with Help open, like any conversation', () => {
    const { store } = wokenInTheWard({ requestHints: async () => [] });

    store.getState().toggleHelp();

    expect(selectHelpOpen(store.getState())).toBe(true);
    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.paused);
  });

  it('can be left before the patient is seen home, at no cost', () => {
    const { store, npc } = wokenInTheWard();
    const game = store.getState().game;

    store.getState().leaveConversation();

    expect(selectConversation(store.getState())).toBeNull();
    expect(store.getState().game).toBe(game);
    expect(npc.closed).toBe(true);
  });

  it('ends like any Goal Interaction once the nurse lets the patient go home: closing card, then a Recap', () => {
    const recaps: RecapRequest[] = [];
    const { store, npc } = wokenInTheWard({ requestRecap: (request) => (recaps.push(request), new Promise(() => {})) });
    store.getState().sendTypedLine('大丈夫です');

    npc.calls('discharge_patient', { feeling: 'well' });
    npc.says('よかったです。お大事に。');

    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(selectClosingCard(store.getState())).toMatchObject({ kind: 'success' });
    expect(recaps).toEqual([expect.objectContaining({ conversation: expect.objectContaining({ interactionId: 'wake-in-ward' }) })]);
  });
});

describe('the ward conversation in the Journal', () => {
  it('is kept at the hospital, by its local name', async () => {
    const kept: NewJournalEntry[] = [];
    const journal: Journal = {
      append: async (_, entry) => (kept.push(entry), { ...entry, id: 'entry', writtenAt: '', schemaVersion: JOURNAL_SCHEMA_VERSION, noHelpNeeded: false }),
      list: async () => [],
      raw: async () => [],
      restore: async () => {},
      remove: async () => {},
    };
    const { store, npc } = wokenInTheWard({ journal, requestRecap: () => Promise.reject(new Error('no recap')) });
    store.getState().sendTypedLine('大丈夫です');
    npc.calls('discharge_patient', { feeling: 'well' });
    npc.says('お大事に。');

    await vi.waitFor(() => expect(kept).toHaveLength(1));
    expect(kept[0]).toMatchObject({ npcId: 'nurse', interactionId: 'wake-in-ward', placeName: CULTURE_PACKS.ja.hospital.name });
  });
});

describe('E on the nurse', () => {
  it('has nothing to say: only waking from Fainting starts the ward conversation', () => {
    const { store } = starving({ health: METER_MAX, hunger: METER_MAX, thirst: METER_MAX });
    store.getState().enterPlace('clinic');
    store.getState().setInteractable('nurse');

    store.getState().talk();

    expect(selectConversation(store.getState())).toBeNull();
    expect(selectToast(store.getState())).toEqual({ kind: 'nothingToSay', npcId: 'nurse' });
  });
});

describe('Fainting mid-conversation', () => {
  it('ends the conversation where the Character collapsed, then the nurse greets them in the ward', () => {
    const { store, npc } = starving({ health: 1 });
    store.getState().enterPlace('cafe');
    store.getState().setInteractable('barista');
    store.getState().talk();
    npc.says('いらっしゃいませ！');

    for (let i = 0; i < 1000 && !selectFainting(store.getState()); i++) store.getState().advance(CLOCK.maxRealDeltaMs);

    expect(selectFainting(store.getState())).not.toBeNull();
    expect(selectConversation(store.getState())).toBeNull();
    store.getState().wakeInWard();
    expect(selectConversation(store.getState())).toMatchObject({ npcId: 'nurse' });
  });
});

describe('Fainting on the tram', () => {
  it('shows the Fainting screen instead of getting off at the stop', () => {
    const { store } = starving();
    store.getState().enterPlace('tram-stop');
    store.getState().setInteractable('west-stop');
    store.getState().openTram();

    store.getState().rideTram('east-stop');

    expect(selectFainting(store.getState())).not.toBeNull();
    expect(selectTramArrival(store.getState())).toBeNull();
    expect(store.getState().game.placeId).toBe('clinic');
  });
});
