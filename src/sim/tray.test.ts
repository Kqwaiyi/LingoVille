import { describe, expect, it } from 'vitest';
import type { DrinkModifiers } from '../content/index.ts';
import { addToTray, clearTray, ECONOMY, EMPTY_TRAY, redoTray, undoTray, type TrayHistory } from './index.ts';

const HOT: DrinkModifiers = { size: 'medium', temperature: 'hot', extras: [] };
const ICED: DrinkModifiers = { size: 'large', temperature: 'iced', extras: ['lemon'] };

describe('addToTray: a tap on the menu grid', () => {
  it('puts one of the drink on the tray, made as the toggles are set', () => {
    expect(addToTray(EMPTY_TRAY, 'tea', ICED).tray).toEqual([{ itemId: 'tea', quantity: 1, modifiers: ICED }]);
  });

  it('puts what is not made to order on as it is', () => {
    expect(addToTray(EMPTY_TRAY, 'pastry', null).tray).toEqual([{ itemId: 'pastry', quantity: 1 }]);
  });

  it('adds to a line made the same way, and starts a new line for one made differently', () => {
    const tray = [addToTray, addToTray].reduce((history, add) => add(history, 'tea', HOT), EMPTY_TRAY);
    expect(tray.tray).toEqual([{ itemId: 'tea', quantity: 2, modifiers: HOT }]);
    expect(addToTray(tray, 'tea', ICED).tray).toEqual([
      { itemId: 'tea', quantity: 2, modifiers: HOT },
      { itemId: 'tea', quantity: 1, modifiers: ICED },
    ]);
    // The same extras in another order are the same drink.
    const both = { ...HOT, extras: ['milk', 'sugar'] as const };
    expect(addToTray(addToTray(EMPTY_TRAY, 'coffee', both), 'coffee', { ...both, extras: ['sugar', 'milk'] }).tray).toHaveLength(1);
  });

  it('holds no more of one line than an order can ask for', () => {
    let history = EMPTY_TRAY;
    for (let i = 0; i < ECONOMY.maxQuantityPerOrderLine + 2; i++) history = addToTray(history, 'tea', HOT);
    expect(history.tray).toEqual([{ itemId: 'tea', quantity: ECONOMY.maxQuantityPerOrderLine, modifiers: HOT }]);
  });
});

describe('undoTray and redoTray', () => {
  const twoTaps: TrayHistory = addToTray(addToTray(EMPTY_TRAY, 'coffee', HOT), 'tea', ICED);

  it('takes back the last change, one at a time, and puts it back again', () => {
    const once = undoTray(twoTaps);
    expect(once.tray).toEqual([{ itemId: 'coffee', quantity: 1, modifiers: HOT }]);
    expect(undoTray(once).tray).toEqual([]);
    expect(redoTray(undoTray(once)).tray).toEqual(once.tray);
    expect(redoTray(once).tray).toEqual(twoTaps.tray);
  });

  it('undoes clearing the tray', () => {
    expect(clearTray(twoTaps).tray).toEqual([]);
    expect(undoTray(clearTray(twoTaps)).tray).toEqual(twoTaps.tray);
  });

  it('forgets what was undone once the tray changes another way', () => {
    const redone = addToTray(undoTray(twoTaps), 'latte', HOT);
    expect(redoTray(redone)).toBe(redone);
  });

  it('does nothing with nothing to undo or redo, and clearing an empty tray changes nothing', () => {
    expect(undoTray(EMPTY_TRAY)).toBe(EMPTY_TRAY);
    expect(redoTray(twoTaps)).toBe(twoTaps);
    expect(clearTray(EMPTY_TRAY)).toBe(EMPTY_TRAY);
  });
});
