import { addDebt } from './debts.ts';
import type { GameState, RestaurantTable } from './state.ts';

/** What everything on this bill comes to, at the menu prices it was ordered at. */
export function billTotal(bill: RestaurantTable['bill']): number {
  return bill.reduce((total, { priceInShifts, quantity }) => total + priceInShifts * quantity, 0);
}

/** What the Character owes the restaurant from bills they walked out on. */
export function restaurantDebt(state: GameState): number {
  return state.debts.find((debt) => debt.kind === 'restaurant')?.amountInShifts ?? 0;
}

/**
 * The Character leaves the restaurant, walking out or taken away fainting: they give up the table, and anything
 * still on the bill becomes restaurant debt, which only the server takes payment for.
 */
export function leaveTable(state: GameState): GameState {
  const { bill } = state.restaurant;
  const debts = bill.length > 0 ? addDebt(state.debts, { kind: 'restaurant', amountInShifts: billTotal(bill) }) : state.debts;
  return { ...state, restaurant: { seated: false, bill: [] }, debts };
}
