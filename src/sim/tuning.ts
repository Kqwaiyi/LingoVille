// Every game number lives here. Rules read their numbers from this module, and
// tests import them rather than copying them, so retuning never breaks a test
// that checks a rule rather than a number.
//
// Sections marked "default" are the spec's open questions 4 (Mood) and 5 (other
// tuning numbers): starting guesses, to be adjusted in playtesting.

const MINUTES_PER_HOUR = 60;

// --- Meters -----------------------------------------------------------------

/** Health, Hunger, Thirst and Mood all run from 0 to METER_MAX. */
export const METER_MAX = 100;

// --- Clock ------------------------------------------------------------------

export const CLOCK = {
  minutesPerDay: 24 * MINUTES_PER_HOUR,
  /** 1 real minute = 1 game hour. */
  gameMinutesPerRealSecond: 1,
  timeScale: { normal: 1, conversation: 0.25, paused: 0 },
  maxRealDeltaMs: 250,
  /** Sleeping always wakes at this time. */
  wakeAt: 7 * MINUTES_PER_HOUR,
  bedUsableFrom: 20 * MINUTES_PER_HOUR,
  /** Mood drains fast after this time until the Character sleeps. */
  lateNightFrom: 2 * MINUTES_PER_HOUR,
  faintWakeAt: 8 * MINUTES_PER_HOUR,
} as const;

// --- Saving -----------------------------------------------------------------

export const SAVE = {
  /** Autosave this often in real time while playing, on top of the event triggers. */
  everyRealMs: 2 * 60 * 1000,
  /** How long "Saved ✓" stays under the clock. */
  noticeMs: 2000,
} as const;

// --- Moving around the town -------------------------------------------------

export const MOVEMENT = {
  walkSpeedMetresPerSecond: 4,
  /** How close the Character must be to use something with E. */
  interactRangeMetres: 1.6,
  /** How close the Character must be to talk to an NPC. Walking further away ends the conversation. */
  talkRangeMetres: 2.5,
} as const;

// --- First Morning ----------------------------------------------------------

export const FIRST_MORNING = {
  day: 1,
  minuteOfDay: CLOCK.wakeAt,
  moneyInShifts: 1.7,
  health: METER_MAX,
  hunger: 0.6 * METER_MAX,
  thirst: 0.4 * METER_MAX,
  /** Rent is first due at the end of this day. */
  rentDueDay: 7,
} as const;

// --- Well-being -------------------------------------------------------------

export const WELL_BEING = {
  hungerFullToEmptyGameMinutes: 24 * MINUTES_PER_HOUR,
  thirstFullToEmptyGameMinutes: 12 * MINUTES_PER_HOUR,
  /** Health drain while Hunger or Thirst is at 0, at Fitness 0. */
  healthFullToEmptyWhileDeprivedGameMinutes: 12 * MINUTES_PER_HOUR,
  /** A Well-being gauge at or below this shows the warning colour. */
  lowWarningAt: 0.25 * METER_MAX,
  /** Thirst one café drink gives back. */
  cafeDrinkThirst: 0.4 * METER_MAX,
} as const;

// --- Economy (prices as ratios of one Shift's base pay) ---------------------

export const ECONOMY = {
  rentPeriodDays: 7,
  weeklyRentInShifts: 2.0,
  faintingBillInShifts: 1.5,
  gymMembershipInShifts: 0.5,
  gymMembershipDays: 30,
  shiftCustomers: { min: 5, max: 8 },
  jobLifeSkillPayRaisePerLevel: 0.06,
  /** The most of one item a single order can ask for. */
  maxQuantityPerOrderLine: 5,
} as const;

export const PROFICIENCY_STEPS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type ProficiencyStep = (typeof PROFICIENCY_STEPS)[number];

/** Patience, Newcomer Discount and Shift stakes by Proficiency Step. */
export const PROFICIENCY_STEP_TABLE: Record<
  ProficiencyStep,
  { startingPatience: number; newcomerDiscount: number; stakeMultiplier: number; failedCustomerDock: number }
