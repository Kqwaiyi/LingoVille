import type { ItemId } from '../content/index.ts';
import type { Basket } from './basket.ts';
import { isOpen, type OpeningHours } from './clock.ts';
import { randomInt } from './rng.ts';
import type { GameState, JobId } from './state.ts';
import { moodModifier } from './mood.ts';
import { ECONOMY, PROFICIENCY_STEP_TABLE } from './tuning.ts';

/** Why E at the staff door can't start a Shift now. */
export type ShiftRefusal = 'notHired' | 'closed' | 'workedToday' | 'underway';

/**
 * Why a Shift at this Job can't start now, or null if it can: the Character must have the Job,
 * the place must be open (`hours` are its hours), and there's at most one Shift a day.
 */
export function shiftRefusal(state: GameState, jobId: JobId, hours: OpeningHours): ShiftRefusal | null {
  if (state.possessions.shift) return 'underway';
  if (!state.possessions.jobsHired.includes(jobId)) return 'notHired';
  if (state.progression.lastShiftDay === state.clock.day) return 'workedToday';
  if (!isOpen(hours, state.clock)) return 'closed';
  return null;
}

/** E at the staff door: a Shift starts, with a number of Shift Customers to come drawn from the RNG. Nothing changes if it can't start now. */
export function startShift(state: GameState, jobId: JobId, hours: OpeningHours): GameState {
  if (shiftRefusal(state, jobId, hours)) return state;
  const { min, max } = ECONOMY.shiftCustomers;
  const customers = randomInt(state.rngState, min, max);
  return {
    ...state,
    rngState: customers.rngState,
    progression: { ...state.progression, lastShiftDay: state.clock.day },
    possessions: { ...state.possessions, shift: { jobId, customers: customers.value, served: 0, failed: 0, customer: null } },
  };
}

/** The most a voice seed can be: the gateway picks a voice from it, however many it has. */
const VOICE_SEEDS = 2 ** 16;

/**
 * The next Shift Customer walks up to the counter, wanting one of `drinks` (the template's): their order
 * and their voice come from the seeded RNG. Nothing changes with no Shift under way.
 */
export function nextShiftCustomer(state: GameState, drinks: readonly ItemId[]): GameState {
  const { shift } = state.possessions;
  if (!shift) return state;
  const drink = randomInt(state.rngState, 0, drinks.length - 1);
  const voice = randomInt(drink.rngState, 0, VOICE_SEEDS - 1);
  const customer = { order: [{ itemId: drinks[drink.value]!, quantity: 1 }], voiceSeed: voice.value };
  return { ...state, rngState: voice.rngState, possessions: { ...state.possessions, shift: { ...shift, customer } } };
}

/** The same items in the same numbers, whatever order the lines are in. */
function sameItems(a: Basket, b: Basket): boolean {
  const counts = (basket: Basket) => {
    const totals = new Map<ItemId, number>();
    for (const { itemId, quantity } of basket) totals.set(itemId, (totals.get(itemId) ?? 0) + quantity);
    return totals;
  };
  const [countsA, countsB] = [counts(a), counts(b)];
  return countsA.size === countsB.size && [...countsA].every(([itemId, quantity]) => countsB.get(itemId) === quantity);
}

/**
 * The customer at the counter is done with: `served` is what the Player handed over, checked exactly
 * against the hidden order with no model judgement, or null if they gave up unserved (out of Patience).
 */
export function applyShiftCustomer(state: GameState, served: Basket | null): { state: GameState; correct: boolean } {
  const { shift } = state.possessions;
  if (!shift?.customer) return { state, correct: false };
  const correct = served !== null && sameItems(served, shift.customer.order);
  const after = {
    ...shift,
    served: shift.served + (correct ? 1 : 0),
    failed: shift.failed + (correct ? 0 : 1),
    customer: null,
  };
  return { state: { ...state, possessions: { ...state.possessions, shift: after } }, correct };
}

/**
 * The Shift is over and paid: base × share of customers served × Mood modifier × the stake multiplier
 * for the highest step reached, minus the step's dock (a share of base pay) per failed customer, never below 0.
 */
export function endShift(state: GameState): { state: GameState; payInShifts: number } {
  const { shift } = state.possessions;
  if (!shift) return { state, payInShifts: 0 };
  const base = ECONOMY.shiftBasePayInShifts;
  const { stakeMultiplier, failedCustomerDock } = PROFICIENCY_STEP_TABLE[state.progression.highestStep];
  const earned = base * (shift.served / shift.customers) * moodModifier(state.character.mood) * stakeMultiplier;
  const payInShifts = Math.max(0, earned - shift.failed * failedCustomerDock * base);
  return {
    state: {
      ...state,
      character: { ...state.character, moneyInShifts: state.character.moneyInShifts + payInShifts },
      possessions: { ...state.possessions, shift: null },
    },
    payInShifts,
  };
}

/**
 * The Shift can't go on through no fault of the Player's (no voice service at all). Before any customer has been
 * dealt with, it's as if it never started, so the day's Shift can still be worked; after, it ends and pays as usual.
 */
export function cancelShift(state: GameState): GameState {
  const { shift } = state.possessions;
  if (!shift || shift.served + shift.failed > 0) return endShift(state).state;
  return {
    ...state,
    progression: { ...state.progression, lastShiftDay: null },
    possessions: { ...state.possessions, shift: null },
  };
}
