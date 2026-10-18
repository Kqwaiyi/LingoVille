// The shared catalogue of things the town sells. What an item does and what it
// costs are authored once, here; each Culture Pack gives it a local name and
// glosses (culturePacks.ts) and converts its price to local money (currency.ts).

export const ITEM_IDS = [
  'latte',
  'coffee',
  'tea',
  'pastry',
  'vegetables',
  'eggs',
  'noodles',
  'pork-dish',
  'chicken-dish',
  'fish-dish',
  'veggie-dish',
  'juice',
  'cola',
  'cake',
  'special-drink',
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

/** The café's everyday drinks and food, in every pack. */
export const CAFE_MENU = ['latte', 'coffee', 'tea', 'pastry'] as const satisfies readonly ItemId[];

/** The café's treats, in every pack: a cake and a special drink. */
export const CAFE_TREATS = ['cake', 'special-drink'] as const satisfies readonly ItemId[];

/** Everything the café serves a customer. Its menu board and its order interaction both read this. */
export const CAFE_COUNTER = [...CAFE_MENU, ...CAFE_TREATS] as const satisfies readonly ItemId[];

/** The sizes a café drink is made in. */
export const DRINK_SIZES = ['small', 'medium', 'large'] as const;
export type DrinkSize = (typeof DRINK_SIZES)[number];

/** A café drink is made hot or iced. */
export const DRINK_TEMPERATURES = ['hot', 'iced'] as const;
export type DrinkTemperature = (typeof DRINK_TEMPERATURES)[number];

/** What can be added to a café drink. */
export const DRINK_EXTRAS = ['milk', 'sugar', 'extra-shot', 'lemon'] as const;
export type DrinkExtra = (typeof DRINK_EXTRAS)[number];

/** What can be added to each café drink made to order: the drinks a customer orders in a size, hot or iced. */
export const MADE_TO_ORDER_EXTRAS: Partial<Record<ItemId, readonly DrinkExtra[]>> = {
  coffee: ['milk', 'sugar', 'extra-shot'],
  tea: ['milk', 'sugar', 'lemon'],
};

/** The café drink is made to order: in a size, hot or iced, with the extras it takes. */
export const isMadeToOrder = (itemId: ItemId) => MADE_TO_ORDER_EXTRAS[itemId] !== undefined;

/** What a café customer can be allergic to. Each Culture Pack says which of its café items have each in them. */
export const ALLERGENS = ['milk', 'egg', 'wheat'] as const;
export type Allergen = (typeof ALLERGENS)[number];

/** What an extra adds to a drink that a customer can be allergic to. */
export const EXTRA_ALLERGENS: Partial<Record<DrinkExtra, readonly Allergen[]>> = { milk: ['milk'] };

/** Every way a café drink can be made, which each Culture Pack names. */
export const DRINK_OPTIONS = [...DRINK_SIZES, ...DRINK_TEMPERATURES, ...DRINK_EXTRAS] as const;
export type DrinkOptionId = (typeof DRINK_OPTIONS)[number];

/** The groceries on the supermarket's shelves, in every pack. */
export const GROCERIES_SOLD = ['vegetables', 'eggs', 'noodles'] as const satisfies readonly ItemId[];
export type GroceryId = (typeof GROCERIES_SOLD)[number];

/** The restaurant's main dishes, in every pack. */
export const RESTAURANT_DISHES = ['pork-dish', 'chicken-dish', 'fish-dish', 'veggie-dish'] as const satisfies readonly ItemId[];

/** What the restaurant serves to drink with a meal, in every pack. */
export const RESTAURANT_DRINKS = ['juice', 'cola'] as const satisfies readonly ItemId[];

/** Everything on the restaurant's menu: a dish and a drink make a meal. */
export const RESTAURANT_MENU = [...RESTAURANT_DISHES, ...RESTAURANT_DRINKS] as const satisfies readonly ItemId[];

export type Item = {
  /** Authored once, as a ratio of one Shift's base pay. Each pack converts it. */
  priceInShifts: number;
};

export const ITEMS: Record<ItemId, Item> = {
  latte: { priceInShifts: 0.075 },
  coffee: { priceInShifts: 0.0625 },
  tea: { priceInShifts: 0.05 },
  pastry: { priceInShifts: 0.1 },
  vegetables: { priceInShifts: 0.06 },
  eggs: { priceInShifts: 0.06 },
  noodles: { priceInShifts: 0.06 },
  // A restaurant meal is a dish and a drink, about 0.25 Shift together.
  'pork-dish': { priceInShifts: 0.2 },
  'chicken-dish': { priceInShifts: 0.2 },
  'fish-dish': { priceInShifts: 0.2 },
  'veggie-dish': { priceInShifts: 0.2 },
  juice: { priceInShifts: 0.05 },
  cola: { priceInShifts: 0.05 },
  cake: { priceInShifts: 0.12 },
  'special-drink': { priceInShifts: 0.1 },
};
