import type { LookWeights } from './looks.ts';
import type { NewGameSetup } from './state.ts';

/** A New game setup for tests. Spread it and override the field a test cares about. */
export const TEST_SETUP: NewGameSetup = {
  characterName: 'Sam',
  targetLanguage: 'ja',
  culturePackId: 'ja',
  startingStep: 'A1',
  appearance: { hat: 'none', eyewear: 'none', neckwear: 'none', colour: 'denim' },
  skipFirstMorning: false,
  rngSeed: 1,
};

/** Pack weights for anonymous looks, for tests: both builds, and a few of each thing worn, in a couple of colours. */
export const TEST_LOOKS: LookWeights = {
  build: { masculine: 1, feminine: 1 },
  hat: { none: 1, beanie: 1, cap: 1 },
  eyewear: { none: 1, 'round-glasses': 1 },
  neckwear: { none: 1, scarf: 1, tie: 1 },
  colour: { teal: 1, mustard: 1 },
};
