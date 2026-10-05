import type { OrderLine } from '../content/index.ts';
import type { GameState, InventoryItem } from './state.ts';
import { GROCERIES } from './tuning.ts';

/**
 * Puts bought things into the inventory on `day`. Groceries go off `GROCERIES.expiryDays`
 * later, so they join only what was bought the same day; goods that keep join any of their kind.
 */
export function stockInventory(inventory: InventoryItem[], bought: readonly OrderLine[], day: number): InventoryItem[] {
  return bought.reduce((stock, { itemId, quantity, goesOff }) => {
    const expiresOnDay = goesOff ? day + GROCERIES.expiryDays : null;
    const same = (item: InventoryItem) => item.itemId === itemId && item.expiresOnDay === expiresOnDay;
    if (!stock.some(same)) return [...stock, { itemId, quantity, expiresOnDay }];
    return stock.map((item) => (same(item) ? { ...item, quantity: item.quantity + quantity } : item));
  }, inventory);
}

/** Groceries are fresh up to the end of their expiry day, and gone off after it. Goods that keep never go off. */
export function isGoneOff({ expiresOnDay }: InventoryItem, day: number): boolean {
  return expiresOnDay !== null && day > expiresOnDay;
}

const thrownOut = ({ expiresOnDay }: InventoryItem, day: number) =>
  expiresOnDay !== null && day > expiresOnDay + GROCERIES.goneOffDaysKept;

/** Throws out groceries that have been off too long. Called whenever the clock moves on. */
export function throwOutSpoiled(state: GameState): GameState {
  const { inventory } = state.possessions;
  const kept = inventory.filter((item) => !thrownOut(item, state.clock.day));
  if (kept.length === inventory.length) return state;
  return { ...state, possessions: { ...state.possessions, inventory: kept } };
}
