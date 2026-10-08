import { addDebt } from './debts.ts';
import { throwOutSpoiled } from './inventory.ts';
import type { GameState } from './state.ts';
import { clampMeter } from './meters.ts';
import { endDaysSince } from './days.ts';
import { leaveTable } from './restaurant.ts';
import { CLOCK, ECONOMY, MOOD, WELL_BEING } from './tuning.ts';

/**
 * Health has run out: the Character faints and wakes in the hospital's ward
 * at 08:00 the next day, losing the rest of today. Past midnight, as after a
 * late bedtime, "the next day" is the same day number. The bill is paid if there's
 * money enough; otherwise it all becomes hospital debt, and the money is left
 * for food. The ward cures any Illness. Nothing in the game kills the Character.
 */
export function faint(state: GameState): GameState {
  const bill = ECONOMY.faintingBillInShifts;
  const { character } = state;
  const canPay = character.moneyInShifts >= bill;
  const { day, minuteOfDay } = state.clock;
  // Before the night is over (when the bed would wake the Character), the next day is the same day number.
  const wakeDay = minuteOfDay < CLOCK.wakeAt ? day : day + 1;
  // Taken from the restaurant, the Character gives up the table, and any unpaid bill becomes debt.
  const left = leaveTable(state);
  const fainted: GameState = {
    ...left,
    clock: { day: wakeDay, minuteOfDay: CLOCK.faintWakeAt },
    placeId: 'clinic',
    wokeInWardOnDay: wakeDay,
    character: {
      ...character,
      ...WELL_BEING.afterFainting,
      mood: clampMeter(character.mood + MOOD.changes.fainting),
      // The ward sees to any Illness the Character had. The night's roll may still bring a new one by morning.
      illness: null,
      moneyInShifts: canPay ? character.moneyInShifts - bill : character.moneyInShifts,
    },
    debts: canPay ? left.debts : addDebt(left.debts, { kind: 'hospital', amountInShifts: bill }),
  };
  return throwOutSpoiled(endDaysSince(day, fainted));
}

/** The Character fainted somewhere between these two states of the game. */
export function faintedBetween(before: GameState, after: GameState): boolean {
  return after.wokeInWardOnDay !== before.wokeInWardOnDay;
}
