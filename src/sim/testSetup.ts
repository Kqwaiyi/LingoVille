import type { LookWeights } from './looks.ts';
import type { NewGameSetup } from './state.ts';

/** A New game setup for tests. Spread it and override the field a test cares about. */
export const TEST_SETUP: NewGameSetup = {
  characterName: 'Sam',
  targetLanguage: 'ja',
  culturePackId: 'ja',
  startingStep: 'A1',
  appearance: { body: 'body-1', hairStyle: 'short', hairColour: 'dark-brown', skinTone: 'tone-3' },
  skipFirstMorning: false,
  rngSeed: 1,
};

/** Pack weights for anonymous looks, for tests: every body, a hair style or two for each, and a couple of colours and tones. */
export const TEST_LOOKS: LookWeights = {
  body: { 'body-1': 1, 'body-2': 1, 'body-3': 1, 'body-4': 1 },
  hairStyle: { 'body-1': { short: 1, bearded: 1 }, 'body-2': { short: 1, bearded: 1 }, 'body-3': { long: 1, buns: 1 }, 'body-4': { long: 1, buns: 1 } },
  hairColour: { black: 1, brown: 1 },
  skinTone: { 'tone-2': 1, 'tone-5': 1 },
};
