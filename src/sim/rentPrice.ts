import { ECONOMY, PROFICIENCY_STEP_TABLE, type ProficiencyStep } from './tuning.ts';

/** A week's rent with the Newcomer Discount at this step. */
export function weeklyRent(discountStep: ProficiencyStep): number {
  return ECONOMY.weeklyRentInShifts * (1 - PROFICIENCY_STEP_TABLE[discountStep].newcomerDiscount);
}
