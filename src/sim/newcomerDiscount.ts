import type { GameState } from './state.ts';
import { PROFICIENCY_STEP_TABLE } from './tuning.ts';

/**
 * The highest step reached has a smaller Newcomer Discount than the landlord
 * last told the Character about, so there's a step-down to announce. Between steps with the same discount
 * (C1 and C2) there's nothing to announce.
 */
export function newcomerDiscountStepDownDue({ progression }: GameState): boolean {
  const discount = (step: GameState['proficiencyStep']) => PROFICIENCY_STEP_TABLE[step].newcomerDiscount;
  return discount(progression.highestStep) < discount(progression.newcomerDiscountStep);
}

/**
 * The landlord has told the Character the Newcomer Discount is smaller. The rent
 * itself follows the highest step reached from each new week, so it never steps back up.
 */
export function announceNewcomerDiscount(state: GameState): GameState {
  const { progression } = state;
  if (progression.newcomerDiscountStep === progression.highestStep) return state;
  return { ...state, progression: { ...progression, newcomerDiscountStep: progression.highestStep } };
}
