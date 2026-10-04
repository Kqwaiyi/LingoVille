import { GREETING_SCENE, RESUME_SCENE, type NpcSession } from '../ai/index.ts';
import { createBrowserAudio, openBrowserSocket } from './browserIo.ts';
import type { VoiceSession, VoiceSessionEvents, VoiceSessionOptions } from './voiceSession.ts';

/** What `/api/token` hands the browser: everything needed to open one Live session. */
export type LiveToken = { token: string; model: string; voiceName: string; url: string };

export type LiveSocket = { send(text: string): void; close(): void };
export type LiveSocketHandlers = {
  onOpen: () => void;
  /** One JSON message from the server, as text. */
  onMessage: (text: string) => void;
  onClose: (code: number, reason: string) => void;
};

/** The mic and the speakers. PCM travels as base64: 16 kHz in, 24 kHz out. */
export type LiveAudio = {
  /** Starts capturing. Each chunk is ~100 ms of 16 kHz PCM with its loudness (0–1). Rejects if the mic is denied. */
  startMic(onChunk: (pcm: string, level: number) => void): Promise<void>;
  /** Queues a chunk of the NPC's 24 kHz PCM to play straight after the last one. */
  play(pcm: string): void;
  /** Stops the NPC at once and drops anything queued. */
  stopPlayback(): void;
  /** Resolves once everything queued has been heard, or playback was stopped. */
  drained(): Promise<void>;
  close(): void;
};

/** The edges of the session: the socket and the audio. Tests stand in for both. */
export type LiveDeps = {
  openSocket: (url: string, handlers: LiveSocketHandlers) => LiveSocket;
  createAudio: () => LiveAudio;
};

const BROWSER_DEPS: LiveDeps = { openSocket: openBrowserSocket, createAudio: createBrowserAudio };

const SETUP_TIMEOUT_MS = 10_000;
const MIC_MIME_TYPE = 'audio/pcm;rate=16000';

// The parts of Live server messages the game uses.
type ServerMessage = {
  setupComplete?: object;
  serverContent?: {
    interrupted?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: { inlineData?: { data?: string } }[] };
    turnComplete?: boolean;
  };
  toolCall?: { functionCalls?: { id: string; name: string; args?: unknown }[] };
  usageMetadata?: { promptTokenCount?: number; responseTokenCount?: number; totalTokenCount?: number };
};

/** One Live content turn holding a line of text. */
const contentTurn = (role: 'user' | 'model', line: string) => ({ role, parts: [{ text: line }] });

/**
 * A conversation with a Gemini Live NPC: the only code that touches the socket.
 * Push-to-talk drives the turns (automatic activity detection is off), and
 * transcription runs both ways.
 */
