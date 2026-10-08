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
