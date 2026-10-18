import type { AppearancePreset } from '../content/index.ts';
import { seedRng } from './rng.ts';
import { NEW_GAME, type ProficiencyStep, type StartingStep } from './tuning.ts';

/** A Target Language, and the id of the Culture Pack set where it's spoken. */
export const LANGUAGE_CODES = ['ja', 'zh', 'en', 'de'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** The town's 11 places. The Character is always at one of them. */
export const PLACE_IDS = [
  'home',
  'cafe',
  'supermarket',
  'convenience-store',
  'restaurant',
  'clinic',
  'park',
  'tram-stop',
  'bookshop',
  'bathhouse',
  'town-office',
] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

/** The setup a new game is built from. */
export type NewGameSetup = {
  characterName: string;
  targetLanguage: LanguageCode;
  culturePackId: LanguageCode;
  startingStep: StartingStep;
  appearance: AppearancePreset;
  rngSeed: number;
};

export type GameState = {
  rngState: number;
  identity: {
    characterName: string;
    targetLanguage: LanguageCode;
    culturePackId: LanguageCode;
    appearance: AppearancePreset;
  };
  clock: { day: number; minuteOfDay: number };
  /** The Character's current place. Positions live in the world, not here. */
  placeId: PlaceId;
  character: {
    /** Money is held in Shifts of base pay; the Culture Pack converts it to local currency. */
    moneyInShifts: number;
  };
  /** The current step. */
  proficiencyStep: ProficiencyStep;
};

/** Builds the state for a new game. */
export function createSave(setup: NewGameSetup): GameState {
  return {
    rngState: seedRng(setup.rngSeed),
    identity: {
      characterName: setup.characterName,
      targetLanguage: setup.targetLanguage,
      culturePackId: setup.culturePackId,
      appearance: setup.appearance,
    },
    clock: { day: NEW_GAME.day, minuteOfDay: NEW_GAME.minuteOfDay },
    placeId: 'home',
    character: { moneyInShifts: NEW_GAME.moneyInShifts },
    proficiencyStep: setup.startingStep,
  };
}
