import { describe, expect, it } from 'vitest';
import type { ToolResponse } from '../ai/index.ts';
import { createSave } from '../sim/index.ts';
import {
  VoiceServiceUnavailableError,
  type OpenVoiceSession,
  type VoiceSessionEvents,
  type VoiceSessionOptions,
} from '../voice/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  selectCanTakeTurn,
  selectChatLines,
  selectClosingCard,
  selectConversation,
  selectConversationUsage,
  selectListening,
  selectMicLevel,
  selectReconnecting,
  selectToast,
  selectVoiceUnavailable,
} from './index.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

type FakeSession = {
  events: VoiceSessionEvents;
  options: VoiceSessionOptions | undefined;
  sent: string[];
  answers: ToolResponse[];
  talking: boolean;
  closed: boolean;
  connects: () => Promise<void>;
  failsToConnect: (error?: Error) => Promise<void>;
};

/**
 * Stand-in NPCs the test speaks for. Every session the store opens is kept, so
 * a test can drop one and watch the store open its replacement. Connecting
 * waits until the test says how it went.
 */
function fakeVoice() {
  const sessions: FakeSession[] = [];
  const open: OpenVoiceSession = (_, events, options) => {
    let settle: { resolve: () => void; reject: (error: Error) => void };
    const connecting = new Promise<void>((resolve, reject) => (settle = { resolve, reject }));
    const session: FakeSession = {
      events,
      options,
      sent: [],
      answers: [],
      talking: false,
      closed: false,
      connects: async () => {
        settle.resolve();
        await flush();
      },
      failsToConnect: async (error = new Error('socket closed before setup')) => {
        settle.reject(error);
        await flush();
      },
    };
    sessions.push(session);
    return {
      connect: () => connecting,
      startTalking: () => (session.talking = true),
      stopTalking: () => (session.talking = false),
      sendText: (text) => session.sent.push(text),
      sendToolResponse: (_id, response) => session.answers.push(response),
      close: () => (session.closed = true),
    };
  };
  const npc = {
    sessions,
    get latest() {
      return sessions.at(-1)!;
    },
    says: (...pieces: string[]) => {
      for (const piece of pieces) npc.latest.events.onOutputTranscript(piece);
      npc.latest.events.onTurnComplete();
    },
    hears: (...pieces: string[]) => {
      for (const piece of pieces) npc.latest.events.onInputTranscript(piece);
    },
  };
  return { npc, open };
}

async function talkingToTheBarista() {
  const { npc, open } = fakeVoice();
  const store = createGameStore(createSave(DEV_SETUP), { openVoiceSession: open });
  store.getState().enterPlace('cafe');
  store.getState().setInteractable('barista');
  store.getState().talk();
  await npc.latest.connects();
  npc.says('いらっしゃいませ！');
  return { store, npc };
}

describe('push-to-talk', () => {
  it('listens while held, and shows what the NPC heard as the Player’s line', async () => {
    const { store, npc } = await talkingToTheBarista();

    store.getState().startTalking();
    expect(selectListening(store.getState())).toBe(true);
    expect(npc.latest.talking).toBe(true);

    npc.hears('ラテ', 'ください');
    store.getState().stopTalking();

    expect(selectListening(store.getState())).toBe(false);
    expect(npc.latest.talking).toBe(false);
    expect(selectChatLines(store.getState())).toEqual([
      { speaker: 'npc', text: 'いらっしゃいませ！' },
      { speaker: 'player', text: 'ラテください' },
    ]);
  });

  it('keeps building the Player’s line from late pieces, even once the NPC has started answering', async () => {
    const { store, npc } = await talkingToTheBarista();

    store.getState().startTalking();
    npc.hears('ラテ');
    store.getState().stopTalking();
    npc.latest.events.onOutputTranscript('ラテですね。');
    npc.hears('ください');
    npc.latest.events.onTurnComplete();

    expect(selectChatLines(store.getState()).slice(1)).toEqual([
      { speaker: 'player', text: 'ラテください' },
      { speaker: 'npc', text: 'ラテですね。' },
    ]);
  });

  it('cuts the NPC off when the Player talks over it: what it says next is a new line', async () => {
    const { store, npc } = await talkingToTheBarista();
    npc.latest.events.onOutputTranscript('ご注文は');

    store.getState().startTalking();
    npc.hears('コーヒー');
    store.getState().stopTalking();
    npc.says('コーヒーですね。');

    expect(selectChatLines(store.getState()).slice(1)).toEqual([
      { speaker: 'npc', text: 'ご注文は' },
      { speaker: 'player', text: 'コーヒー' },
      { speaker: 'npc', text: 'コーヒーですね。' },
    ]);
  });

  it('starts a new Player line for each turn', async () => {
    const { store, npc } = await talkingToTheBarista();

    store.getState().startTalking();
    npc.hears('ラテ');
    store.getState().stopTalking();
    store.getState().startTalking();
    npc.hears('はい');
    store.getState().stopTalking();

    expect(selectChatLines(store.getState()).slice(1)).toEqual([
      { speaker: 'player', text: 'ラテ' },
      { speaker: 'player', text: 'はい' },
    ]);
  });

  it('shows the mic level only while listening', async () => {
    const { store, npc } = await talkingToTheBarista();

    store.getState().startTalking();
    npc.latest.events.onMicLevel(0.7);
    expect(selectMicLevel(store.getState())).toBe(0.7);

    store.getState().stopTalking();
    expect(selectMicLevel(store.getState())).toBe(0);
  });

  it('does nothing outside a conversation', () => {
    const { open } = fakeVoice();
    const store = createGameStore(createSave(DEV_SETUP), { openVoiceSession: open });

    store.getState().startTalking();

    expect(selectListening(store.getState())).toBe(false);
  });

  it('stops listening when the conversation ends mid-turn', async () => {
    const { store } = await talkingToTheBarista();
    store.getState().startTalking();

    store.getState().leaveConversation();

    expect(selectListening(store.getState())).toBe(false);
  });
});

