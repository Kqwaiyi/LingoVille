import type { ItemId } from '../content/index.ts';
import type { ShiftOrder } from './state.ts';

/**
 * A Culture Pack's money at the supermarket till, in local money: what each item rings up at, and the coins and
 * notes in the drawer, smallest first. The sim draws a cash customer's money from it; the content module builds it.
 */
export type Till = { prices: Record<ItemId, number>; denominations: readonly number[] };

/**
 * Local money in hundredths, a whole number: prices and coins down to a penny or a fen add up exactly,
 * with no floating-point dust (0.1 + 0.2).
 */
export const hundredths = (amount: number) => Math.round(amount * 100);

/** What the items come to at this till. */
export function tillTotal(items: ShiftOrder, till: Till): number {
  return items.reduce((sum, { itemId, quantity }) => sum + hundredths(till.prices[itemId]) * quantity, 0) / 100;
}

/** The change owed on `cash` for a sale of `total`: negative if the cash doesn't cover it. */
export function changeOwed(cash: number, total: number): number {
  return (hundredths(cash) - hundredths(total)) / 100;
}

/** What these coins and notes add up to. */
export function coinsTotal(coins: readonly number[]): number {
  return coins.reduce((sum, coin) => sum + hundredths(coin), 0) / 100;
}

/**
 * The Cashier skill's coin suggestion: `amount` made up with the fewest coins and notes from `denominations`,
 * largest first. It only does the counting out: what the change should be is the Player's to work out.
 */
export function suggestChange(amount: number, denominations: readonly number[]): number[] {
  let left = hundredths(amount);
  const coins: number[] = [];
  for (const coin of [...denominations].sort((a, b) => b - a)) {
    const each = hundredths(coin);
    while (left >= each) {
      coins.push(coin);
      left -= each;
    }
  }
  return coins;
}
