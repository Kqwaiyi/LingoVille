// Every game number lives here. Rules read their numbers from this module, so
// retuning the game is a change to this file alone.
//
// Sections marked "default" are the spec's open question 5 (tuning numbers):
// starting guesses, to be adjusted in playtesting.

import type { Band } from '../content/index.ts';

export const MINUTES_PER_HOUR = 60;

// --- Clock ------------------------------------------------------------------

export const CLOCK = {
  minutesPerDay: 24 * MINUTES_PER_HOUR,
  /** 1 real minute = 1 game hour. */
  gameMinutesPerRealSecond: 1,
  timeScale: { normal: 1, conversation: 0.25, paused: 0 },
  maxRealDeltaMs: 250,
} as const;

// --- Day and night ----------------------------------------------------------

export const DAYLIGHT = {
  /**
   * Each lighting preset shows in full at its time; between two, one blends into the next. Night is in full twice,
   * at dusk and before dawn, so it holds through the hours between.
   */
  keyframes: [
    { preset: 'night', at: 5 * MINUTES_PER_HOUR },
    { preset: 'morning', at: 7 * MINUTES_PER_HOUR },
    { preset: 'midday', at: 12.5 * MINUTES_PER_HOUR },
    { preset: 'goldenHour', at: 18 * MINUTES_PER_HOUR },
    { preset: 'night', at: 20.5 * MINUTES_PER_HOUR },
  ],
  sunriseAt: 6 * MINUTES_PER_HOUR,
  sunsetAt: 19.5 * MINUTES_PER_HOUR,
  /** In radians above the horizon, at the middle of the day and of the night. */
  sunHighestElevation: 1.1,
  moonHighestElevation: 0.8,
  /** The key light never sinks below this, so its shadows never stretch the length of the town. */
  lowestElevation: 0.25,
  /**
   * The street lights, and the windows of places that are open, come on at dusk, between golden hour and sunset, and
   * go off once it's light.
   */
  lampsOnAt: 19 * MINUTES_PER_HOUR,
  lampsOffAt: 6.5 * MINUTES_PER_HOUR,
} as const;

// --- Moving around the town -------------------------------------------------

export const MOVEMENT = {
  walkSpeedMetresPerSecond: 4,
  /** How close the Character must be to talk to an NPC. Walking further away ends the conversation. */
  talkRangeMetres: 2.5,
} as const;

/** Trams are fast travel: free, and the only cost is time. */
export const TRAM = {
  /** Game minutes from one stop to the next along the line. */
  minutesPerStop: 8,
} as const;

/** The place line above the dock: where the Character is, its hours, and whether it's open. */
export const PLACE_LINE = {
  /** How long it shows in real time on arriving somewhere, or when the place opens or closes, before it fades away. */
  shownMs: 4000,
} as const;

// --- New game ---------------------------------------------------------------

export const NEW_GAME = {
  day: 1,
  minuteOfDay: 7 * MINUTES_PER_HOUR,
  /** ¥10,000, 400元, €100 or £100: the same in every pack's anchor. */
  moneyInShifts: 5 / 3,
} as const;

// --- Economy (prices as ratios of one Shift's base pay) ---------------------

export const ECONOMY = {
  /** The most of one item a single order can ask for. */
  maxQuantityPerOrderLine: 5,
  /** How far a pack's rounding to local price points may move a price from its ratio before the content check fails it. */
  pricePointTolerance: 0.1,
} as const;

export const PROFICIENCY_STEPS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type ProficiencyStep = (typeof PROFICIENCY_STEPS)[number];

/** The band at each Proficiency Step: B = A1–A2, I = B1–B2, A = C1–C2. */
export const STEP_BANDS: Record<ProficiencyStep, Band> = { A1: 'B', A2: 'B', B1: 'I', B2: 'I', C1: 'A', C2: 'A' };

/** The steps a new game can start the Character at. */
export const STARTING_STEPS = ['A1', 'A2', 'B1', 'B2'] as const satisfies readonly ProficiencyStep[];
export type StartingStep = (typeof STARTING_STEPS)[number];

/** Patience by Proficiency Step. */
export const PROFICIENCY_STEP_TABLE: Record<ProficiencyStep, { startingPatience: number }> = {
  A1: { startingPatience: 4 },
  A2: { startingPatience: 4 },
  B1: { startingPatience: 3 },
  B2: { startingPatience: 3 },
  C1: { startingPatience: 2 },
  C2: { startingPatience: 2 },
};

export const PATIENCE = {
  /** The NPC's face looks strained once this much Patience or less is left. */
  strainedAtOrBelow: 1,
} as const;