> = {
  A1: { startingPatience: 4, newcomerDiscount: 0.5, stakeMultiplier: 1.0, failedCustomerDock: 0 },
  A2: { startingPatience: 4, newcomerDiscount: 0.4, stakeMultiplier: 1.1, failedCustomerDock: 0 },
  B1: { startingPatience: 3, newcomerDiscount: 0.25, stakeMultiplier: 1.25, failedCustomerDock: 0.05 },
  B2: { startingPatience: 3, newcomerDiscount: 0.1, stakeMultiplier: 1.4, failedCustomerDock: 0.1 },
  C1: { startingPatience: 2, newcomerDiscount: 0, stakeMultiplier: 1.6, failedCustomerDock: 0.15 },
  C2: { startingPatience: 2, newcomerDiscount: 0, stakeMultiplier: 1.8, failedCustomerDock: 0.2 },
};

export const PATIENCE = {
  /** The NPC's face looks strained once this much Patience or less is left. */
  strainedAtOrBelow: 1,
} as const;

// --- Language Proficiency ---------------------------------------------------

export const PROFICIENCY = {
  /** Fraction of the gap to the Recap's CEFR estimate closed per conversation. */
  updateRate: 0.15,
  fastStartUpdateRate: 0.3,
  fastStartInteractions: 10,
  /** Where the hidden score starts for each step (default): the middle of the step. Only A1–B2 can be a starting step. */
  startingScore: { A1: 0.5, A2: 1.5, B1: 2.5, B2: 3.5, C1: 4.5, C2: 5.5 } satisfies Record<ProficiencyStep, number>,
} as const;

// --- Mood (default: open question 4) ----------------------------------------

export const MOOD = {
  neutral: 0.5 * METER_MAX,
  changes: {
    goalInteractionSuccess: 4,
    /** Always a smaller dip than the success boost, so trying is worth it. */
    goalInteractionFailure: -2,
    smallTalkExchange: 2,
    sleep: 5,
    bathhouse: 8,
    gymSession: 4,
    goodHomeMeal: 2,
    unmetNeedPerGameHour: -1,
    lateNightPerGameHour: -6,
    fainting: -20,
  },
  /** Working this many or more days in one week counts as overwork. */
  overworkDaysPerWeek: 5,
  overworkPenaltyPerShift: -6,
  debtPenaltyPerDay: -3,
  /** The Mood modifier on Shift pay and Life Skill XP, linear from Mood 0 to METER_MAX. */
  modifier: { atZero: 0.8, atMax: 1.2 },
} as const;

// --- Life Skills (default: open question 5) ---------------------------------

export const LIFE_SKILLS = {
  maxLevel: 5,
  /** Total XP needed to reach each level, index = level. */
  xpToReachLevel: [0, 40, 100, 180, 280, 400],
  xpPerHomeMeal: 6,
  homeMealsCountingPerDay: 3,
  xpPerGymSession: 15,
  gymSessionsPerDay: 1,
  xpPerShiftCustomer: 3,
  /** Illness chance reduction at max Fitness, scaled linearly by level. */
  fitnessIllnessReductionAtMax: 0.4,
  /** Health drain while deprived is multiplied by this at max Fitness. */
  fitnessDeprivedDrainAtMax: 0.6,
} as const;

// --- Familiarity (default: open question 5) ---------------------------------

export const FAMILIARITY = {
  /** Points needed for each tier; Familiarity never decays. */
  tierThresholds: { stranger: 0, acquaintance: 15, friend: 45 },
  smallTalkExchange: 2,
  goalInteractionSuccess: 1,
  gift: 5,
  favouriteGift: 10,
  /** Shared per-NPC, per-day cap on Familiarity gain and Small Talk Mood. */
  dailyCapPerNpc: 6,
  giftCooldownDays: 7,
  usualOrderAfterIdenticalOrders: 3,
  friendPatienceBonus: 1,
} as const;

// --- Illness and food (default: open question 5) ----------------------------

export const ILLNESS = {
  /** About once every 1–2 game weeks at full Well-being and Fitness 0. */
  baseDailyChance: 0.08,
  /** Multiplier on the chance when average Well-being is at 0. */
  lowWellBeingMultiplierAtZero: 2,
  healthFullToEmptyGameMinutes: 48 * MINUTES_PER_HOUR,
  /** Extra food poisoning chance from eating expired groceries. */
  expiredFoodPoisoningChance: 0.25,
} as const;

export const GROCERIES = {
  expiryDays: 3,
} as const;
