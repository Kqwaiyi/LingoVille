// The one place for Gemini model IDs, voices and endpoint versions.
// Swapping a model is a change to this file only.

export const DEFAULT_GATEWAY_PORT = 8787;

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
export const GEMINI_LIVE_WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.';

export const ENDPOINT_VERSIONS = {
  authTokens: 'v1beta',
  live: 'v1beta',
  generateContent: 'v1beta',
} as const;

export const LIVE_ENDPOINT = 'GenerativeService.BidiGenerateContentConstrained';

export const MODELS = {
  live: 'gemini-3.8-live',
  recap: 'gemini-3.8-flash',
  annotate: 'gemini-3.8-flash-lite',
  hint: 'gemini-3.8-flash-lite',
  tts: 'gemini-3.8-flash-lite-tts',
  evalJudge: 'gemini-3.8-pro',
} as const;

export type TargetLanguage = 'ja' | 'zh' | 'en' | 'de';

// Default prebuilt voice per Target Language. Voices are not language-specific;
// these were picked by ear and can be overridden per NPC later.
export const VOICES: Record<TargetLanguage, string> = {
  ja: 'Kore',
  zh: 'Leda',
  en: 'Puck',
  de: 'Charon',
};
