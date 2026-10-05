import { addDebt } from './debts.ts';
import { throwOutSpoiled } from './inventory.ts';
import type { GameState } from './state.ts';
import { clampMeter } from './meters.ts';
import { CLOCK, ECONOMY, MOOD, WELL_BEING } from './tuning.ts';

/**
 * Health has run out: the Character faints and wakes in the hospital's ward
 * at 08:00 the next day, losing the rest of today. Past midnight, as after a
 * late bedtime, "the next day" is the same day number. The bill is paid if there's
 * money enough; otherwise it all becomes hospital debt, and the money is left
 * for food. Nothing in the game kills the Character.
 */
export function faint(state: GameState): GameState {
  const bill = ECONOMY.faintingBillInShifts;
  const { character } = state;
  const canPay = character.moneyInShifts >= bill;
  const { day, minuteOfDay } = state.clock;
  // Before the night is over (when the bed would wake the Character), the next day is the same day number.
  const wakeDay = minuteOfDay < CLOCK.wakeAt ? day : day + 1;
  return throwOutSpoiled({
    ...state,
    clock: { day: wakeDay, minuteOfDay: CLOCK.faintWakeAt },
    placeId: 'clinic',
    wokeInWardOnDay: wakeDay,
    character: {
      ...character,
      ...WELL_BEING.afterFainting,
      mood: clampMeter(character.mood + MOOD.changes.fainting),
      moneyInShifts: canPay ? character.moneyInShifts - bill : character.moneyInShifts,
    },
    debts: canPay ? state.debts : addDebt(state.debts, { kind: 'hospital', amountInShifts: bill }),
  });
}

/** The Character fainted somewhere between these two states of the game. */
export function faintedBetween(before: GameState, after: GameState): boolean {
  return after.wokeInWardOnDay !== before.wokeInWardOnDay;
}
