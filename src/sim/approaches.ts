import { isOpen, type OpeningHours } from './clock.ts';
import { faintedBetween } from './faint.ts';
import { announceNewcomerDiscount, newcomerDiscountStepDownDue } from './newcomerDiscount.ts';
import type { NamedNpcId } from '../content/index.ts';
import { rentDebt } from './rent.ts';
import { randomInt } from './rng.ts';
import type { GameState } from './state.ts';

/**
 * The times an NPC starts a conversation with the Character by themselves,
 * without the Player pressing E: the nurse when the Character wakes from
 * Fainting, and the landlord in the hallway about rent or the Newcomer
 * Discount. Park regulars waving the Character over open Small Talk instead (`parkWaveDue`).
 * Later: the doctor calling the Character's name.
 */
export const APPROACH_IDS = ['nurseOnWaking', 'landlordRentDue', 'landlordDiscountStepDown'] as const;
export type ApproachId = (typeof APPROACH_IDS)[number];

/** The landlord's approaches, made in the hallway at home rather than by a change to the game. */
export type HallwayApproachId = Extract<ApproachId, 'landlordRentDue' | 'landlordDiscountStepDown'>;

/** Whether this change to the game brings an NPC up to the Character, and which. */
export function approachDue(before: GameState, after: GameState): ApproachId | null {
  if (faintedBetween(before, after)) return 'nurseOnWaking';
  return null;
}

/** Rent is due today and unpaid, or owed as debt, and the landlord hasn't given more time. */
function rentReminderDue(state: GameState): boolean {
  const { rent } = state;
  const { day } = state.clock;
  const unpaid = (day === rent.dueDay && rent.owedInShifts > 0) || rentDebt(state) > 0;
  const extended = rent.extendedThroughDay !== null && day <= rent.extendedThroughDay;
  return unpaid && !extended && rent.remindedOnDay !== day;
}

/**
 * Whether the landlord, in the hallway at home while on duty, catches the
 * Character on the way past: about rent due and unpaid (once a day at most),
 * else about a Newcomer Discount step-down not yet announced.
 */
export function hallwayApproach(state: GameState, landlordHours: OpeningHours): HallwayApproachId | null {
  if (state.placeId !== 'home' || !isOpen(landlordHours, state.clock)) return null;
  if (rentReminderDue(state)) return 'landlordRentDue';
  if (newcomerDiscountStepDownDue(state)) return 'landlordDiscountStepDown';
  return null;
}

/**
 * The landlord has come over: the rent reminder counts for today, or the
 * step-down counts as announced.
 */
export function hallwayApproachMade(state: GameState, approachId: HallwayApproachId): GameState {
  if (approachId === 'landlordDiscountStepDown') return announceNewcomerDiscount(state);
  return { ...state, rent: { ...state.rent, remindedOnDay: state.clock.day } };
}

/** The Character has just come into the park, and no park regular has waved them over yet today. */
export function parkWaveDue(before: GameState, after: GameState): boolean {
  return before.placeId !== 'park' && after.placeId === 'park' && after.parkWavedOnDay !== after.clock.day;
}

/** One of the park `regulars`, drawn from the save's RNG, waves the Character over: that's today's wave. */
export function parkWaveMade(state: GameState, regulars: readonly NamedNpcId[]): { state: GameState; npcId: NamedNpcId } {
  const draw = randomInt(state.rngState, 0, regulars.length - 1);
  return { state: { ...state, rngState: draw.rngState, parkWavedOnDay: state.clock.day }, npcId: regulars[draw.value]! };
}