export function openLiveSession(
  token: LiveToken,
  session: NpcSession,
  events: VoiceSessionEvents,
  options: VoiceSessionOptions = {},
  deps: LiveDeps = BROWSER_DEPS,
): VoiceSession {
  let socket: LiveSocket | null = null;
  let audio: LiveAudio | null = null;
  let connected = false;
  let closed = false;
  let listening = false;
  // The NPC is partway through a turn. If the Player cuts it off, the rest of
  // that turn still in flight is dropped until the server confirms the interruption.
  let npcSpeaking = false;
  let droppingCutOffTurn = false;
  // Settles a connect still in progress when the game closes the session.
  let abandonConnect: (() => void) | null = null;
  // Tool responses must name the function they answer.
  const toolNames = new Map<string, string>();

  const send = (message: unknown) => {
    if (connected && !closed) socket?.send(JSON.stringify(message));
  };

  const shutDown = () => {
    closed = true;
    listening = false;
    socket?.close();
    audio?.close();
  };

  const onMessage = (message: ServerMessage) => {
    if (message.usageMetadata) {
      // Each report covers one turn; the game adds them up.
      const { promptTokenCount = 0, responseTokenCount = 0, totalTokenCount = 0 } = message.usageMetadata;
      events.onUsage({ promptTokens: promptTokenCount, responseTokens: responseTokenCount, totalTokens: totalTokenCount });
    }
    for (const call of message.toolCall?.functionCalls ?? []) {
      toolNames.set(call.id, call.name);
      events.onToolCall({ id: call.id, name: call.name, args: call.args ?? {} });
    }
    const content = message.serverContent;
    if (!content) return;
    if (content.interrupted) {
      audio?.stopPlayback();
      npcSpeaking = false;
      droppingCutOffTurn = false;
    }
    if (content.inputTranscription?.text) events.onInputTranscript(content.inputTranscription.text);
    if (!droppingCutOffTurn) {
      if (content.outputTranscription?.text) {
        npcSpeaking = true;
        events.onOutputTranscript(content.outputTranscription.text);
      }
      for (const part of content.modelTurn?.parts ?? []) {
        if (!part.inlineData?.data) continue;
        npcSpeaking = true;
        audio?.play(part.inlineData.data);
      }
    }
    if (content.turnComplete) {
      npcSpeaking = false;
      droppingCutOffTurn = false;
      // The turn is over for the game once the Player has heard all of it.
      void audio?.drained().then(() => {
        if (!closed) events.onTurnComplete();
      });
    }
  };

  return {
    connect: () =>
      new Promise<void>((resolve, reject) => {
        if (closed) return resolve();
        const liveAudio = deps.createAudio();
        audio = liveAudio;
        // Without a mic the Typed Fallback still works, so a refusal doesn't stop the conversation.
        if (!options.typedOnly) {
          liveAudio
            .startMic((pcm, level) => {
              if (!listening) return;
              events.onMicLevel(level);
              send({ realtimeInput: { audio: { data: pcm, mimeType: MIC_MIME_TYPE } } });
            })
            .catch((error) => console.warn('[voice] no mic; only the typed reply works:', error));
        }

        const timeout = setTimeout(() => fail(new Error('Live setup timed out')), SETUP_TIMEOUT_MS);
        const settle = () => {
          clearTimeout(timeout);
          abandonConnect = null;
        };
        const fail = (error: Error) => {
          settle();
          shutDown();
          reject(error);
        };
        // Closed by the game before the setup completed: nothing failed, there's just nothing left to do.
        abandonConnect = () => {
          settle();
          resolve();
        };

        socket = deps.openSocket(`${token.url}?access_token=${encodeURIComponent(token.token)}`, {
          onOpen: () =>
            socket?.send(
              JSON.stringify({
                setup: {
                  model: `models/${token.model}`,
                  generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: token.voiceName } } },
                  },
                  systemInstruction: { parts: [{ text: session.systemInstruction }] },
                  tools: [{ functionDeclarations: session.tools }],
                  inputAudioTranscription: {},
                  outputAudioTranscription: {},
                  realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
                },
              }),
            ),
          onMessage: (raw) => {
            if (closed) return;
            let message: ServerMessage;
            try {
              message = JSON.parse(raw) as ServerMessage;
            } catch {
              return console.warn('[voice] unreadable Live frame:', raw.slice(0, 200));
            }
            if (connected) return onMessage(message);
            if (!message.setupComplete) return;
            settle();
            connected = true;
            const history = (options.resumeFrom ?? []).map((line) =>
              contentTurn(line.speaker === 'npc' ? 'model' : 'user', line.text),
            );
            const scene = history.length > 0 ? RESUME_SCENE : GREETING_SCENE;
            send({ clientContent: { turns: [...history, contentTurn('user', scene)], turnComplete: true } });
            resolve();
          },
          onClose: (code, reason) => {
            if (closed) return;
            if (!connected) return fail(new Error(`Live socket closed before setup: ${code} ${reason}`));
            shutDown();
            events.onDisconnect();
          },
        });
      }),

    startTalking: () => {
      if (!connected || closed || listening) return;
      audio?.stopPlayback();
      if (npcSpeaking) droppingCutOffTurn = true;
      listening = true;
      send({ realtimeInput: { activityStart: {} } });
    },
    stopTalking: () => {
      if (!listening) return;
      listening = false;
      events.onMicLevel(0);
      send({ realtimeInput: { activityEnd: {} } });
    },
    sendText: (line) => {
      if (!connected || closed) return;
      audio?.stopPlayback();
      send({ clientContent: { turns: [contentTurn('user', line)], turnComplete: true } });
    },
    sendToolResponse: (id, response) => {
      const name = toolNames.get(id);
      if (name === undefined) return;
      toolNames.delete(id);
      send({ toolResponse: { functionResponses: [{ id, name, response }] } });
    },
    close: () => {
      if (closed) return;
      abandonConnect?.();
      shutDown();
    },
  };
}

