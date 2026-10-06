import { describe, expect, it } from 'vitest';
import { addPadLine, choosePadLine, ECONOMY, EMPTY_PAD, kitchenOrder, noteOnPad, removePadLine, writeOnPad, type OrderPad } from './index.ts';

/** A pad with `n` lines, the last one being written. */
const padOf = (n: number): OrderPad => Array.from({ length: n - 1 }).reduce<OrderPad>((pad) => addPadLine(pad), EMPTY_PAD);

describe('the order pad', () => {
  it('starts with one blank line, being written', () => {
    expect(EMPTY_PAD).toEqual({ diners: [{ dish: null, drink: null, note: null }], at: 0 });
  });

  it('writes the dish, the drink and the note on the line being written, each in place of the one before', () => {
    let pad = writeOnPad(writeOnPad(EMPTY_PAD, 'fish-dish', 'dish'), 'pork-dish', 'dish');
    pad = noteOnPad(writeOnPad(pad, 'cola', 'drink'), 'no-seafood');
    expect(pad.diners).toEqual([{ dish: 'pork-dish', drink: 'cola', note: 'no-seafood' }]);
    expect(noteOnPad(pad, null).diners[0]!.note).toBeNull();
  });

  it('adds lines up to the biggest table, each new one being written', () => {
    const full = padOf(ECONOMY.tableDiners.max);
    expect(full.diners).toHaveLength(ECONOMY.tableDiners.max);
    expect(full.at).toBe(ECONOMY.tableDiners.max - 1);
    expect(addPadLine(full)).toBe(full);
  });

  it('chooses another line to write on, but never one that is not there', () => {
    const pad = padOf(2);
    expect(choosePadLine(pad, 0).at).toBe(0);
    expect(choosePadLine(pad, 2)).toBe(pad);
    expect(choosePadLine(pad, -1)).toBe(pad);
  });

  it('takes the line being written off, writing the one before next, and never the last line', () => {
    const pad = writeOnPad(choosePadLine(padOf(3), 1), 'juice', 'drink');
    const removed = removePadLine(pad);
    expect(removed.diners).toHaveLength(2);
    expect(removed.diners.some(({ drink }) => drink === 'juice')).toBe(false);
    expect(removed.at).toBe(0);
    expect(removePadLine(EMPTY_PAD)).toBe(EMPTY_PAD);
  });

  it("orders for the kitchen what is written, the same dishes and drinks together, skipping what isn't", () => {
    expect(
      kitchenOrder([
        { dish: 'pork-dish', drink: 'cola', note: null },
        { dish: 'veggie-dish', drink: 'cola', note: 'vegetarian' },
        { dish: null, drink: 'juice', note: null },
      ]),
    ).toEqual([
      { itemId: 'pork-dish', quantity: 1 },
      { itemId: 'cola', quantity: 2 },
      { itemId: 'veggie-dish', quantity: 1 },
      { itemId: 'juice', quantity: 1 },
    ]);
  });
});
