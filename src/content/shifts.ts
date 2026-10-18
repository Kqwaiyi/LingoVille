import type { JobId, PlaceId } from '../sim/index.ts';
import type { Band } from './defineInteraction.ts';
import {
  BEHIND_THE_COUNTER,
  CAFE_MENU,
  dishFits,
  DRINK_SIZES,
  DRINK_TEMPERATURES,
  GROCERIES_SOLD,
  ITEMS,
  MADE_TO_ORDER_EXTRAS,
  RESTAURANT_DISHES,
  RESTAURANT_DRINKS,
  RESTAURANT_MENU,
  type DietaryNoteId,
  type DrinkExtra,
  type DrinkModifiers,
  type DrinkSize,
  type DrinkTemperature,
  type ItemId,
} from './items.ts';

/** Where each Job is worked: E at this place's staff door starts a Shift. */
export const JOB_PLACES: Record<JobId, PlaceId> = {
  barista: 'cafe',
  cashier: 'supermarket',
  server: 'restaurant',
};

/** What a Shift Customer of one template wants, and how hard they are to serve: a café drink, a checkout at the till, or a restaurant table's meals. */
export type ShiftTemplate = DrinkTemplate | CheckoutTemplate | TableTemplate;

/** A café customer, who orders a drink. */
export type DrinkTemplate = {
  /** kebab-case, stable. */
  id: string;
  band: Band;
  /** The customer orders one of these. */
  drinks: readonly ItemId[];
  /** Null: the drink alone. Otherwise it's made in one of these sizes, hot or iced, with one of the extras that drink takes. */
  modifiers: {
    sizes: readonly DrinkSize[];
    temperatures: readonly DrinkTemperature[];
    extras: Partial<Record<ItemId, readonly DrinkExtra[]>>;
  } | null;
  /** Halfway through, once the Player has started on it, the customer wants something else instead. */
  changesMind: boolean;
};

/** A supermarket customer at the till, who brings shopping to be rung up. */
export type CheckoutTemplate = {
  /** kebab-case, stable. */
  id: string;
  band: Band;
  /** The shelves their shopping comes from: a few of these, one or more of each. They want a bag or not, and have a points card or not. */
  basket: readonly ItemId[];
  /** Null: they pay by card. Otherwise they ask for one of these from behind the counter, and pay cash. */
  behindTheCounter: readonly ItemId[] | null;
};

/** A restaurant customer, who orders a dish and a drink, alone or for a whole table. */
export type TableTemplate = {
  /** kebab-case, stable. */
  id: string;
  band: Band;
  /** Each diner orders one of these dishes and one of these drinks. */
  dishes: readonly ItemId[];
  drinks: readonly ItemId[];
  /** One diner, or a table of a few (`ECONOMY.tableDiners`), all ordered for at once. */
  party: 'one' | 'table';
  /**
   * Null: no one has a dietary need. Otherwise one diner has one of these needs, and orders one of the dishes listed
   * for it: the dishes that keep to it. (The sim can't read dishes' dietary facts, so the template carries them.)
   */
  dietary: Partial<Record<DietaryNoteId, readonly ItemId[]>> | null;
};

/** It's a restaurant customer, with a table to take an order for. */
export function isTable(template: ShiftTemplate): template is TableTemplate {
  return 'party' in template;
}

/** It's a supermarket customer at the till, rather than a café customer. */
export function isCheckout(template: ShiftTemplate): template is CheckoutTemplate {
  return 'basket' in template;
}

/** The café's drinks: everything on its menu that quenches Thirst. */
const CAFE_DRINKS = CAFE_MENU.filter(isDrink);

/** The café drinks made to order, in any size, hot or iced, and the extras each one takes. */
const MADE_TO_ORDER = {
  sizes: DRINK_SIZES,
  temperatures: DRINK_TEMPERATURES,
  extras: MADE_TO_ORDER_EXTRAS,
} as const satisfies NonNullable<DrinkTemplate['modifiers']>;
const MADE_TO_ORDER_DRINKS = Object.keys(MADE_TO_ORDER.extras) as ItemId[];

