import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { describe, expect, it } from 'vitest';
import { buildNpcSession, type NpcSession, type Recap } from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS } from '../content/index.ts';
import { applyRecapEvidence, createSave, PROFICIENCY_STEP_TABLE, type GameState } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import { createGameStore, createJournal, DEV_SETUP, selectClosingCard, type GameStoreDeps } from './index.ts';
import { recordingSaves } from './testSaves.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const RECAP: Recap = { outcome: 'You ordered a hot latte.', corrections: [], newWords: [], cefrEstimate: 'B2' };

let databases = 0;

/** A store at the café counter, playing `game`, whose NPC the test speaks for and whose Recap arrives when the test says. */
function cafe(game: GameState = createSave(DEV_SETUP)) {
  const npc = {
    session: null as NpcSession | null,
    events: null as VoiceSessionEvents | null,
    says(text: string) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      npc.events!.onToolCall({ id: 'call', name, args });
    },
  };
  const openVoiceSession: OpenVoiceSession = (session, events) => {
    npc.session = session;
    npc.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: () => {},
      sendToolResponse: () => {},
      close: () => {},
    };
  };
  const recap: { arrives: (answer: Recap) => Promise<void>; fails: () => Promise<void> } = {
    arrives: async () => {},
    fails: async () => {},
  };
  const requestRecap: GameStoreDeps['requestRecap'] = () =>
    new Promise((resolve, reject) => {
      recap.arrives = async (answer) => {
        resolve(answer);
        await flush();
      };
      recap.fails = async () => {
        reject(new Error('recap_unavailable'));
        await flush();
      };
    });
  const { saves, written } = recordingSaves();
  const store = createGameStore(game, {
    openVoiceSession,
    requestRecap,
    saves,
    journal: createJournal(() => createStore(`proficiency-test-${++databases}`, 'entries')),
  });
  store.getState().enterPlace('cafe');
  store.getState().setInteractable('barista');
  return { store, npc, recap, written };
}

/** Orders a latte with the Typed Fallback, with one turn the barista can't make sense of, up to the closing card. */
function orderALatte(setup = cafe()) {
  const { store, npc } = setup;
  store.getState().talk();
  npc.says('いらっしゃいませ！');
  store.getState().sendTypedLine('ぐるる');
  npc.calls('not_understood', { reason: 'unintelligible' });
  npc.says('すみません、もう一度お願いします。');
  store.getState().sendTypedLine('ラテ ください');
  npc.says('ラテですね。よろしいですか？');
  store.getState().sendTypedLine('はい');
  npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
  npc.says('ありがとうございました。');
  return setup;
}

describe('Language Proficiency in play', () => {
  it('moves by the Recap’s evidence once the Recap arrives, counting the turns the NPC could not make sense of, and is saved', async () => {
    const setup = orderALatte();
    const { store, recap, written } = setup;
    const beforeRecap = store.getState().game;

    await recap.arrives(RECAP);

    const expected = applyRecapEvidence(beforeRecap, {
      cefrEstimate: RECAP.cefrEstimate,
      lines: [
        { speaker: 'npc', text: 'いらっしゃいませ！' },
        { speaker: 'player', text: 'ぐるる' },
        { speaker: 'npc', text: 'すみません、もう一度お願いします。' },
        { speaker: 'player', text: 'ラテ ください' },
        { speaker: 'npc', text: 'ラテですね。よろしいですか？' },
        { speaker: 'player', text: 'はい' },
        { speaker: 'npc', text: 'ありがとうございました。' },
      ],
      helpLog: [],
      notUnderstoodTurns: 1,
    });
    expect(store.getState().game.progression).toEqual(expected.progression);
    expect(store.getState().game.progression.proficiencyScore).toBeGreaterThan(beforeRecap.progression.proficiencyScore);
    expect(written.at(-1)?.game).toBe(store.getState().game);
  });

  it('is saved even when the Recap arrives after the next conversation has begun', async () => {
    const { store, npc, recap, written } = orderALatte();
    store.getState().skipRecap();
    store.getState().talk();
    npc.says('いらっしゃいませ！');

    await recap.arrives(RECAP);
    store.getState().saveNow();

    expect(written.at(-1)?.game.progression).toEqual(store.getState().game.progression);
    expect(written.at(-1)?.game.progression.evidenceSoFar).toBeGreaterThan(0);
  });

  it('stays as it was when no Recap can be written', async () => {
    const { store, recap } = orderALatte();
    const beforeRecap = store.getState().game;

    await recap.fails();

    expect(store.getState().game.progression).toEqual(beforeRecap.progression);
    expect(store.getState().game.proficiencyStep).toBe(beforeRecap.proficiencyStep);
  });

  it('builds the NPC from the current step, not the highest step reached', () => {
    const fresh = createSave(DEV_SETUP);
    const rusty: GameState = { ...fresh, proficiencyStep: 'A2', progression: { ...fresh.progression, highestStep: 'C1' } };
    const { store, npc } = cafe(rusty);

    store.getState().talk();

    expect(npc.session?.systemInstruction).toBe(
      buildNpcSession(INTERACTIONS.orderDrink, CULTURE_PACKS.ja, 'A2', NAMED_NPCS.barista, { clock: rusty.clock }).systemInstruction,
    );
  });

  it('starts Patience from the current step, not the highest step reached', () => {
    const fresh = createSave(DEV_SETUP);
    const rusty: GameState = { ...fresh, proficiencyStep: 'A2', progression: { ...fresh.progression, highestStep: 'C1' } };
    const { store, npc } = cafe(rusty);
    store.getState().talk();
    npc.says('いらっしゃいませ！');

    // As many turns not understood as a C1 NPC would put up with.
    for (let i = 0; i < PROFICIENCY_STEP_TABLE.C1.startingPatience; i++) {
      store.getState().sendTypedLine('ぐるる');
      npc.calls('not_understood', { reason: 'unintelligible' });
    }

    expect(PROFICIENCY_STEP_TABLE.A2.startingPatience).toBeGreaterThan(PROFICIENCY_STEP_TABLE.C1.startingPatience);
    expect(store.getState().conversation?.outcome).toBeNull();
    expect(selectClosingCard(store.getState())).toBeNull();
  });
});
