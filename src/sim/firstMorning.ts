import type { GameState } from './state.ts';

/** The First Morning's steps, in order: drink water at the tap, walk to the café, and order breakfast there. */
export const FIRST_MORNING_STEPS = ['drink', 'walkToCafe', 'breakfast'] as const;
export type FirstMorningStep = (typeof FIRST_MORNING_STEPS)[number];

/** The First Morning step the Player is on, or null once it's over or was skipped. */
export function firstMorningStep({ onboarding }: GameState): FirstMorningStep | null {
  if (onboarding.firstMorningSkipped) return null;
  return FIRST_MORNING_STEPS[onboarding.firstMorningStepsDone] ?? null;
}

/**
 * The Character did what a First Morning step asks, or something just as good: that step is done, and so is every step
 * before it, so the prompts never send the Player back. A step already done, or a First Morning over or skipped, changes nothing.
 */
export function completeFirstMorningStep(state: GameState, step: FirstMorningStep): GameState {
  const done = FIRST_MORNING_STEPS.indexOf(step) + 1;
  const { onboarding } = state;
  if (onboarding.firstMorningSkipped || onboarding.firstMorningStepsDone >= done) return state;
  return { ...state, onboarding: { ...onboarding, firstMorningStepsDone: done } };
}

/** The Player skipped the rest of the First Morning: its prompts stop. */
export function skipFirstMorning(state: GameState): GameState {
  if (firstMorningStep(state) === null) return state;
  return { ...state, onboarding: { ...state.onboarding, firstMorningSkipped: true } };
}
