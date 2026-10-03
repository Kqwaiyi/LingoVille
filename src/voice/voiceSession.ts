import type { NpcSession, ToolResponse } from '../ai/index.ts';

/** The NPC calling one of the session's tools. The game answers with `sendToolResponse`. */
export type ToolCall = { id: string; name: string; args: unknown };

/** One line of the conversation so far, used to seed a session that replaces a dropped one. */
export type TranscriptLine = { speaker: 'npc' | 'player'; text: string };

/** Tokens one NPC turn cost. The game adds them up per conversation. */
export type TokenUsage = { promptTokens: number; responseTokens: number; totalTokens: number };

export const NO_USAGE: TokenUsage = { promptTokens: 0, responseTokens: 0, totalTokens: 0 };

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    responseTokens: a.responseTokens + b.responseTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/** No token could be minted, so voice can't work at all: the gateway is down, has no key, or Gemini refused. */
export class VoiceServiceUnavailableError extends Error {
  constructor(reason: string) {
    super(`Voice service unavailable: ${reason}`);
    this.name = 'VoiceServiceUnavailableError';
  }
}

/**
 * One live conversation with an NPC. UI, world and store depend only on this
 * interface: the real Gemini Live session and the scripted mock both implement it.
 */
export interface VoiceSession {
  /**
   * Connects, then the NPC speaks first (or, when resuming, carries on).
   * Rejects with `VoiceServiceUnavailableError` when no token can be minted,
   * and with another error when the connection itself fails.
   */
  connect(): Promise<void>;
  /** Push-to-talk pressed: interrupts the NPC if it is speaking and starts listening. */
  startTalking(): void;
  /** Push-to-talk released: the Player's turn is over. */
  stopTalking(): void;
  /** The Typed Fallback: sends one typed player turn. Also carries "[SCENE: ...]" notes from the game. */
  sendText(text: string): void;
  /** Answers a tool call; the NPC carries on from the answer. */
  sendToolResponse(id: string, response: ToolResponse): void;
  /** Ends the session. No events fire after this. */
  close(): void;
}

export type VoiceSessionEvents = {
  /** A piece of what the NPC is saying. Pieces of one turn arrive in order. */
  onOutputTranscript: (text: string) => void;
  /** A piece of what the NPC heard the Player say. Pieces of one turn arrive in order. */
  onInputTranscript: (text: string) => void;
  /** The NPC finished its turn, and has finished saying it out loud. */
  onTurnComplete: () => void;
  /** The NPC called a tool, and waits for the answer before it goes on. */
  onToolCall: (call: ToolCall) => void;
  /** How loud the Player is while listening, from 0 to 1. Drops to 0 when they stop. */
  onMicLevel: (level: number) => void;
  /** What the NPC's latest turn cost. */
  onUsage: (usage: TokenUsage) => void;
  /** The connection dropped after `connect` succeeded. The session is dead; no events follow. */
  onDisconnect: () => void;
};

export type VoiceSessionOptions = {
  /** The conversation so far, when this session replaces one that dropped. The NPC doesn't greet again. */
  resumeFrom?: TranscriptLine[];
};

export type OpenVoiceSession = (session: NpcSession, events: VoiceSessionEvents, options?: VoiceSessionOptions) => VoiceSession;
