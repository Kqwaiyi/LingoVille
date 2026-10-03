import type { NewGameSetup } from './state.ts';

/** A New game setup for tests. Spread it and override the field a test cares about. */
export const TEST_SETUP: NewGameSetup = {
  characterName: 'Sam',
  targetLanguage: 'ja',
  culturePackId: 'ja',
  startingStep: 'A1',
  appearancePresetId: 'preset-1',
  rngSeed: 1,
};
