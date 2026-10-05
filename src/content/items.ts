import { WELL_BEING } from '../sim/index.ts';

// The shared catalogue of things the town sells. What an item does and what it
// costs are authored once, here; each Culture Pack gives it a local name and
// glosses (culturePacks.ts) and converts its price to local money (currency.ts).

export const ITEM_IDS = ['latte', 'coffee', 'tea', 'pastry', 'snack', 'bento', 'vegetables', 'eggs', 'noodles'] as const;
export type ItemId = (typeof ITEM_IDS)[number];

/** What the café serves, in every pack. Its menu board and its order interaction both read this. */
export const CAFE_MENU = ['latte', 'coffee', 'tea', 'pastry'] as const satisfies readonly ItemId[];

/** What the convenience store sells over the counter, in every pack: a hot snack, and a bento it heats up. */
export const CONVENIENCE_MENU = ['snack', 'bento'] as const satisfies readonly ItemId[];

/** The groceries on the supermarket's shelves, in every pack. */
export const GROCERIES_SOLD = ['vegetables', 'eggs', 'noodles'] as const satisfies readonly ItemId[];
export type GroceryId = (typeof GROCERIES_SOLD)[number];

/** What consuming an item gives back to the Character's Well-being. */
export type Restores = { hunger?: number; thirst?: number };

export type Item = {
  /** Authored once, as a ratio of one Shift's base pay. Each pack converts it. */
  priceInShifts: number;
  /** What it gives back when it's served. Groceries give nothing until they're cooked. */
  restores: Restores;
  /** Groceries only: how many home meals one cooks. Groceries go into the inventory and go off. */
  meals?: number;
};

export const ITEMS: Record<ItemId, Item> = {
  latte: { priceInShifts: 0.075, restores: { thirst: WELL_BEING.cafeDrinkThirst } },
  coffee: { priceInShifts: 0.0625, restores: { thirst: WELL_BEING.cafeDrinkThirst } },
  tea: { priceInShifts: 0.05, restores: { thirst: WELL_BEING.cafeDrinkThirst } },
  pastry: { priceInShifts: 0.1, restores: { hunger: WELL_BEING.cafeFoodHunger } },
  snack: { priceInShifts: 0.07, restores: { hunger: WELL_BEING.counterSnackHunger } },
  bento: { priceInShifts: 0.12, restores: { hunger: WELL_BEING.bentoHunger } },
  vegetables: { priceInShifts: 0.06, restores: {}, meals: 1 },
  eggs: { priceInShifts: 0.06, restores: {}, meals: 1 },
  noodles: { priceInShifts: 0.06, restores: {}, meals: 1 },
};
