import { createStore, get, set, type UseStore } from 'idb-keyval';
import type { VoiceRequest } from '../ai/index.ts';
import type { LanguageCode } from '../sim/index.ts';
import { createBrowserAudio } from './browserIo.ts';
import type { LiveAudio } from './liveSession.ts';
import type { SpokenTurn } from './voiceSession.ts';

/** A phrase said aloud: base64 16-bit mono PCM. */
export type HearItSaidClip = { audio: string; sampleRate: number };

/** Where clips are kept between plays. */
export type ClipCache = {
  get(key: string): Promise<HearItSaidClip | undefined>;
  set(key: string, clip: HearItSaidClip): Promise<void>;
};

export type HearItSaidDeps = {
  fetch: typeof globalThis.fetch;
  cache: ClipCache;
  play: (clip: HearItSaidClip) => void;
};

/**
 * Says a phrase aloud in the voice for its language, or, given an NPC's `voice`, in theirs. Rejects if the gateway
 * can't say it.
 */
export type HearItSaid = (text: string, targetLanguage: LanguageCode, voice?: VoiceRequest) => Promise<void>;

/**
 * The cache key for a clip: a hash of the text and the voice. The gateway picks the voice, by language or by the
 * NPC, so what it was asked for stands for the voice here.
 */
async function clipKey(text: string, targetLanguage: LanguageCode, voice: VoiceRequest | undefined) {
  const who = !voice ? targetLanguage : `${targetLanguage}:${voice.npcId}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${who}\n${text}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createHearItSaid(deps: HearItSaidDeps): HearItSaid {
  return async (text, targetLanguage, voice) => {
    const key = await clipKey(text, targetLanguage, voice);
    let clip = await deps.cache.get(key);
    if (!clip) {
      const res = await deps.fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage, ...(voice && { voice }) }),
      });
      if (!res.ok) throw new Error(`Hear-it-said unavailable: the gateway answered ${res.status}`);
      clip = (await res.json()) as HearItSaidClip;
      await deps.cache.set(key, clip);
    }
    deps.play(clip);
  };
}

// The clip cache is its own IndexedDB database, apart from saves, and is never exported.
let clipStore: UseStore | null = null;
const clips = () => (clipStore ??= createStore('insomniacs-hear-it-said', 'clips'));
const idbClipCache: ClipCache = {
  get: (key) => get(key, clips()),
  set: (key, clip) => set(key, clip, clips()),
};

// One speaker for every clip and every replayed line, so a new phrase cuts off the last one.
let speaker: LiveAudio | null = null;
function playClip(clip: HearItSaidClip) {
  speaker ??= createBrowserAudio();
  speaker.stopPlayback();
  speaker.play(clip.audio);
}

/** Plays an NPC's line again just as they said it, from the audio of their turn. */
export function replaySpoken(spoken: SpokenTurn) {
  speaker ??= createBrowserAudio();
  speaker.stopPlayback();
  for (const chunk of spoken) speaker.play(chunk);
}

/** Hear-it-said in the browser: clips come from `/api/tts` and are cached in IndexedDB. */
export const hearItSaid: HearItSaid = createHearItSaid({
  fetch: (...args) => globalThis.fetch(...args),
  cache: idbClipCache,
  play: playClip,
});
