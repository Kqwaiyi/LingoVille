import type { DrinkModifiers, ItemId } from '../content/index.ts';
import type { ShiftOrder, ShiftOrderLine } from './state.ts';
import { ECONOMY } from './tuning.ts';

/**
 * What the Player has put on the tray for the Shift Customer at the counter, with the changes they can undo and
 * the ones they've undone and can redo. It lives only in the conversation and is never saved.
 */
export type TrayHistory = { tray: ShiftOrder; undo: readonly ShiftOrder[]; redo: readonly ShiftOrder[] };

export const EMPTY_TRAY: TrayHistory = { tray: [], undo: [], redo: [] };

/** How a drink is made, the same whatever order its extras are in. */
function madeKey(modifiers: DrinkModifiers | undefined) {
  return modifiers ? `${modifiers.size}|${modifiers.temperature}|${[...modifiers.extras].sort().join('+')}` : '';
}

/** The same item made the same way: one line of the order. Ignoring how it's made, just the same item. */
export function lineKey({ itemId, modifiers }: ShiftOrderLine, withModifiers = true) {
  return withModifiers ? `${itemId}|${madeKey(modifiers)}` : itemId;
}

/** The tray changes to `tray`: the change can be undone, and anything undone before can no longer be redone. */
function change(history: TrayHistory, tray: ShiftOrder): TrayHistory {
  return { tray, undo: [...history.undo, history.tray], redo: [] };
}

/**
 * A tap on the menu grid: one more of the item onto the tray, made as `modifiers` say (null for something not made
 * to order), up to the most a single line can hold.
 */
export function addToTray(history: TrayHistory, itemId: ItemId, modifiers: DrinkModifiers | null): TrayHistory {
  const added: ShiftOrderLine = { itemId, quantity: 1, ...(modifiers && { modifiers }) };
  const key = lineKey(added);
  const line = history.tray.find((l) => lineKey(l) === key);
  if (!line) return change(history, [...history.tray, added]);
  if (line.quantity >= ECONOMY.maxQuantityPerOrderLine) return history;
  return change(
    history,
    history.tray.map((l) => (l === line ? { ...l, quantity: l.quantity + 1 } : l)),
  );
}

/** Everything comes off the tray. It can be undone. */
export function clearTray(history: TrayHistory): TrayHistory {
  return history.tray.length === 0 ? history : change(history, []);
}

/** Takes back the last change to the tray. */
export function undoTray(history: TrayHistory): TrayHistory {
  const previous = history.undo.at(-1);
  if (!previous) return history;
  return { tray: previous, undo: history.undo.slice(0, -1), redo: [...history.redo, history.tray] };
}

/** Puts back the last change undone. */
export function redoTray(history: TrayHistory): TrayHistory {
  const next = history.redo.at(-1);
  if (!next) return history;
  return { tray: next, undo: [...history.undo, history.tray], redo: history.redo.slice(0, -1) };
}
