import type { AppearancePreset, DietaryNoteId, DrinkModifiers, ItemId, NpcLook } from '../content/index.ts';
import { seedRng } from './rng.ts';
import { NEW_GAME, PROFICIENCY, type ProficiencyStep, type StartingStep } from './tuning.ts';

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

export const LIFE_SKILL_IDS = ['barista', 'cashier', 'server'] as const;
export type LifeSkillId = (typeof LIFE_SKILL_IDS)[number];

/** The Life Skills that are also Jobs the Character can be hired for. */
export const JOB_IDS = ['barista', 'cashier', 'server'] as const satisfies readonly LifeSkillId[];
export type JobId = (typeof JOB_IDS)[number];

/** A word or phrase the Player kept from a Recap, with its gloss in the Native Language it was saved in. */
export type PhrasebookEntry = { text: string; reading: string; gloss: string; glossLanguage: LanguageCode; dayAdded: number };

/** A line of a Shift Customer's order, or of what the Player hands them. A café drink made to order says how it's made. */
export type ShiftOrderLine = { itemId: ItemId; quantity: number; modifiers?: DrinkModifiers };
export type ShiftOrder = readonly ShiftOrderLine[];

/**
 * What a customer at the supermarket till wants besides their items rung up. The Player has to hear all of it.
 * Money is in local money: the customer hands over an amount the Culture Pack's coins and notes make.
 */
export type Checkout = {
  bag: boolean;
  pointsCard: boolean;
  /** The item they ask for from behind the counter (it's in the order too, with their shopping), or null. */
  fromBehindTheCounter: ItemId | null;
  /** The cash they hand over, or null when they pay by card. */
  cashHanded: number | null;
  /** What they're owed back: the cash less the total, or null when they pay by card. */
  changeDue: number | null;
};

/** What the Player did at the till for a customer: the bag and points card toggles, and the change counted out. */
export type TillWork = { bag: boolean; pointsCard: boolean; change: number };

/** One diner at a restaurant table: the dish and drink they want, and any dietary need they tell the server. */
export type Diner = { dish: ItemId; drink: ItemId; note: DietaryNoteId | null };

/** One diner as the server wrote them on the order pad: what's been written so far, which may be nothing. */
export type PadDiner = { dish: ItemId | null; drink: ItemId | null; note: DietaryNoteId | null };

/** A Shift Customer at the counter: anonymous, with no memory, and a hidden order the Player has to work out. */
export type ShiftCustomer = {
  /** The Shift Customer template they were drawn from. */
  templateId: string;
  /**
   * What they want in the end, which what the Player serves is checked against exactly. Never shown. At the till,
   * everything to ring up: the shopping they put on the counter (which the Player sees) and what they ask for from behind it.
   */
  order: ShiftOrder;
  /** What they ask for first, before they change their mind halfway, or null if they don't. */
  changedFrom: ShiftOrder | null;
  /** At the supermarket till: the bag, the points card, anything from behind the counter and their cash. Null elsewhere. */
  checkout: Checkout | null;
  /**
   * At the restaurant: everyone at the table, one diner or a few, with what each wants and any dietary need. Their
   * `order` is all of it together, for the kitchen. Null elsewhere. One Shift Customer speaks for the whole table.
   */
  table: readonly Diner[] | null;
  /** Picks their voice: the gateway turns it into one of the anonymous voices for the build of the one who speaks. */
  voiceSeed: number;
  /** How they look, drawn with the pack's weights: the one who speaks, then the rest of their table. */
  appearances: readonly NpcLook[];
};

/** A stretch of work at a Job: a set number of Shift Customers, served one after another. */
export type Shift = {
  jobId: JobId;
  /** How many Shift Customers come, drawn as the Shift starts. */
  customers: number;
  /** Customers served exactly what they ordered, so far. */
  served: number;
  /** Customers served something else, or who gave up, so far. */
  failed: number;
  /** Of the customers served, those whose lines the Player had translated: each is docked a share of a failed customer's dock. */
  translated: number;
  /** The customer at the counter now, or null between customers. */
  customer: ShiftCustomer | null;
};

/** The answers from New game setup that a save is built from. */
export type NewGameSetup = {
  characterName: string;
  targetLanguage: LanguageCode;
  culturePackId: LanguageCode;
  /** From the self-assessment. */
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
  /** The current step, read from the hidden score with a buffer at boundaries. */
  proficiencyStep: ProficiencyStep;
  progression: {
    proficiencyScore: number;
    /**
     * Recap evidence so far, counted in full interactions: a short or Help-heavy one counts as part of one.
     * The score moves faster until there's `PROFICIENCY.fastStartInteractions` worth.
     */
    evidenceSoFar: number;
    /** Ratchets: drives Shift stakes. */
    highestStep: ProficiencyStep;
    lifeSkillXp: Record<LifeSkillId, number>;
    /** The day the Character last started a Shift: there's at most one a day. */
    lastShiftDay: number | null;
  };
  possessions: {
    jobsHired: JobId[];
    /** A Shift under way. */
    shift: Shift | null;
  };
  /** The personal phrasebook. */
  phrasebook: PhrasebookEntry[];
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
    progression: {
      proficiencyScore: PROFICIENCY.stepCentre[setup.startingStep],
      evidenceSoFar: 0,
      highestStep: setup.startingStep,
      lifeSkillXp: Object.fromEntries(LIFE_SKILL_IDS.map((skill) => [skill, 0])) as Record<LifeSkillId, number>,
      lastShiftDay: null,
    },
    possessions: { jobsHired: [], shift: null },
    phrasebook: [],
  };
}
