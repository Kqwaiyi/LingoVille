import { z } from 'zod';
import { WELL_BEING, type ComfortKind } from '../sim/index.ts';

// The shared catalogue of things the town sells. What an item does and what it
// costs are authored once, here; each Culture Pack gives it a local name and
// glosses (culturePacks.ts) and converts its price to local money (currency.ts).

export const ITEM_IDS = [
  'latte',
  'coffee',
  'tea',
  'pastry',
  'snack',
  'bento',
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
  'mystery-novel',
  'cookbook',
  'travel-book',
  'magazine',
  'flowers',
  'chocolates',
  'scented-candle',
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

/** The café's everyday drinks and food, in every pack: what Shift Customers order from the barista. */
export const CAFE_MENU = ['latte', 'coffee', 'tea', 'pastry'] as const satisfies readonly ItemId[];

/** The café's Comfort Purchases, in every pack: a cake and a special drink. Customers order them, Shift Customers don't. */
export const CAFE_COMFORTS = ['cake', 'special-drink'] as const satisfies readonly ItemId[];

/** Everything the café serves a customer. Its menu board and its order interaction both read this. */
export const CAFE_COUNTER = [...CAFE_MENU, ...CAFE_COMFORTS] as const satisfies readonly ItemId[];

/** The sizes a café drink is made in. */
export const DRINK_SIZES = ['small', 'medium', 'large'] as const;
export type DrinkSize = (typeof DRINK_SIZES)[number];

/** A café drink is made hot or iced. */
export const DRINK_TEMPERATURES = ['hot', 'iced'] as const;
export type DrinkTemperature = (typeof DRINK_TEMPERATURES)[number];

/** What can be added to a café drink. */
export const DRINK_EXTRAS = ['milk', 'sugar', 'extra-shot', 'lemon'] as const;
export type DrinkExtra = (typeof DRINK_EXTRAS)[number];

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

/** What the convenience store sells over the counter, in every pack: a hot snack, and a bento it heats up. */
export const CONVENIENCE_MENU = ['snack', 'bento'] as const satisfies readonly ItemId[];

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

/** What the bookshop sells to read, in every pack. Each has a taste (`about`) the shopkeeper recommends it by. */
export const READING_SOLD = ['mystery-novel', 'cookbook', 'travel-book', 'magazine'] as const satisfies readonly ItemId[];

/** The gifts the bookshop sells, in every pack. They go into the inventory, ready to give. */
export const GIFTS_SOLD = ['flowers', 'chocolates', 'scented-candle'] as const satisfies readonly ItemId[];

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

/** What consuming an item gives back to the Character's Well-being. */
export type Restores = { hunger?: number; thirst?: number };

export type Item = {
  /** Authored once, as a ratio of one Shift's base pay. Each pack converts it. */
  priceInShifts: number;
  /** What it gives back when it's served. Groceries give nothing until they're cooked. */
  restores: Restores;
  /** Groceries only: how many home meals one cooks. Groceries go into the inventory and go off. */
  meals?: number;
  /** Restaurant dishes only: their dietary facts, which every pack's local dish keeps to. Nothing listed: none of these. */
  contains?: readonly Ingredient[];
  /** A Comfort Purchase: bought mainly to lift Mood, by this kind's amount. */
  comfort?: ComfortKind;
  /** A gift: kept in the inventory, ready to give, rather than used up when bought. */
  gift?: true;
  /** Books only: what it is and who would like it, in English, for the shopkeeper's recommendation. Every pack's local book keeps to it. */
  about?: string;
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
  batteries: { priceInShifts: 0.07, restores: {} },
  stamps: { priceInShifts: 0.02, restores: {} },
  'gift-card': { priceInShifts: 0.5, restores: {} },
  // A restaurant meal is a dish and a drink, about 0.25 Shift together.
  'pork-dish': { priceInShifts: 0.2, restores: { hunger: WELL_BEING.restaurantDishHunger }, contains: ['meat', 'pork'] },
  'chicken-dish': { priceInShifts: 0.2, restores: { hunger: WELL_BEING.restaurantDishHunger }, contains: ['meat'] },
  'fish-dish': { priceInShifts: 0.2, restores: { hunger: WELL_BEING.restaurantDishHunger }, contains: ['seafood'] },
  'veggie-dish': { priceInShifts: 0.2, restores: { hunger: WELL_BEING.restaurantDishHunger } },
  juice: { priceInShifts: 0.05, restores: { thirst: WELL_BEING.restaurantDrinkThirst } },
  cola: { priceInShifts: 0.05, restores: { thirst: WELL_BEING.restaurantDrinkThirst } },
  cake: { priceInShifts: 0.12, restores: { hunger: WELL_BEING.cafeFoodHunger }, comfort: 'cafe' },
  'special-drink': { priceInShifts: 0.1, restores: { thirst: WELL_BEING.cafeDrinkThirst }, comfort: 'cafe' },
  'mystery-novel': {
    priceInShifts: 0.25,
    restores: {},
    comfort: 'reading',
    about: 'a gripping mystery novel, for someone who likes exciting stories and puzzles',
  },
  cookbook: { priceInShifts: 0.3, restores: {}, comfort: 'reading', about: 'a cookbook of easy home recipes, for someone who likes cooking and food' },
  'travel-book': {
    priceInShifts: 0.25,
    restores: {},
    comfort: 'reading',
    about: 'a book of walks and day trips round the region, with photos, for someone who likes travel and nature',
  },
  magazine: {
    priceInShifts: 0.1,
    restores: {},
    comfort: 'reading',
    about: "this month's lifestyle magazine, for someone who wants something light: fashion, music and what's on in town",
  },
  flowers: { priceInShifts: 0.2, restores: {}, comfort: 'gift', gift: true },
  chocolates: { priceInShifts: 0.15, restores: {}, comfort: 'gift', gift: true },
  'scented-candle': { priceInShifts: 0.25, restores: {}, comfort: 'gift', gift: true },
};

/** Every Comfort Purchase the town sells (the restaurant meal and the bathhouse come with their own tickets). */
export const COMFORT_PURCHASES = ITEM_IDS.filter((id) => ITEMS[id].comfort !== undefined);
