import type { DietaryNoteId, ItemId } from '../content/index.ts';
import type { PadDiner, ShiftOrder } from './state.ts';
import { ECONOMY } from './tuning.ts';

/**
 * The server's order pad for the table being served: a line per diner written so far, and which line the Player is
 * writing on (`at`). It lives only in the conversation and is never saved.
 */
export type OrderPad = { diners: readonly PadDiner[]; at: number };

const BLANK_LINE: PadDiner = { dish: null, drink: null, note: null };

/** A fresh pad: one blank line for the first diner. */
export const EMPTY_PAD: OrderPad = { diners: [BLANK_LINE], at: 0 };

/** The line being written changes. */
function changeLine(pad: OrderPad, change: (diner: PadDiner) => PadDiner): OrderPad {
  return { ...pad, diners: pad.diners.map((diner, i) => (i === pad.at ? change(diner) : diner)) };
}

/** A tap on the menu: the dish (or the drink) on the line being written, in place of any written before. */
export function writeOnPad(pad: OrderPad, itemId: ItemId, course: 'dish' | 'drink'): OrderPad {
  return changeLine(pad, (diner) => ({ ...diner, [course]: itemId }));
}

/** A dietary note on the line being written, in place of any before (null takes it off). */
export function noteOnPad(pad: OrderPad, note: DietaryNoteId | null): OrderPad {
  return changeLine(pad, (diner) => ({ ...diner, note }));
}

/** A blank line for another diner, which is then the one being written, up to the biggest table there is. */
export function addPadLine(pad: OrderPad): OrderPad {
  if (pad.diners.length >= ECONOMY.tableDiners.max) return pad;
  return { diners: [...pad.diners, BLANK_LINE], at: pad.diners.length };
}

/** Writing on another diner's line. */
export function choosePadLine(pad: OrderPad, index: number): OrderPad {
  return index >= 0 && index < pad.diners.length ? { ...pad, at: index } : pad;
}

/** The line being written comes off the pad, and the one before it is written next. There's always at least one line. */
export function removePadLine(pad: OrderPad): OrderPad {
  if (pad.diners.length <= 1) return pad;
  return { diners: pad.diners.filter((_, i) => i !== pad.at), at: Math.max(0, pad.at - 1) };
}

/** What these diners want (or have written down), for the kitchen: each dish and drink once per diner, the same ones together. */
export function kitchenOrder(diners: readonly PadDiner[]): ShiftOrder {
  const counts = new Map<ItemId, number>();
  for (const { dish, drink } of diners) {
    for (const itemId of [dish, drink]) if (itemId) counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  }
  return [...counts].map(([itemId, quantity]) => ({ itemId, quantity }));
}
