import { describe, expect, it } from 'vitest';
import type { NpcSession } from '../ai/index.ts';
import { CLOCK, createSave } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import { createGameStore, DEV_SETUP, selectChatLines, selectConversation, selectTimeScale, selectTyping } from './index.ts';

/** A stand-in NPC the test speaks for, recording what the store sends it. */
function fakeVoice() {
  const fake = {
    session: null as NpcSession | null,
    events: null as VoiceSessionEvents | null,
    sent: [] as string[],
    closed: false,
    says(...pieces: string[]) {
      for (const piece of pieces) fake.events!.onOutputTranscript(piece);
      fake.events!.onTurnComplete();
    },
  };
  const open: OpenVoiceSession = (session, events) => {
    fake.session = session;
    fake.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: (text) => fake.sent.push(text),
      sendToolResponse: () => {},
      close: () => (fake.closed = true),
    };
  };
  return { fake, open };
}

function storeAtTheCounter() {
  const { fake, open } = fakeVoice();
  const store = createGameStore(createSave(DEV_SETUP), { openVoiceSession: open });
  store.getState().enterPlace('cafe');
  store.getState().setInteractable('barista');
  return { store, fake };
}

function talkingToTheBarista() {
  const { store, fake } = storeAtTheCounter();
  store.getState().talk();
  fake.says('いらっしゃいませ！');
  return { store, fake };
}

describe('talking to an NPC', () => {
  it('opens a conversation with the barista when in range', () => {
    const { store, fake } = storeAtTheCounter();

    store.getState().talk();

    expect(selectConversation(store.getState())).toMatchObject({ npcId: 'barista' });
    expect(fake.session?.voice).toEqual({ targetLanguage: DEV_SETUP.targetLanguage, npcId: 'barista' });
  });

  it('does nothing when no one is in range', () => {
    const { store, fake } = storeAtTheCounter();
    store.getState().setInteractable(null);

    store.getState().talk();

    expect(selectConversation(store.getState())).toBeNull();
    expect(fake.session).toBeNull();
  });

  it('shows the NPC speaking first, building each line from the pieces of its turn', () => {
    const { store, fake } = storeAtTheCounter();
    store.getState().talk();

    fake.says('いらっしゃいませ！', 'ご注文は？');
    fake.says('どうぞ。');

    expect(selectChatLines(store.getState())).toEqual([
      { speaker: 'npc', text: 'いらっしゃいませ！ご注文は？' },
      { speaker: 'npc', text: 'どうぞ。' },
    ]);
  });

  it('sends a typed line to the NPC and shows it as heard', () => {
    const { store, fake } = talkingToTheBarista();

    store.getState().sendTypedLine('  コーヒー ください ');
    fake.says('はい。');

    expect(fake.sent).toEqual(['コーヒー ください']);
    expect(selectChatLines(store.getState()).slice(1)).toEqual([
      { speaker: 'player', text: 'コーヒー ください', typed: true },
      { speaker: 'npc', text: 'はい。' },
    ]);
  });

  it('ignores an empty typed line', () => {
    const { store, fake } = talkingToTheBarista();

    store.getState().sendTypedLine('   ');

    expect(fake.sent).toEqual([]);
    expect(selectChatLines(store.getState())).toHaveLength(1);
  });

  it('runs the clock at the conversation scale while talking', () => {
    const normal = storeAtTheCounter().store;
    const { store } = talkingToTheBarista();
    const minuteBefore = (s: typeof store) => s.getState().game.clock.minuteOfDay;
    const normalStart = minuteBefore(normal);
    const talkingStart = minuteBefore(store);

    normal.getState().advance(CLOCK.maxRealDeltaMs);
    store.getState().advance(CLOCK.maxRealDeltaMs);

    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.conversation);
    expect(minuteBefore(store) - talkingStart).toBeCloseTo(
      (minuteBefore(normal) - normalStart) * CLOCK.timeScale.conversation,
    );
  });

  it('still stops the clock while the tab is hidden mid-conversation', () => {
    const { store } = talkingToTheBarista();
    store.getState().setTabHidden(true);

    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.paused);
  });

  it('leaving ends the session without changing any game state', () => {
    const { store, fake } = talkingToTheBarista();
    store.getState().sendTypedLine('コーヒー');
    store.getState().setTyping(true);
    const game = store.getState().game;

    store.getState().leaveConversation();
    fake.says('ありがとうございました。');

    expect(selectConversation(store.getState())).toBeNull();
    expect(selectTyping(store.getState())).toBe(false);
    expect(fake.closed).toBe(true);
    expect(store.getState().game).toBe(game);
    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.normal);
  });

  it('walking out of range ends the conversation without changing any game state', () => {
    const { store, fake } = talkingToTheBarista();
    const game = store.getState().game;

    store.getState().setInteractable(null);

    expect(selectConversation(store.getState())).toBeNull();
    expect(fake.closed).toBe(true);
    expect(store.getState().game).toBe(game);
  });
});
