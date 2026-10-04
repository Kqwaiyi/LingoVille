import { WELL_BEING } from '../sim/index.ts';

// The shared catalogue of things the town sells. What an item does and what it
// costs are authored once, here; each Culture Pack gives it a local name and
// glosses (culturePacks.ts) and converts its price to local money (currency.ts).

export const ITEM_IDS = ['latte', 'coffee', 'tea', 'pastry'] as const;
export type ItemId = (typeof ITEM_IDS)[number];

/** What the café serves, in every pack. Its menu board and its order interaction both read this. */
export const CAFE_MENU = ['latte', 'coffee', 'tea', 'pastry'] as const satisfies readonly ItemId[];

/** What consuming an item gives back to the Character's Well-being. */
export type Restores = { hunger?: number; thirst?: number };

export type Item = {
  /** Authored once, as a ratio of one Shift's base pay. Each pack converts it. */
  priceInShifts: number;
  restores: Restores;
};

export const ITEMS: Record<ItemId, Item> = {
  latte: { priceInShifts: 0.075, restores: { thirst: WELL_BEING.cafeDrinkThirst } },
  coffee: { priceInShifts: 0.0625, restores: { thirst: WELL_BEING.cafeDrinkThirst } },
  tea: { priceInShifts: 0.05, restores: { thirst: WELL_BEING.cafeDrinkThirst } },
  pastry: { priceInShifts: 0.1, restores: { hunger: WELL_BEING.cafeFoodHunger } },
};
