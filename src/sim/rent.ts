import { addDebt } from './debts.ts';
import { clampMeter } from './meters.ts';
import { weeklyRent } from './rentPrice.ts';
import type { GameState } from './state.ts';
import { ECONOMY, MOOD } from './tuning.ts';

/** What the Character owes the landlord as debt: unpaid rent from past weeks. */
export function rentDebt(state: GameState): number {
  return state.debts.find((debt) => debt.kind === 'rent')?.amountInShifts ?? 0;
}

/**
 * The end of `day`. On the due day, whatever is unpaid of this week's rent
 * becomes rent debt (never taken from the Character's money), and the next
 * week's rent is owed, at the Newcomer Discount for the highest step reached. Rent debt then costs Mood, unless the landlord gave more time.
 */
function endDay(state: GameState, day: number): GameState {
  let { rent, debts } = state;
  if (day === rent.dueDay) {
    if (rent.owedInShifts > 0) debts = addDebt(debts, { kind: 'rent', amountInShifts: rent.owedInShifts });
    rent = {
      ...rent,
      dueDay: rent.dueDay + ECONOMY.rentPeriodDays,
      owedInShifts: weeklyRent(state.progression.highestStep),
    };
  }
  const after = { ...state, rent, debts };
  const extended = rent.extendedThroughDay !== null && day <= rent.extendedThroughDay;
  if (rentDebt(after) === 0 || extended) return after;
  return { ...after, character: { ...after.character, mood: clampMeter(after.character.mood + MOOD.debtPenaltyPerDay) } };
}

/** Ends each day the clock has moved past since `fromDay`, so rent falls due however the day ended: awake, asleep or fainted. */
export function endDaysSince(fromDay: number, state: GameState): GameState {
  let after = state;
  for (let day = fromDay; day < state.clock.day; day++) after = endDay(after, day);
  return after;
}

/**
 * An amount this close to what's owed, in Shifts, is what's owed: the landlord reads money back to
 * the cent (a 60th of a cent's worth in the smallest anchor is about 0.0001), and Shifts go through floating point.
 */
const SAME_AMOUNT = 1e-3;

/** All the Character owes the landlord: rent debt, then this week's rent. */
export function rentOwed(state: GameState): number {
  return rentDebt(state) + state.rent.owedInShifts;
}

export type RentPayment = { kind: 'paid'; state: GameState } | { kind: 'wrong_amount' } | { kind: 'cannot_afford' };

/**
 * The Character pays the landlord: rent debt first, then this week's rent, so
 * rent paid ahead never becomes debt. Debt is only ever repaid here, at the
 * counter. Nothing, or more than is owed, is refused, as is more than the Character has.
 */
export function payRent(state: GameState, amountInShifts: number): RentPayment {
  const owed = rentOwed(state);
  if (amountInShifts <= 0 || amountInShifts > owed + SAME_AMOUNT) return { kind: 'wrong_amount' };
  const amount = Math.min(amountInShifts, owed);
  if (amount > state.character.moneyInShifts + SAME_AMOUNT) return { kind: 'cannot_afford' };

  const toDebt = Math.min(amount, rentDebt(state));
  const debtLeft = rentDebt(state) - toDebt;
  const weekLeft = state.rent.owedInShifts - (amount - toDebt);
  const debts = state.debts.flatMap((debt) =>
    debt.kind !== 'rent' ? [debt] : debtLeft > SAME_AMOUNT ? [{ ...debt, amountInShifts: debtLeft }] : [],
  );
  return {
    kind: 'paid',
    state: {
      ...state,
      character: { ...state.character, moneyInShifts: Math.max(0, state.character.moneyInShifts - amount) },
      rent: { ...state.rent, owedInShifts: weekLeft > SAME_AMOUNT ? weekLeft : 0 },
      debts,
    },
  };
}

/**
 * The landlord gives the Character `days` more time: rent debt costs no Mood
 * at the end of those days. They count from the due day while this week's rent
 * isn't yet debt, and from today once it is. An extension already given is never shortened.
 */
export function grantExtension(state: GameState, days: number): GameState {
  const { day } = state.clock;
  const from = rentDebt(state) > 0 ? day : Math.max(day, state.rent.dueDay);
  const through = from + days - 1;
  const extendedThroughDay = Math.max(through, state.rent.extendedThroughDay ?? through);
  return { ...state, rent: { ...state.rent, extendedThroughDay } };
}

/** What the landlord knows about the Character's rent. Never the Character's money: the sim checks what they can afford. */
export type RentStatement = {
  today: number;
  /** This week's rent falls due at the end of this day. */
  dueDay: number;
  owedThisWeekInShifts: number;
  debtInShifts: number;
  /** A week's rent at the Newcomer Discount for the highest step reached: what each new week costs. */
  weeklyRentInShifts: number;
};

export function rentStatement(state: GameState): RentStatement {
  return {
    today: state.clock.day,
    dueDay: state.rent.dueDay,
    owedThisWeekInShifts: state.rent.owedInShifts,
    debtInShifts: rentDebt(state),
    weeklyRentInShifts: weeklyRent(state.progression.highestStep),
  };
}
