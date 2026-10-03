import type { NpcSession } from '../ai/index.ts';

/**
 * One live conversation with an NPC. UI, world and store depend only on this
 * interface: the real Gemini Live session (ticket 05) and the scripted mock
 * both implement it. Push-to-talk, open mic, tool calls, mic level and usage
 * join it with the real session.
 */
export interface VoiceSession {
  /** Connects, then the NPC speaks first. */
  connect(): Promise<void>;
  /** The Typed Fallback: sends one typed player turn. */
  sendText(text: string): void;
  /** Ends the session. No events fire after this. */
  close(): void;
}

export type VoiceSessionEvents = {
  /** A piece of what the NPC is saying. Pieces of one turn arrive in order. */
  onOutputTranscript: (text: string) => void;
  /** The NPC finished its turn. */
  onTurnComplete: () => void;
};

export type OpenVoiceSession = (session: NpcSession, events: VoiceSessionEvents) => VoiceSession;
