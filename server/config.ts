// The one place for Gemini model IDs, voices and endpoint versions.
// Swapping a model is a change to this file only.

import type { Build, NamedNpcId } from '../src/content/index.ts';

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
  evalJudge: 'gemini-3.8-pro',
} as const;

// Every prebuilt voice the game uses, tagged with the build it suits. Voices are not language-specific.
export const VOICE_BUILDS = {
  Kore: 'feminine',
  Leda: 'feminine',
  Despina: 'feminine',
  Sulafat: 'feminine',
  Vindemiatrix: 'feminine',
  Gacrux: 'feminine',
  Achernar: 'feminine',
  Callirrhoe: 'feminine',
  Erinome: 'feminine',
  Puck: 'masculine',
  Sadachbia: 'masculine',
  Algieba: 'masculine',
  Iapetus: 'masculine',
  Achird: 'masculine',
  Algenib: 'masculine',
} as const satisfies Record<string, Build>;

export type VoiceName = keyof typeof VOICE_BUILDS;

// Each Named NPC's own voice, the same in every Culture Pack. It must suit the build of their look.
// First picks from Gemini's voice descriptions; tune by ear.
export const NAMED_NPC_VOICES: Record<NamedNpcId, VoiceName> = {
  landlord: 'Kore',
  'convenience-clerk': 'Leda',
  receptionist: 'Despina',
  doctor: 'Sulafat',
  nurse: 'Vindemiatrix',
  'park-regular-1': 'Gacrux',
  'park-regular-2': 'Achernar',
  attendant: 'Callirrhoe',
  'office-clerk': 'Erinome',
  barista: 'Puck',
  cashier: 'Sadachbia',
  server: 'Algieba',
  pharmacist: 'Iapetus',
  'park-regular-3': 'Achird',
  shopkeeper: 'Algenib',
};