/** The restaurant dishes that keep to a dietary need. */
const dishesFitting = (noteId: DietaryNoteId): readonly ItemId[] => RESTAURANT_DISHES.filter((dish) => dishFits(dish, noteId));

/** Every dietary need, with the restaurant dishes that keep to it. */
const DISHES_FOR_EACH_NEED: Record<DietaryNoteId, readonly ItemId[]> = {
  vegetarian: dishesFitting('vegetarian'),
  'no-pork': dishesFitting('no-pork'),
  'no-seafood': dishesFitting('no-seafood'),
};

/**
 * The Shift Customer templates for each Job. At the café: one drink, tapped on the menu grid (B);
 * a drink with a size, hot or iced and an extra, set with the modifier toggles (I); and one who changes their mind
 * halfway, so the tray has to be undone (A). At the supermarket till: shopping to scan, with a bag and a points card
 * or not (B); and the same, plus something from behind the counter, paid in cash, with change to count out (I). At the
 * restaurant: one diner's dish and drink, on the order pad (B); and a table of a few, one with a dietary need, every
 * diner's order and the need noted on the pad (A).
 */
export const SHIFT_TEMPLATES = {
  barista: [
    { id: 'barista-single-drink', band: 'B', drinks: CAFE_DRINKS, modifiers: null, changesMind: false },
    { id: 'barista-made-to-order', band: 'I', drinks: MADE_TO_ORDER_DRINKS, modifiers: MADE_TO_ORDER, changesMind: false },
    { id: 'barista-change-of-mind', band: 'A', drinks: MADE_TO_ORDER_DRINKS, modifiers: MADE_TO_ORDER, changesMind: true },
  ],
  cashier: [
    { id: 'cashier-pays', band: 'B', basket: GROCERIES_SOLD, behindTheCounter: null },
    { id: 'cashier-pays-cash', band: 'I', basket: GROCERIES_SOLD, behindTheCounter: BEHIND_THE_COUNTER },
  ],
  server: [
    { id: 'server-single-order', band: 'B', dishes: RESTAURANT_DISHES, drinks: RESTAURANT_DRINKS, party: 'one', dietary: null },
    { id: 'server-table-dietary', band: 'A', dishes: RESTAURANT_DISHES, drinks: RESTAURANT_DRINKS, party: 'table', dietary: DISHES_FOR_EACH_NEED },
  ],
} as const satisfies Record<JobId, readonly ShiftTemplate[]>;

/** The Shift Customer templates for a Job. */
export function shiftTemplates(jobId: JobId): readonly ShiftTemplate[] {
  return SHIFT_TEMPLATES[jobId];
}

/** It quenches Thirst, so the barista makes it to order: a size, hot or iced, and extras. */
export function isDrink(itemId: ItemId): boolean {
  return (ITEMS[itemId].restores.thirst ?? 0) > 0;
}

/** How the modifier toggles make a drink until the Player changes them: medium, hot, with nothing added. */
export const DEFAULT_DRINK: DrinkModifiers = { size: 'medium', temperature: 'hot', extras: [] };

/**
 * What the Player can tap during a Shift: the barista's grid is the whole café menu; the cashier scans the
 * shopping on the counter and fetches from behind it; the server writes the restaurant's dishes and drinks on the order pad.
 */
export const SHIFT_MENUS: Record<JobId, readonly ItemId[]> = {
  barista: CAFE_MENU,
  cashier: [...GROCERIES_SOLD, ...BEHIND_THE_COUNTER],
  server: RESTAURANT_MENU,
};

/** The Job worked at this place, whose staff door is there, or null. */
export function jobAt(placeId: PlaceId): JobId | null {
  return (Object.keys(JOB_PLACES) as JobId[]).find((jobId) => JOB_PLACES[jobId] === placeId) ?? null;
}
