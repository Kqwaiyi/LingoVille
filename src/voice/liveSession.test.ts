import { describe, expect, it, vi } from 'vitest';
import { buildNpcSession, GREETING_SCENE, RESUME_SCENE, type NpcSession } from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS } from '../content/index.ts';
import { openLiveSession, type LiveAudio, type LiveDeps, type LiveSocketHandlers, type LiveToken } from './liveSession.ts';
import type { TokenUsage, ToolCall, TranscriptLine, VoiceSessionEvents } from './voiceSession.ts';

const npcSession = buildNpcSession(INTERACTIONS.orderDrink, CULTURE_PACKS.de, 'A1', NAMED_NPCS.barista, {
  clock: { day: 1, minuteOfDay: 420 },
});

const TOKEN: LiveToken = {
  token: 'auth_tokens/one use',
  model: 'gemini-live-test',
  voiceName: 'Charon',
  url: 'wss://example.test/ws/Live.Constrained',
};

/** Stands in for Gemini's end of the socket: records what the session sends, and says things back. */
function fakeServer() {
  const server = {
    url: null as string | null,
    sent: [] as Record<string, unknown>[],
    closedByClient: false,
    handlers: null as LiveSocketHandlers | null,
    open: () => server.handlers!.onOpen(),
    says: (message: unknown) => server.handlers!.onMessage(JSON.stringify(message)),
    drops: () => server.handlers!.onClose(1006, 'abnormal closure'),
    /** The client messages after setup, without the audio stream. */
    get conversation() {
      return server.sent.filter((m) => !('setup' in m) && !(m.realtimeInput as { audio?: unknown } | undefined)?.audio);
    },
  };
  const openSocket: LiveDeps['openSocket'] = (url, handlers) => {
    server.url = url;
    server.handlers = handlers;
    return {
      send: (text) => server.sent.push(JSON.parse(text)),
      close: () => (server.closedByClient = true),
    };
  };
  return { server, openSocket };
}

/** Stands in for the speakers and the mic. Playback only finishes when the test says so. */
function fakeAudio({ micAllowed = true } = {}) {
  const audio = {
    played: [] as string[],
    stoppedPlayback: 0,
    closed: false,
    micAsked: 0,
    onChunk: null as ((pcm: string, level: number) => void) | null,
    drainWaiters: [] as (() => void)[],
    playing: false,
    /** The Player says something into the mic: one ~100 ms chunk. */
    speaks: (pcm: string, level: number) => audio.onChunk?.(pcm, level),
    finishesPlaying: () => {
      audio.playing = false;
      for (const done of audio.drainWaiters.splice(0)) done();
    },
  };
  const live: LiveAudio = {
    startMic: async (onChunk) => {
      audio.micAsked++;
      if (!micAllowed) throw new DOMException('Permission denied', 'NotAllowedError');
      audio.onChunk = onChunk;
    },
    play: (pcm) => {
      audio.played.push(pcm);
      audio.playing = true;
    },
    stopPlayback: () => {
      audio.stoppedPlayback++;
      audio.finishesPlaying();
    },
    drained: () => (audio.playing ? new Promise<void>((resolve) => audio.drainWaiters.push(resolve)) : Promise.resolve()),
    close: () => (audio.closed = true),
  };
  return { audio, createAudio: () => live };
}

