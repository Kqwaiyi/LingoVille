import type { AppearancePresetId, DrinkModifiers, ItemId, NamedNpcId } from '../content/index.ts';
import { weeklyRent } from './rentPrice.ts';
import { seedRng } from './rng.ts';
import { FIRST_MORNING, MOOD, PROFICIENCY, type ProficiencyStep, type StartingStep } from './tuning.ts';

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
  /** Picks their voice: the gateway turns it into one of its Shift Customer voices. */
  voiceSeed: number;
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
  /** The Player chose "Skip tutorial" on the last setup screen. */
  skipFirstMorning: boolean;
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
    /**
     * The chance that what the Character has eaten gives them food poisoning, built up by cooking
     * gone-off groceries. Recorded here for Illness, which rolls it and starts it again from 0.
     */
    foodPoisoningChance: number;
  };
  rent: {
    /** This week's rent falls due at the end of this day. */
    dueDay: number;
    /** What is still to pay of this week's rent. Whatever is unpaid at the end of `dueDay` becomes rent debt. */
    owedInShifts: number;
    /** An extension from the landlord: rent debt costs no Mood at the end of any day up to this one. */
    extendedThroughDay: number | null;
    /** The day the landlord last caught the Character in the hallway about rent: once a day at most. */
    remindedOnDay: number | null;
  };
  debts: Debt[];
  paymentPlans: PaymentPlan[];
  /** The day the Character last woke in the ward after Fainting, or null if they never have fainted. Each Fainting wakes on a new day. */
  wokeInWardOnDay: number | null;
  /** The current step, read from the hidden score with a buffer at boundaries. */
  proficiencyStep: ProficiencyStep;
  progression: {
    proficiencyScore: number;
    /**
     * Recap evidence so far, counted in full interactions: a short or Help-heavy one counts as part of one.
     * The score moves faster until there's `PROFICIENCY.fastStartInteractions` worth.
     */
    evidenceSoFar: number;
    /** Ratchets: drives the Newcomer Discount and Shift stakes. */
    highestStep: ProficiencyStep;
    /**
     * The Newcomer Discount step the landlord has told the Character about. Rent follows `highestStep`
     * from each new week; this catches up with it when the landlord announces the step-down.
     */
    newcomerDiscountStep: ProficiencyStep;
    lifeSkillXp: Record<LifeSkillId, number>;
    /** The day the Character last started a Shift: there's at most one a day. */
    lastShiftDay: number | null;
    /** The days a Shift was worked in the last week, oldest first, for overwork. */
    shiftDays: number[];
    /** Daily counters, reset when `day` is no longer today. */
    today: { day: number; homeMeals: number; gymSessions: number };
  };
  possessions: {
    inventory: InventoryItem[];
    gymMembershipUntilDay: number | null;
    addressRegistered: boolean;
    jobsHired: JobId[];
    /** A Shift under way. */
    shift: Shift | null;
  };
  /** The personal phrasebook. */
  phrasebook: PhrasebookEntry[];
  onboarding: { firstMorningStepsDone: number; firstMorningSkipped: boolean };
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
      foodPoisoningChance: 0,
    },
    rent: {
      dueDay: FIRST_MORNING.rentDueDay,
      owedInShifts: weeklyRent(setup.startingStep),
      extendedThroughDay: null,
      remindedOnDay: null,
    },
    debts: [],
    paymentPlans: [],
    wokeInWardOnDay: null,
    proficiencyStep: setup.startingStep,
    progression: {
      proficiencyScore: PROFICIENCY.stepCentre[setup.startingStep],
      evidenceSoFar: 0,
      highestStep: setup.startingStep,
      newcomerDiscountStep: setup.startingStep,
      lifeSkillXp: Object.fromEntries(LIFE_SKILL_IDS.map((skill) => [skill, 0])) as Record<LifeSkillId, number>,
      lastShiftDay: null,
      shiftDays: [],
      today: { day: FIRST_MORNING.day, homeMeals: 0, gymSessions: 0 },
    },
    possessions: { inventory: [], gymMembershipUntilDay: null, addressRegistered: false, jobsHired: [], shift: null },
    phrasebook: [],
    onboarding: { firstMorningStepsDone: 0, firstMorningSkipped: setup.skipFirstMorning },
    people: {},
  };
}
