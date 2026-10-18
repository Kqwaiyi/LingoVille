import { z } from 'zod';

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
  'batteries',
  'stamps',
  'gift-card',
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

/** The café's everyday drinks and food, in every pack: what Shift Customers order from the barista. */
export const CAFE_MENU = ['latte', 'coffee', 'tea', 'pastry'] as const satisfies readonly ItemId[];

/** The café's treats, in every pack: a cake and a special drink. Customers order them, Shift Customers don't. */
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

/** How one café drink is made: a size, hot or iced, and any extras. */
export type DrinkModifiers = { size: DrinkSize; temperature: DrinkTemperature; extras: readonly DrinkExtra[] };

/** The schema of how a café drink is made, for anything that stores or sends one. */
export const drinkModifiersSchema = z.object({
  size: z.enum(DRINK_SIZES),
  temperature: z.enum(DRINK_TEMPERATURES),
  extras: z.array(z.enum(DRINK_EXTRAS)).readonly(),
}) satisfies z.ZodType<DrinkModifiers>;

/** The groceries on the supermarket's shelves, in every pack. */
export const GROCERIES_SOLD = ['vegetables', 'eggs', 'noodles'] as const satisfies readonly ItemId[];
export type GroceryId = (typeof GROCERIES_SOLD)[number];

/** What the supermarket keeps behind its till, in every pack: a customer has to ask the cashier for it. */
export const BEHIND_THE_COUNTER = ['batteries', 'stamps', 'gift-card'] as const satisfies readonly ItemId[];

/** The restaurant's main dishes, in every pack. Each pack picks a local dish that keeps to the dish's dietary facts (`contains`). */
export const RESTAURANT_DISHES = ['pork-dish', 'chicken-dish', 'fish-dish', 'veggie-dish'] as const satisfies readonly ItemId[];

/** What the restaurant serves to drink with a meal, in every pack. */
export const RESTAURANT_DRINKS = ['juice', 'cola'] as const satisfies readonly ItemId[];

/** Everything on the restaurant's menu: a dish and a drink make a meal. */
export const RESTAURANT_MENU = [...RESTAURANT_DISHES, ...RESTAURANT_DRINKS] as const satisfies readonly ItemId[];

/** What a dish can have in it that some diners don't eat. */
export const INGREDIENTS = ['meat', 'pork', 'seafood'] as const;
export type Ingredient = (typeof INGREDIENTS)[number];

/** A dietary need a diner can tell the server, which the server notes on the order pad. */
export const DIETARY_NOTE_IDS = ['vegetarian', 'no-pork', 'no-seafood'] as const;
export type DietaryNoteId = (typeof DIETARY_NOTE_IDS)[number];

/** What each dietary need rules out, and what it means, in English, for prompts. */
export const DIETARY_NOTES: Record<DietaryNoteId, { avoids: readonly Ingredient[]; means: string }> = {
  vegetarian: { avoids: ['meat', 'pork', 'seafood'], means: 'eats no meat, fish or seafood' },
  'no-pork': { avoids: ['pork'], means: 'eats no pork' },
  'no-seafood': { avoids: ['seafood'], means: 'eats no fish or seafood' },
};

/** The dish keeps to this dietary need: it has nothing in it the need rules out. */
export function dishFits(itemId: ItemId, noteId: DietaryNoteId): boolean {
  const contains = ITEMS[itemId].contains ?? [];
  return !DIETARY_NOTES[noteId].avoids.some((ingredient) => contains.includes(ingredient));
}

export type Item = {
  /** Authored once, as a ratio of one Shift's base pay. Each pack converts it. */
  priceInShifts: number;
  /** It's drunk rather than eaten. */
  drink?: true;
  /** Restaurant dishes only: their dietary facts, which every pack's local dish keeps to. Nothing listed: none of these. */
  contains?: readonly Ingredient[];
};

export const ITEMS: Record<ItemId, Item> = {
  latte: { priceInShifts: 0.075, drink: true },
  coffee: { priceInShifts: 0.0625, drink: true },
  tea: { priceInShifts: 0.05, drink: true },
  pastry: { priceInShifts: 0.1 },
  vegetables: { priceInShifts: 0.06 },
  eggs: { priceInShifts: 0.06 },
  noodles: { priceInShifts: 0.06 },
  batteries: { priceInShifts: 0.07 },
  stamps: { priceInShifts: 0.02 },
  'gift-card': { priceInShifts: 0.5 },
  // A restaurant meal is a dish and a drink, about 0.25 Shift together.
  'pork-dish': { priceInShifts: 0.2, contains: ['meat', 'pork'] },
  'chicken-dish': { priceInShifts: 0.2, contains: ['meat'] },
  'fish-dish': { priceInShifts: 0.2, contains: ['seafood'] },
  'veggie-dish': { priceInShifts: 0.2 },
  juice: { priceInShifts: 0.05, drink: true },
  cola: { priceInShifts: 0.05, drink: true },
  cake: { priceInShifts: 0.12 },
  'special-drink': { priceInShifts: 0.1, drink: true },
};