/** Everything the session told the game, in order. */
function listen() {
  const heard: string[] = [];
  const toolCalls: ToolCall[] = [];
  const usage: TokenUsage[] = [];
  const micLevels: number[] = [];
  let disconnects = 0;
  let micUnavailable = 0;
  const events: VoiceSessionEvents = {
    onOutputTranscript: (text) => heard.push(`npc: ${text}`),
    onInputTranscript: (text) => heard.push(`player: ${text}`),
    onTurnComplete: () => heard.push('turn complete'),
    onToolCall: (call) => toolCalls.push(call),
    onMicLevel: (level) => micLevels.push(level),
    onMicUnavailable: () => micUnavailable++,
    onUsage: (u) => usage.push(u),
    onDisconnect: () => disconnects++,
  };
  return {
    heard,
    toolCalls,
    usage,
    micLevels,
    get disconnects() {
      return disconnects;
    },
    get micUnavailable() {
      return micUnavailable;
    },
    events,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function connected({
  resumeFrom,
  micAllowed,
  typedOnly,
  openMic,
  session: forNpc = npcSession,
}: { resumeFrom?: TranscriptLine[]; micAllowed?: boolean; typedOnly?: boolean; openMic?: boolean; session?: NpcSession } = {}) {
  const { server, openSocket } = fakeServer();
  const { audio, createAudio } = fakeAudio({ micAllowed });
  const game = listen();
  const session = openLiveSession(TOKEN, forNpc, game.events, { resumeFrom, typedOnly, openMic }, { openSocket, createAudio });
  const connecting = session.connect();
  await flush();
  server.open();
  server.says({ setupComplete: {} });
  await connecting;
  return { server, audio, game, session };
}

describe('Live VoiceSession', () => {
  it('connects with the one-use token and sets the NPC up for push-to-talk with transcripts both ways', async () => {
    const { server } = await connected();

    expect(server.url).toBe(`${TOKEN.url}?access_token=auth_tokens%2Fone%20use`);
    expect(server.sent[0]).toEqual({
      setup: {
        model: 'models/gemini-live-test',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
        },
        systemInstruction: { parts: [{ text: npcSession.systemInstruction }] },
        tools: [{ functionDeclarations: npcSession.tools }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
      },
    });
  });

  it('asks the NPC to greet first once the setup is complete', async () => {
    const { server } = await connected();

    expect(server.conversation).toEqual([
      { clientContent: { turns: [{ role: 'user', parts: [{ text: GREETING_SCENE }] }], turnComplete: true } },
    ]);
  });

  it('opens with the NPC approaching instead, when the NPC starts the conversation', async () => {
    const nurse = buildNpcSession(INTERACTIONS.wakeInWard, CULTURE_PACKS.de, 'A1', NAMED_NPCS.nurse, {
      clock: { day: 2, minuteOfDay: 480 },
      approach: 'nurseOnWaking',
    });
    const { server } = await connected({ session: nurse });

    expect(server.conversation).toEqual([
      { clientContent: { turns: [{ role: 'user', parts: [{ text: nurse.openingScene }] }], turnComplete: true } },
    ]);
    expect(nurse.openingScene).not.toBe(GREETING_SCENE);
  });

  it('only finishes connecting once the setup is complete', async () => {
    const { server, openSocket } = fakeServer();
    const session = openLiveSession(TOKEN, npcSession, listen().events, {}, { openSocket, createAudio: fakeAudio().createAudio });
    let done = false;
    const connecting = session.connect().then(() => (done = true));
    await flush();

    server.open();
    await flush();
    expect(done).toBe(false);

    server.says({ setupComplete: {} });
    await connecting;
    expect(done).toBe(true);
  });

  it('fails to connect when the socket closes before the setup completes', async () => {
    const { server, openSocket } = fakeServer();
    const game = listen();
    const session = openLiveSession(TOKEN, npcSession, game.events, {}, { openSocket, createAudio: fakeAudio().createAudio });
    const connecting = session.connect();
    await flush();

    server.drops();

    await expect(connecting).rejects.toThrow();
    // A failed connect is not a drop: the game hears about it from connect.
    expect(game.disconnects).toBe(0);
  });

  it('settles a connect in progress when it is closed, without waiting for the setup timeout', async () => {
    vi.useFakeTimers();
    try {
      const { server, openSocket } = fakeServer();
      const { audio, createAudio } = fakeAudio();
      const closes = vi.fn(() => (audio.closed = true));
      const session = openLiveSession(TOKEN, npcSession, listen().events, {}, {
        openSocket,
        createAudio: () => ({ ...createAudio(), close: closes }),
      });
      const connecting = session.connect();
      server.open();

      session.close();
      await vi.runAllTimersAsync();

      await expect(connecting).resolves.toBeUndefined();
      expect(closes).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('seeds a replacement session with the conversation so far, and the NPC carries on rather than greeting', async () => {
    const { server } = await connected({
      resumeFrom: [
        { speaker: 'npc', text: 'Hallo! Was darf’s sein?' },
        { speaker: 'player', text: 'Kaffee bitte' },
      ],
    });

    expect(server.conversation).toEqual([
      {
        clientContent: {
          turns: [
            { role: 'model', parts: [{ text: 'Hallo! Was darf’s sein?' }] },
            { role: 'user', parts: [{ text: 'Kaffee bitte' }] },
            { role: 'user', parts: [{ text: RESUME_SCENE }] },
          ],
          turnComplete: true,
        },
      },
    ]);
  });

  it('plays what the NPC says and passes on its transcript, finishing the turn once it has been heard', async () => {
    const { server, audio, game } = await connected();

    server.says({ serverContent: { outputTranscription: { text: 'Hallo! ' } } });
    server.says({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'AAAA' } }] } } });
    server.says({ serverContent: { outputTranscription: { text: 'Was darf’s sein?' } } });
    server.says({ serverContent: { turnComplete: true } });
    await flush();

    expect(audio.played).toEqual(['AAAA']);
    expect(game.heard).toEqual(['npc: Hallo! ', 'npc: Was darf’s sein?']);

    audio.finishesPlaying();
    await flush();
    expect(game.heard.at(-1)).toBe('turn complete');
  });

  it('streams the mic only while the Player holds push-to-talk, and passes on what the NPC heard', async () => {
    const { server, audio, game, session } = await connected();
    audio.speaks('before', 0.1);

    session.startTalking();
    audio.speaks('PCM1', 0.4);
    audio.speaks('PCM2', 0.6);
    session.stopTalking();
    audio.speaks('after', 0.2);
    server.says({ serverContent: { inputTranscription: { text: 'Kaffee ' } } });
    server.says({ serverContent: { inputTranscription: { text: 'bitte' } } });

    const audioSent = server.sent.flatMap((m) => {
      const input = m.realtimeInput as { audio?: { data: string; mimeType: string } } | undefined;
      return input?.audio ? [input.audio] : [];
    });
    expect(audioSent).toEqual([
      { data: 'PCM1', mimeType: 'audio/pcm;rate=16000' },
      { data: 'PCM2', mimeType: 'audio/pcm;rate=16000' },
    ]);
    expect(server.conversation.slice(1)).toEqual([{ realtimeInput: { activityStart: {} } }, { realtimeInput: { activityEnd: {} } }]);
    expect(game.micLevels).toEqual([0.4, 0.6, 0]);
    expect(game.heard).toEqual(['player: Kaffee ', 'player: bitte']);
  });

  it('with open mic, turns automatic activity detection on and streams the mic from connect, pausing it only while told to', async () => {
    const { server, audio, game, session } = await connected({ openMic: true });

    audio.speaks('PCM1', 0.4);
    session.stopTalking();
    audio.speaks('waiting', 0.5);
    session.startTalking();
    audio.speaks('PCM2', 0.6);

    expect((server.sent[0]!.setup as { realtimeInputConfig: unknown }).realtimeInputConfig).toEqual({
      automaticActivityDetection: { disabled: false },
    });
    const audioSent = server.sent.flatMap((m) => {
      const input = m.realtimeInput as { audio?: { data: string } } | undefined;
      return input?.audio ? [input.audio.data] : [];
    });
    expect(audioSent).toEqual(['PCM1', 'PCM2']);
    // No activity signals: detection says when the Player speaks.
    expect(server.conversation.slice(1)).toEqual([]);
    expect(game.micLevels).toEqual([0.4, 0, 0.6]);
  });

  it('with open mic, keeps what the NPC says after the server says the Player cut in', async () => {
    const { server, audio, game } = await connected({ openMic: true });
    server.says({ serverContent: { outputTranscription: { text: 'Hallo! ' }, modelTurn: { parts: [{ inlineData: { data: 'HI' } }] } } });

    server.says({ serverContent: { interrupted: true } });
    server.says({ serverContent: { outputTranscription: { text: 'Kaffee, gern.' }, modelTurn: { parts: [{ inlineData: { data: 'REPLY' } }] } } });

    expect(game.heard).toEqual(['npc: Hallo! ', 'npc: Kaffee, gern.']);
    expect(audio.played).toEqual(['HI', 'REPLY']);
  });

  it('stops the NPC mid-sentence when the Player starts talking over it', async () => {
    const { server, audio, game, session } = await connected();
    server.says({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAAA' } }] } } });

    session.startTalking();
    server.says({ serverContent: { interrupted: true } });

    expect(audio.stoppedPlayback).toBeGreaterThanOrEqual(1);
    expect(audio.playing).toBe(false);
    expect(game.heard).toEqual([]);
  });

  it('drops what is left of a cut-off NPC turn, but not the reply to the Player', async () => {
    const { server, audio, game, session } = await connected();
    server.says({ serverContent: { outputTranscription: { text: 'Hallo! ' } } });

    session.startTalking();
    server.says({ serverContent: { outputTranscription: { text: 'Was darf’s' }, modelTurn: { parts: [{ inlineData: { data: 'LATE' } }] } } });
    server.says({ serverContent: { interrupted: true } });
    session.stopTalking();
    server.says({ serverContent: { outputTranscription: { text: 'Kaffee, gern.' }, modelTurn: { parts: [{ inlineData: { data: 'REPLY' } }] } } });

    expect(game.heard).toEqual(['npc: Hallo! ', 'npc: Kaffee, gern.']);
    expect(audio.played).toEqual(['REPLY']);
  });

  it('ignores a frame it cannot read', async () => {
    const { server, game } = await connected();

    server.handlers!.onMessage('not json');
    server.says({ serverContent: { outputTranscription: { text: 'Hallo!' } } });

    expect(game.heard).toEqual(['npc: Hallo!']);
  });

  it('stops the NPC when the server says it was interrupted', async () => {
    const { server, audio } = await connected();
    server.says({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAAA' } }] } } });

    server.says({ serverContent: { interrupted: true } });

    expect(audio.playing).toBe(false);
  });

  it('still connects without a mic, so the Typed Fallback works', async () => {
    const { server, session } = await connected({ micAllowed: false });

    session.sendText('Kaffee bitte');

    expect(server.conversation.at(-1)).toEqual({
      clientContent: { turns: [{ role: 'user', parts: [{ text: 'Kaffee bitte' }] }], turnComplete: true },
    });
  });

  it('tells the game when the mic is refused or missing', async () => {
    const { game } = await connected({ micAllowed: false });

    expect(game.micUnavailable).toBe(1);
  });

  it('in the Typed Fallback, never asks for the mic', async () => {
    const { server, audio, session } = await connected({ typedOnly: true });

    session.sendText('Kaffee bitte');

    expect(audio.micAsked).toBe(0);
    expect(server.conversation.at(-1)).toEqual({
      clientContent: { turns: [{ role: 'user', parts: [{ text: 'Kaffee bitte' }] }], turnComplete: true },
    });
  });

  it('sends a typed line as a whole player turn, stopping the NPC if it is still talking', async () => {
    const { server, audio, session } = await connected();
    server.says({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAAA' } }] } } });

    session.sendText('Kaffee bitte');

    expect(audio.playing).toBe(false);
    expect(server.conversation.at(-1)).toEqual({
      clientContent: { turns: [{ role: 'user', parts: [{ text: 'Kaffee bitte' }] }], turnComplete: true },
    });
  });

  it('passes on tool calls and answers them by id and name', async () => {
    const { server, game, session } = await connected();

    server.says({
      toolCall: { functionCalls: [{ id: 'call-1', name: 'serve_order', args: { items: [{ item: 'coffee', quantity: 1 }] } }] },
    });
    session.sendToolResponse('call-1', { result: 'served' });

    expect(game.toolCalls).toEqual([{ id: 'call-1', name: 'serve_order', args: { items: [{ item: 'coffee', quantity: 1 }] } }]);
    expect(server.conversation.at(-1)).toEqual({
      toolResponse: { functionResponses: [{ id: 'call-1', name: 'serve_order', response: { result: 'served' } }] },
    });
  });

  it('reports the token usage of each turn', async () => {
    const { server, game } = await connected();

    server.says({ usageMetadata: { promptTokenCount: 900, responseTokenCount: 120, totalTokenCount: 1020 } });
    server.says({ usageMetadata: { promptTokenCount: 1000, responseTokenCount: 80, totalTokenCount: 1080 } });

    expect(game.usage).toEqual([
      { promptTokens: 900, responseTokens: 120, totalTokens: 1020 },
      { promptTokens: 1000, responseTokens: 80, totalTokens: 1080 },
    ]);
  });

  it('reports a dropped connection once, and says nothing after it', async () => {
    const { server, audio, game } = await connected();

    server.drops();
    server.drops();
    server.says({ serverContent: { outputTranscription: { text: 'Hallo?' } } });

    expect(game.disconnects).toBe(1);
    expect(game.heard).toEqual([]);
    expect(audio.closed).toBe(true);
  });

  it('closing ends the session quietly, even with a goodbye still playing', async () => {
    const { server, audio, game, session } = await connected();
    server.says({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAAA' } }] }, turnComplete: true } });

    session.close();
    server.drops();
    audio.finishesPlaying();
    await flush();

    expect(server.closedByClient).toBe(true);
    expect(audio.closed).toBe(true);
    expect(game.heard).toEqual([]);
    expect(game.disconnects).toBe(0);
  });
});
