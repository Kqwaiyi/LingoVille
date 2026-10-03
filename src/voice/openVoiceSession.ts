import type { VoiceRequest } from '../ai/index.ts';
import { openLiveSession, type LiveToken } from './liveSession.ts';
import { openMockVoiceSession } from './mockVoiceSession.ts';
import { VoiceServiceUnavailableError, type OpenVoiceSession, type VoiceSession } from './voiceSession.ts';

type TokenResponse = LiveToken & { mock: boolean };

/** Asks the gateway for a one-use token. Every failure here means voice can't work at all. */
async function mintToken(voice: VoiceRequest): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice }),
    });
  } catch (error) {
    throw new VoiceServiceUnavailableError(`gateway unreachable (${error instanceof Error ? error.message : error})`);
  }
  if (!res.ok) throw new VoiceServiceUnavailableError(`gateway answered ${res.status}`);
  return (await res.json()) as TokenResponse;
}

/**
 * The session the game uses: each connect mints a fresh token from the gateway,
 * then talks to Gemini Live, or to the scripted fake NPC when the gateway is in mock mode.
 */
export const openVoiceSession: OpenVoiceSession = (session, events, options) => {
  let inner: VoiceSession | null = null;
  let closed = false;

  return {
    connect: async () => {
      const token = await mintToken(session.voice);
      if (closed) return;
      inner = token.mock ? openMockVoiceSession(session, events, options) : openLiveSession(token, session, events, options);
      await inner.connect();
    },
    startTalking: () => inner?.startTalking(),
    stopTalking: () => inner?.stopTalking(),
    sendText: (text) => inner?.sendText(text),
    sendToolResponse: (id, response) => inner?.sendToolResponse(id, response),
    close: () => {
      closed = true;
      inner?.close();
    },
  };
};
