import type { JobId, PlaceId } from '../sim/index.ts';
import type { Band } from './defineInteraction.ts';
import { CAFE_MENU, ITEMS, type ItemId } from './items.ts';

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
  /** A single-drink customer orders one of these. */
  drinks: readonly ItemId[];
};

/** The café's drinks: everything on its menu that quenches Thirst. */
const CAFE_DRINKS = CAFE_MENU.filter((item) => (ITEMS[item].restores.thirst ?? 0) > 0);

/** The Shift Customer template for each Job that has one so far: at the café, one drink, tapped on the menu grid. */
export const SHIFT_TEMPLATES = {
  barista: { id: 'barista-single-drink', band: 'B', drinks: CAFE_DRINKS },
} as const satisfies Partial<Record<JobId, ShiftTemplate>>;

/** The Shift Customer template for a Job, or null for a Job with none yet. */
export function shiftTemplate(jobId: JobId): ShiftTemplate | null {
  return (SHIFT_TEMPLATES as Partial<Record<JobId, ShiftTemplate>>)[jobId] ?? null;
}

/** What the Player can tap on a Job's grid during a Shift: the barista's is the whole café menu. */
export const SHIFT_MENUS: Partial<Record<JobId, readonly ItemId[]>> = { barista: CAFE_MENU };

/** The Job worked at this place, whose staff door is there, or null. */
export function jobAt(placeId: PlaceId): JobId | null {
  return (Object.keys(JOB_PLACES) as JobId[]).find((jobId) => JOB_PLACES[jobId] === placeId) ?? null;
}
