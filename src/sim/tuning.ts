// Every game number lives here. Rules read their numbers from this module, and
// tests import them rather than copying them, so retuning never breaks a test
// that checks a rule rather than a number.
//
// Sections marked "default" are the spec's open questions 4 (Mood) and 5 (other
// tuning numbers): starting guesses, to be adjusted in playtesting.

export const MINUTES_PER_HOUR = 60;

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
  /**
   * Mood drains fast from this time until `wakeAt`, the hour the bed would have
   * woken the Character. Staying up all night doesn't drain on into the day.
   */
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
  /** How close the Character must be for pointing at a sign or menu to show its reading aid. */
  signReadRangeMetres: 6,
} as const;

/** Trams are fast travel: free, and the only cost is time. */
export const TRAM = {
  /** Game minutes from one stop to the next along the line. */
  minutesPerStop: 8,
} as const;

// --- First Morning ----------------------------------------------------------

export const FIRST_MORNING = {
  day: 1,
  minuteOfDay: CLOCK.wakeAt,
  /** ¥10,000, 400元, €100 or £100: the same in every pack's anchor. */
  moneyInShifts: 5 / 3,
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
  /** Hunger one café pastry gives back. */
  cafeFoodHunger: 0.25 * METER_MAX,
  /** Hunger a convenience store counter snack gives back. */
  counterSnackHunger: 0.2 * METER_MAX,
  /** Hunger a convenience store bento gives back: a proper meal. */
  bentoHunger: 0.5 * METER_MAX,
  /** Where the ward's care leaves Well-being when the Character comes round after Fainting (default). */
  afterFainting: { health: 0.5 * METER_MAX, hunger: 0.5 * METER_MAX, thirst: 0.5 * METER_MAX },
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
  /** How far a pack's rounding to local price points may move a price from its ratio before the content check fails it. */
  pricePointTolerance: 0.1,
} as const;

export const PROFICIENCY_STEPS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type ProficiencyStep = (typeof PROFICIENCY_STEPS)[number];

/** The steps the self-assessment in New game setup can start the Character at. */
export const STARTING_STEPS = ['A1', 'A2', 'B1', 'B2'] as const satisfies readonly ProficiencyStep[];
export type StartingStep = (typeof STARTING_STEPS)[number];

export const CHARACTER_NAME = {
  /** The longest name the Player can give the Character, in characters. */
  maxLength: 20,
} as const;

/** The mic check, the last screen of New game setup. */
export const MIC_CHECK = {
  /** How loud a sound must be, on the mic meter's 0–1 scale, for the check to have heard the Player. */
  heardLevel: 0.15,
} as const;

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
  /** A conversation with this many player turns or fewer ("yes, the usual") counts only this much (default). */
  shortConversation: { maxPlayerTurns: 2, weight: 0.15 },
  /** How far below the Recap's estimate each turn the NPC couldn't make sense of pulls the score (default), in steps. */
  notUnderstoodPull: 0.4,
  /** How far past a step boundary the score must go before the current step changes, so it doesn't flicker (default). */
  stepBuffer: 0.15,
  /**
   * The middle of each step on the hidden score (default), which runs from 0 to the number of steps.
   * A new save starts here (only A1–B2 can be a starting step), and a Recap's estimate pulls the score here.
   */
  stepCentre: { A1: 0.5, A2: 1.5, B1: 2.5, B2: 3.5, C1: 4.5, C2: 5.5 } satisfies Record<ProficiencyStep, number>,
} as const;

/** How Help discounts a conversation as Proficiency evidence (default). Help only ever reduces weight. */
export const HELP_EVIDENCE = {
  /** A player turn that closely repeats a hint or phrase shown just before it counts this much. */
  copiedTurnWeight: 0.1,
  /** How alike a turn and a hint must be (Dice similarity of letter pairs, 0–1) to count as a close repeat. */
  closeRepeatSimilarity: 0.6,
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
  /** The lowest Mood each face on the dock's Mood gauge shows from. */
  faceFrom: { miserable: 0, low: 0.2 * METER_MAX, okay: 0.4 * METER_MAX, good: 0.6 * METER_MAX, great: 0.8 * METER_MAX },
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
  /** Groceries stay fresh until the end of this many days after the day they were bought. */
  expiryDays: 3,
  /** Gone-off groceries stay in the inventory this many days (they can still be cooked, at a risk), then get thrown out. */
  goneOffDaysKept: 2,
} as const;
