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

// --- Language Proficiency ---------------------------------------------------

export const PROFICIENCY = {
  /** Fraction of the gap to the Recap's CEFR estimate closed per conversation. */
  updateRate: 0.15,
  fastStartUpdateRate: 0.3,
  fastStartInteractions: 10,
  /** A conversation with this many player turns or fewer ("a latte, please") counts only this much (default). */
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
