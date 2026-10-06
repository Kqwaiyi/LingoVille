import type { JobId, PlaceId } from '../sim/index.ts';
import type { Band } from './defineInteraction.ts';
import {
  BEHIND_THE_COUNTER,
  CAFE_MENU,
  DRINK_SIZES,
  DRINK_TEMPERATURES,
  GROCERIES_SOLD,
  ITEMS,
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

/** What a Shift Customer of one template wants, and how hard they are to serve: a café drink, or a checkout at the till. */
export type ShiftTemplate = DrinkTemplate | CheckoutTemplate;

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
  extras: { coffee: ['milk', 'sugar', 'extra-shot'], tea: ['milk', 'sugar', 'lemon'] },
} as const satisfies NonNullable<DrinkTemplate['modifiers']>;
const MADE_TO_ORDER_DRINKS = Object.keys(MADE_TO_ORDER.extras) as ItemId[];

/**
 * The Shift Customer templates for each Job that has them so far. At the café: one drink, tapped on the menu grid (B);
 * a drink with a size, hot or iced and an extra, set with the modifier toggles (I); and one who changes their mind
 * halfway, so the tray has to be undone (A). At the supermarket till: shopping to scan, with a bag and a points card
 * or not (B); and the same, plus something from behind the counter, paid in cash, with change to count out (I).
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
} as const satisfies Partial<Record<JobId, readonly ShiftTemplate[]>>;

const NO_TEMPLATES: readonly ShiftTemplate[] = [];

/** The Shift Customer templates for a Job, or none for a Job with none yet. */
export function shiftTemplates(jobId: JobId): readonly ShiftTemplate[] {
  return (SHIFT_TEMPLATES as Partial<Record<JobId, readonly ShiftTemplate[]>>)[jobId] ?? NO_TEMPLATES;
}

/** It quenches Thirst, so the barista makes it to order: a size, hot or iced, and extras. */
export function isDrink(itemId: ItemId): boolean {
  return (ITEMS[itemId].restores.thirst ?? 0) > 0;
}

/** How the modifier toggles make a drink until the Player changes them: medium, hot, with nothing added. */
export const DEFAULT_DRINK: DrinkModifiers = { size: 'medium', temperature: 'hot', extras: [] };

/**
 * What the Player can tap during a Shift: the barista's grid is the whole café menu; the cashier scans the
 * shopping on the counter and fetches from behind it.
 */
export const SHIFT_MENUS: Partial<Record<JobId, readonly ItemId[]>> = { barista: CAFE_MENU, cashier: [...GROCERIES_SOLD, ...BEHIND_THE_COUNTER] };

/** The Job worked at this place, whose staff door is there, or null. */
export function jobAt(placeId: PlaceId): JobId | null {
  return (Object.keys(JOB_PLACES) as JobId[]).find((jobId) => JOB_PLACES[jobId] === placeId) ?? null;
}
