import { describe, expect, it } from 'vitest';
import { CLOCK, createSave, faint, GROCERIES, isGoneOff, sleep, tick, type GameState, type InventoryItem } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const DAY = CLOCK.minutesPerDay;

function holding(inventory: InventoryItem[], clock: GameState['clock'] = { day: 4, minuteOfDay: 12 * 60 }): GameState {
  const state = createSave(TEST_SETUP);
  return { ...state, clock, possessions: { ...state.possessions, inventory } };
}

describe('groceries going off', () => {
  const eggs: InventoryItem = { itemId: 'eggs', quantity: 2, expiresOnDay: 4 };

  it('are fresh up to and including their expiry day, and gone off after it', () => {
    expect(isGoneOff(eggs, 4)).toBe(false);
    expect(isGoneOff(eggs, 5)).toBe(true);
  });

  it('never applies to things that keep', () => {
    expect(isGoneOff({ itemId: 'eggs', quantity: 1, expiresOnDay: null }, 999)).toBe(false);
  });

  it('tick keeps gone-off groceries for a while, so they can still be cooked at a risk', () => {
    const state = holding([eggs]);
    const after = tick(state, DAY);
    expect(after.clock.day).toBe(5);
    expect(after.possessions.inventory).toEqual([eggs]);
  });

  it('tick throws groceries out once they have been off for goneOffDaysKept days', () => {
    const lastDayKept = eggs.expiresOnDay! + GROCERIES.goneOffDaysKept;
    const keptTill = holding([eggs], { day: lastDayKept, minuteOfDay: 23 * 60 + 45 });
    expect(tick(keptTill, 30).possessions.inventory).toEqual([]);
    expect(tick(keptTill, 30).clock.day).toBe(lastDayKept + 1);
    expect(tick(holding([eggs], { day: lastDayKept, minuteOfDay: 12 * 60 }), 30).possessions.inventory).toEqual([eggs]);
  });

  it('tick only throws out what has gone off for long enough, and keeps the rest in order', () => {
    const fresh: InventoryItem = { itemId: 'noodles', quantity: 1, expiresOnDay: 20 };
    const keeps: InventoryItem = { itemId: 'vegetables', quantity: 1, expiresOnDay: null };
    const state = holding([fresh, eggs, keeps], { day: eggs.expiresOnDay! + GROCERIES.goneOffDaysKept + 1, minuteOfDay: 0 });
    expect(tick(state, 1).possessions.inventory).toEqual([fresh, keeps]);
  });

  it('sleeping into a new day throws them out too', () => {
    const lastDayKept = eggs.expiresOnDay! + GROCERIES.goneOffDaysKept;
    const state = { ...holding([eggs], { day: lastDayKept, minuteOfDay: 22 * 60 }), placeId: 'home' as const };
    expect(sleep(state).possessions.inventory).toEqual([]);
  });

  it('waking in the ward on a new day throws them out too', () => {
    const lastDayKept = eggs.expiresOnDay! + GROCERIES.goneOffDaysKept;
    const state = holding([eggs], { day: lastDayKept, minuteOfDay: 22 * 60 });
    expect(faint(state).possessions.inventory).toEqual([]);
  });
});
