import { describe, expect, it } from 'vitest';
import { CLOCK, createSave, METER_MAX } from '../sim/index.ts';
import { createGameStore, DEV_SETUP, selectClockMinute, selectThirst } from './index.ts';

function newStore() {
  return createGameStore(createSave(DEV_SETUP));
}

describe('game store', () => {
  it('advances game time from the real frame delta', () => {
    const store = newStore();
    const before = store.getState().game.clock.minuteOfDay;

    store.getState().advance(CLOCK.maxRealDeltaMs);

    expect(store.getState().game.clock.minuteOfDay).toBeGreaterThan(before);
  });

  it('stops the clock and decay while the tab is hidden, and resumes when it is shown', () => {
    const store = newStore();
    const before = store.getState().game;

    store.getState().setTabHidden(true);
    store.getState().advance(CLOCK.maxRealDeltaMs);
    expect(store.getState().game).toBe(before);

    store.getState().setTabHidden(false);
    store.getState().advance(CLOCK.maxRealDeltaMs);
    expect(store.getState().game.clock.minuteOfDay).toBeGreaterThan(before.clock.minuteOfDay);
  });

  it('drinks tap water only once the Character has walked home', () => {
    const store = newStore();
    store.getState().enterPlace('cafe');
    store.getState().drinkWater();
    expect(selectThirst(store.getState())).toBeLessThan(METER_MAX);

    store.getState().enterPlace('home');
    store.getState().drinkWater();
    expect(selectThirst(store.getState())).toBe(METER_MAX);
  });

  it('shows the clock in whole game minutes', () => {
    const store = newStore();
    store.getState().advance(CLOCK.maxRealDeltaMs);
    expect(Number.isInteger(selectClockMinute(store.getState()))).toBe(true);
  });
});
