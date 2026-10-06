import type { JobId, PlaceId } from '../sim/index.ts';
import type { Band } from './defineInteraction.ts';
import { CAFE_MENU, DRINK_SIZES, DRINK_TEMPERATURES, ITEMS, type DrinkExtra, type DrinkModifiers, type DrinkSize, type DrinkTemperature, type ItemId } from './items.ts';

/** Where each Job is worked: E at this place's staff door starts a Shift. */
export const JOB_PLACES: Record<JobId, PlaceId> = {
  barista: 'cafe',
  cashier: 'supermarket',
  server: 'restaurant',
};

/** What a Shift Customer of one template wants, and how hard they are to serve. */
export type ShiftTemplate = {
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

/** The café's drinks: everything on its menu that quenches Thirst. */
const CAFE_DRINKS = CAFE_MENU.filter(isDrink);

/** The café drinks made to order, in any size, hot or iced, and the extras each one takes. */
const MADE_TO_ORDER = {
  sizes: DRINK_SIZES,
  temperatures: DRINK_TEMPERATURES,
  extras: { coffee: ['milk', 'sugar', 'extra-shot'], tea: ['milk', 'sugar', 'lemon'] },
} as const satisfies NonNullable<ShiftTemplate['modifiers']>;
const MADE_TO_ORDER_DRINKS = Object.keys(MADE_TO_ORDER.extras) as ItemId[];

/**
 * The Shift Customer templates for each Job that has them so far. At the café: one drink, tapped on the menu grid (B);
 * a drink with a size, hot or iced and an extra, set with the modifier toggles (I); and one who changes their mind
 * halfway, so the tray has to be undone (A).
 */
export const SHIFT_TEMPLATES = {
  barista: [
    { id: 'barista-single-drink', band: 'B', drinks: CAFE_DRINKS, modifiers: null, changesMind: false },
    { id: 'barista-made-to-order', band: 'I', drinks: MADE_TO_ORDER_DRINKS, modifiers: MADE_TO_ORDER, changesMind: false },
    { id: 'barista-change-of-mind', band: 'A', drinks: MADE_TO_ORDER_DRINKS, modifiers: MADE_TO_ORDER, changesMind: true },
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

/** What the Player can tap on a Job's grid during a Shift: the barista's is the whole café menu. */
export const SHIFT_MENUS: Partial<Record<JobId, readonly ItemId[]>> = { barista: CAFE_MENU };

/** The Job worked at this place, whose staff door is there, or null. */
export function jobAt(placeId: PlaceId): JobId | null {
  return (Object.keys(JOB_PLACES) as JobId[]).find((jobId) => JOB_PLACES[jobId] === placeId) ?? null;
}
