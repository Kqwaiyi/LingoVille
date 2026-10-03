import { WELL_BEING } from '../sim/index.ts';

// What the café sells, the same in every Culture Pack. Each pack gives the
// items local names (culturePacks.ts); ticket 11 adds pack-specific goods.

export const CAFE_ITEM_IDS = ['latte', 'coffee', 'tea'] as const;
export type CafeItemId = (typeof CAFE_ITEM_IDS)[number];

/** What consuming an item gives back to the Character's Well-being. */
export type Restores = { hunger?: number; thirst?: number };

export type CafeItem = {
  /** Authored once, as a ratio of one Shift's base pay. Each pack converts it. */
  priceInShifts: number;
  restores: Restores;
  /** The item in English, the UI language until ticket 11 adds glosses for every Native Language. */
  gloss: string;
};

export const CAFE_ITEMS: Record<CafeItemId, CafeItem> = {
  latte: { priceInShifts: 0.075, restores: { thirst: WELL_BEING.cafeDrinkThirst }, gloss: 'Hot latte' },
  coffee: { priceInShifts: 0.0625, restores: { thirst: WELL_BEING.cafeDrinkThirst }, gloss: 'Coffee' },
  tea: { priceInShifts: 0.05, restores: { thirst: WELL_BEING.cafeDrinkThirst }, gloss: 'Black tea' },
};
