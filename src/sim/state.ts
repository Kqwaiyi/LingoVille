import type { AppearancePresetId, ItemId, NamedNpcId } from '../content/index.ts';
import { seedRng } from './rng.ts';
import { FIRST_MORNING, MOOD, PROFICIENCY, type ProficiencyStep, type StartingStep } from './tuning.ts';

/** A Target Language, and the id of the Culture Pack set where it's spoken. */
export const LANGUAGE_CODES = ['ja', 'zh', 'en', 'de'] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** Places the Character can be at. The town grows to 11 places later. */
export const PLACE_IDS = ['home', 'cafe'] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

export const LIFE_SKILL_IDS = ['cooking', 'fitness', 'barista', 'cashier', 'server'] as const;
export type LifeSkillId = (typeof LIFE_SKILL_IDS)[number];

/** The Life Skills that are also Jobs the Character can be hired for. */
export const JOB_IDS = ['barista', 'cashier', 'server'] as const satisfies readonly LifeSkillId[];
export type JobId = (typeof JOB_IDS)[number];

export const ILLNESS_IDS = ['cold', 'flu', 'food-poisoning', 'hay-fever'] as const;
export type IllnessId = (typeof ILLNESS_IDS)[number];

/** Something the Character owns. Groceries go off on `expiresOnDay`; goods that keep have null. */
export type InventoryItem = { itemId: ItemId; quantity: number; expiresOnDay: number | null };

/** A word or phrase the Player kept from a Recap, with its gloss in the Native Language it was saved in. */
export type PhrasebookEntry = { text: string; reading: string; gloss: string; glossLanguage: LanguageCode; dayAdded: number };

/** What one Named NPC remembers of the Character. With no record, they are a stranger. */
export type NpcMemory = {
  familiarity: number;
  /** Familiarity and Small Talk Mood gained from this NPC on `day`, against the daily cap. */
  todaysGain: { day: number; amount: number };
  timesMet: number;
  knowsName: boolean;
  /** The interaction and completion arguments ordered the same way enough times in a row. */
  usualOrder: { interactionId: string; args: unknown } | null;
  lastTopic: string | null;
  favouriteKnown: boolean;
  lastGiftDay: number | null;
  registerOffered: boolean;
};

export const DEBT_KINDS = ['rent', 'hospital'] as const;
export type Debt = { kind: (typeof DEBT_KINDS)[number]; amountInShifts: number };
export type PaymentPlan = { debtKind: Debt['kind']; instalmentInShifts: number; nextDueDay: number };

/** The answers from New game setup that a save is built from. */
export type NewGameSetup = {
  characterName: string;
  targetLanguage: LanguageCode;
  culturePackId: LanguageCode;
  /** From the self-assessment. */
  startingStep: StartingStep;
  appearancePresetId: AppearancePresetId;
  rngSeed: number;
};

export type GameState = {
  rngState: number;
  identity: {
    characterName: string;
    targetLanguage: LanguageCode;
    culturePackId: LanguageCode;
    appearancePresetId: AppearancePresetId;
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
    illness: { illnessId: IllnessId; onsetDay: number } | null;
  };
  /** Rent falls due at the end of `dueDay`; `owedInShifts` is what is due then. */
  rent: { dueDay: number; owedInShifts: number };
  debts: Debt[];
  paymentPlans: PaymentPlan[];
  /** The current step, read from the hidden score with a buffer at boundaries. */
  proficiencyStep: ProficiencyStep;
  progression: {
    proficiencyScore: number;
    /** Ratchets: drives the Newcomer Discount and Shift stakes. */
    highestStep: ProficiencyStep;
    newcomerDiscountStep: ProficiencyStep;
    lifeSkillXp: Record<LifeSkillId, number>;
    /** Daily counters, reset when `day` is no longer today. */
    today: { day: number; homeMeals: number; gymSessions: number };
  };
  possessions: {
    inventory: InventoryItem[];
    gymMembershipUntilDay: number | null;
    addressRegistered: boolean;
    jobsHired: JobId[];
    /** A Shift under way. It is saved after every customer. */
    shift: { jobId: JobId; customersServed: number; payInShifts: number } | null;
  };
  /** The personal phrasebook. */
  phrasebook: PhrasebookEntry[];
  onboarding: { firstMorningStepsDone: number };
  /** One NPC Memory record per Named NPC the Character has met. */
  people: Partial<Record<NamedNpcId, NpcMemory>>;
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
      illness: null,
    },
    rent: { dueDay: FIRST_MORNING.rentDueDay, owedInShifts: 0 },
    debts: [],
    paymentPlans: [],
    proficiencyStep: setup.startingStep,
    progression: {
      proficiencyScore: PROFICIENCY.startingScore[setup.startingStep],
      highestStep: setup.startingStep,
      newcomerDiscountStep: setup.startingStep,
      lifeSkillXp: Object.fromEntries(LIFE_SKILL_IDS.map((skill) => [skill, 0])) as Record<LifeSkillId, number>,
      today: { day: FIRST_MORNING.day, homeMeals: 0, gymSessions: 0 },
    },
    possessions: { inventory: [], gymMembershipUntilDay: null, addressRegistered: false, jobsHired: [], shift: null },
    phrasebook: [],
    onboarding: { firstMorningStepsDone: 0 },
    people: {},
  };
}
