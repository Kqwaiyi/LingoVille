import type { NpcSession, ToolResponse } from '../ai/index.ts';

/** The NPC calling one of the session's tools. The game answers with `sendToolResponse`. */
export type ToolCall = { id: string; name: string; args: unknown };

/**
 * One live conversation with an NPC. UI, world and store depend only on this
 * interface: the real Gemini Live session (ticket 05) and the scripted mock
 * both implement it. Push-to-talk, open mic, mic level and usage join it with
 * the real session.
 */
export interface VoiceSession {
  /** Connects, then the NPC speaks first. */
  connect(): Promise<void>;
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
  /** The NPC finished its turn. */
  onTurnComplete: () => void;
  /** The NPC called a tool, and waits for the answer before it goes on. */
  onToolCall: (call: ToolCall) => void;
};

export type OpenVoiceSession = (session: NpcSession, events: VoiceSessionEvents) => VoiceSession;
