import type { ItemId } from '../content/index.ts';
import { ECONOMY } from './tuning.ts';

/** What the Character has taken off the supermarket shelves, to pay for at the till. It's never saved. */
export type Basket = readonly { itemId: ItemId; quantity: number }[];

/** One more of an item into the basket, up to the most a single line can hold. */
export function addToBasket(basket: Basket, itemId: ItemId): Basket {
  const line = basket.find((l) => l.itemId === itemId);
  if (!line) return [...basket, { itemId, quantity: 1 }];
  if (line.quantity >= ECONOMY.maxQuantityPerOrderLine) return basket;
  return basket.map((l) => (l.itemId === itemId ? { itemId, quantity: l.quantity + 1 } : l));
}

/** Puts one of an item back on its shelf. */
export function putBackFromBasket(basket: Basket, itemId: ItemId): Basket {
  return basket.flatMap((l) => (l.itemId !== itemId ? [l] : l.quantity > 1 ? [{ itemId, quantity: l.quantity - 1 }] : []));
}