describe('token usage', () => {
  it('adds up every turn of the conversation', async () => {
    const { store, npc } = await talkingToTheBarista();

    npc.latest.events.onUsage({ promptTokens: 900, responseTokens: 100, totalTokens: 1000 });
    npc.latest.events.onUsage({ promptTokens: 1000, responseTokens: 50, totalTokens: 1050 });

    expect(selectConversationUsage(store.getState())).toEqual({ promptTokens: 1900, responseTokens: 150, totalTokens: 2050 });
  });

  it('keeps counting across a reconnect', async () => {
    const { store, npc } = await talkingToTheBarista();
    npc.latest.events.onUsage({ promptTokens: 900, responseTokens: 100, totalTokens: 1000 });

    npc.latest.events.onDisconnect();
    await npc.latest.connects();
    npc.latest.events.onUsage({ promptTokens: 1200, responseTokens: 60, totalTokens: 1260 });

    expect(selectConversationUsage(store.getState())).toEqual({ promptTokens: 2100, responseTokens: 160, totalTokens: 2260 });
  });
});

describe('a dropped connection', () => {
  it('retries once with a fresh session, seeded with the conversation so far', async () => {
    const { store, npc } = await talkingToTheBarista();
    store.getState().sendTypedLine('ラテ');
    const dropped = npc.latest;

    dropped.events.onDisconnect();

    expect(npc.sessions).toHaveLength(2);
    expect(dropped.closed).toBe(true);
    expect(npc.latest.options?.resumeFrom).toEqual([
      { speaker: 'npc', text: 'いらっしゃいませ！' },
      { speaker: 'player', text: 'ラテ', typed: true },
    ]);
    expect(selectReconnecting(store.getState())).toBe(true);

    await npc.latest.connects();
    npc.says('お待たせしました。');

    expect(selectReconnecting(store.getState())).toBe(false);
    expect(selectChatLines(store.getState())).toEqual([
      { speaker: 'npc', text: 'いらっしゃいませ！' },
      { speaker: 'player', text: 'ラテ', typed: true },
      { speaker: 'npc', text: 'お待たせしました。' },
    ]);
  });

  it('ends a half-said NPC line, so the replacement session starts a new one', async () => {
    const { store, npc } = await talkingToTheBarista();
    npc.latest.events.onOutputTranscript('ご注文');

    npc.latest.events.onDisconnect();
    await npc.latest.connects();
    npc.says('お待たせしました。');

    expect(selectChatLines(store.getState()).slice(1)).toEqual([
      { speaker: 'npc', text: 'ご注文' },
      { speaker: 'npc', text: 'お待たせしました。' },
    ]);
  });

  it('ignores the old session once it has been replaced', async () => {
    const { store, npc } = await talkingToTheBarista();
    const dropped = npc.latest;
    dropped.events.onDisconnect();

    dropped.events.onOutputTranscript('もしもし');
    dropped.events.onDisconnect();

    expect(npc.sessions).toHaveLength(2);
    expect(selectChatLines(store.getState())).toHaveLength(1);
  });

  it('takes no turn from the Player until the fresh session has connected', async () => {
    const { store, npc } = await talkingToTheBarista();
    expect(selectCanTakeTurn(store.getState())).toBe(true);

    npc.latest.events.onDisconnect();
    expect(selectCanTakeTurn(store.getState())).toBe(false);
    await npc.latest.connects();

    expect(selectCanTakeTurn(store.getState())).toBe(true);
  });

  it('stops listening, and ignores typed lines, while reconnecting', async () => {
    const { store, npc } = await talkingToTheBarista();
    store.getState().startTalking();

    npc.latest.events.onDisconnect();
    store.getState().sendTypedLine('ラテ');
    store.getState().startTalking();

    expect(selectListening(store.getState())).toBe(false);
    expect(npc.latest.sent).toEqual([]);
    expect(selectChatLines(store.getState())).toHaveLength(1);
  });

  it('is a network abandonment when it drops again: no cost, no closing card, and a toast', async () => {
    const { store, npc } = await talkingToTheBarista();
    store.getState().sendTypedLine('asdf');
    npc.latest.events.onDisconnect();
    await npc.latest.connects();
    const game = store.getState().game;

    npc.latest.events.onDisconnect();

    expect(npc.sessions).toHaveLength(2);
    expect(npc.latest.closed).toBe(true);
    expect(selectConversation(store.getState())).toBeNull();
    expect(selectClosingCard(store.getState())).toBeNull();
    expect(store.getState().game).toBe(game);
    expect(selectToast(store.getState())).toEqual({ kind: 'npcSteppedAway', npcId: 'barista' });
  });

  it('is a network abandonment when the retry cannot connect, even for want of a token', async () => {
    const { store, npc } = await talkingToTheBarista();
    const game = store.getState().game;

    npc.latest.events.onDisconnect();
    await npc.latest.failsToConnect(new VoiceServiceUnavailableError('gateway answered 502'));

    expect(npc.sessions).toHaveLength(2);
    expect(selectConversation(store.getState())).toBeNull();
    expect(store.getState().game).toBe(game);
    expect(selectToast(store.getState())).toEqual({ kind: 'npcSteppedAway', npcId: 'barista' });
    expect(selectVoiceUnavailable(store.getState())).toBe(false);
  });

  it('retries when the first connection fails, and the conversation goes ahead if the retry works', async () => {
    const { npc, open } = fakeVoice();
    const store = createGameStore(createSave(DEV_SETUP), { openVoiceSession: open });
    store.getState().enterPlace('cafe');
    store.getState().setInteractable('barista');
    store.getState().talk();

    await npc.latest.failsToConnect();
    expect(npc.latest.options?.resumeFrom).toEqual([]);
    await npc.latest.connects();
    npc.says('いらっしゃいませ！');

    expect(selectChatLines(store.getState())).toEqual([{ speaker: 'npc', text: 'いらっしゃいませ！' }]);
    expect(selectToast(store.getState())).toBeNull();
  });

  it('shows the closing card if it drops during the goodbye, since the outcome already stands', async () => {
    const { store, npc } = await talkingToTheBarista();
    store.getState().sendTypedLine('はい');
    npc.latest.events.onToolCall({ id: 'call-1', name: 'serve_order', args: { items: [{ item: 'latte', quantity: 1 }] } });
    const game = store.getState().game;

    npc.latest.events.onDisconnect();

    expect(npc.sessions).toHaveLength(1);
    expect(selectClosingCard(store.getState())).toMatchObject({ kind: 'success' });
    expect(store.getState().game).toBe(game);
    expect(selectToast(store.getState())).toBeNull();
  });

  it('can dismiss the toast', async () => {
    const { store, npc } = await talkingToTheBarista();
    npc.latest.events.onDisconnect();
    await npc.latest.failsToConnect();

    store.getState().dismissToast();

    expect(selectToast(store.getState())).toBeNull();
  });
});

describe('when no token can be minted', () => {
  async function startTalkingWithoutVoice() {
    const { npc, open } = fakeVoice();
    const store = createGameStore(createSave(DEV_SETUP), { openVoiceSession: open });
    store.getState().enterPlace('cafe');
    store.getState().setInteractable('barista');
    const game = store.getState().game;
    store.getState().talk();
    await npc.latest.failsToConnect(new VoiceServiceUnavailableError('gateway unreachable'));
    return { store, npc, game };
  }

  it('shows the voice service unavailable screen instead of the conversation, at no cost', async () => {
    const { store, npc, game } = await startTalkingWithoutVoice();

    expect(selectVoiceUnavailable(store.getState())).toBe(true);
    expect(selectConversation(store.getState())).toBeNull();
    expect(store.getState().game).toBe(game);
    expect(npc.sessions).toHaveLength(1);
    expect(selectToast(store.getState())).toBeNull();
  });

  it('closes the screen when the Player dismisses it', async () => {
    const { store } = await startTalkingWithoutVoice();

    store.getState().dismissVoiceUnavailable();

    expect(selectVoiceUnavailable(store.getState())).toBe(false);
  });
});
