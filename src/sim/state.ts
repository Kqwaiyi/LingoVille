import { seedRng } from './rng.ts';
import { FIRST_MORNING, MOOD, type ProficiencyStep } from './tuning.ts';

/** A Target Language, and the id of the Culture Pack set where it's spoken. */
export type LanguageCode = 'ja' | 'zh' | 'en' | 'de';

/** Places the Character can be at. The town grows to 11 places later. */
export type PlaceId = 'home' | 'cafe';

/** The answers from New game setup that a save is built from. */
export type NewGameSetup = {
  characterName: string;
  targetLanguage: LanguageCode;
  culturePackId: LanguageCode;
  /** From the self-assessment. */
  startingStep: ProficiencyStep;
  appearancePresetId: string;
  rngSeed: number;
};

export type GameState = {
  rngState: number;
  identity: {
    characterName: string;
    targetLanguage: LanguageCode;
    culturePackId: LanguageCode;
    appearancePresetId: string;
  };
  clock: { day: number; minuteOfDay: number };
  /** The Character's current place. Positions live in the world, not here. */
  placeId: PlaceId;
  character: {
    health: number;
    hunger: number;
    thirst: number;
    mood: number;
    /** Money is held in Shifts of base pay; the Culture Pack converts it to local currency. */
    moneyInShifts: number;
  };
  rent: { dueDay: number };
  proficiencyStep: ProficiencyStep;
};

/** Builds the First Morning state for a new game. */
export function createSave(setup: NewGameSetup): GameState {
  return {
    rngState: seedRng(setup.rngSeed),
    identity: {
      characterName: setup.characterName,
      targetLanguage: setup.targetLanguage,
      culturePackId: setup.culturePackId,
      appearancePresetId: setup.appearancePresetId,
    },
    clock: { day: FIRST_MORNING.day, minuteOfDay: FIRST_MORNING.minuteOfDay },
    placeId: 'home',
    character: {
      health: FIRST_MORNING.health,
      hunger: FIRST_MORNING.hunger,
      thirst: FIRST_MORNING.thirst,
      mood: MOOD.neutral,
      moneyInShifts: FIRST_MORNING.moneyInShifts,
    },
    rent: { dueDay: FIRST_MORNING.rentDueDay },
    proficiencyStep: setup.startingStep,
  };
}
