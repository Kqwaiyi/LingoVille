import { describe, expect, it } from 'vitest';
import { createSave, rideTram, TRAM, type GameState, type OpeningHours } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const HOUR = 60;
const MONDAY = 1;
/** Trams: 6:00 until 1:00 the next morning. */
const TRAMS: OpeningHours = { opensAt: 6 * HOUR, closesAt: 25 * HOUR, closedOn: [] };

function atTheStop(day: number, minuteOfDay: number): GameState {
  return { ...createSave(TEST_SETUP), placeId: 'tram-stop', clock: { day, minuteOfDay } };
}

describe('rideTram', () => {
  it('takes the trip time, longer the more stops away, and arrives at a tram stop', () => {
    const state = atTheStop(MONDAY, 9 * HOUR);
    const oneStop = rideTram(state, 1, TRAMS);
    const twoStops = rideTram(state, 2, TRAMS);

    expect(oneStop.clock).toEqual({ day: MONDAY, minuteOfDay: 9 * HOUR + TRAM.minutesPerStop });
    expect(twoStops.clock).toEqual({ day: MONDAY, minuteOfDay: 9 * HOUR + 2 * TRAM.minutesPerStop });
    expect(oneStop.placeId).toBe('tram-stop');
  });

  it('is free', () => {
    const state = atTheStop(MONDAY, 9 * HOUR);
    expect(rideTram(state, 2, TRAMS).character.moneyInShifts).toBe(state.character.moneyInShifts);
  });

  it('lets time pass for Well-being on the way, as anywhere', () => {
    const state = atTheStop(MONDAY, 9 * HOUR);
    const after = rideTram(state, 2, TRAMS);
    expect(after.character.hunger).toBeLessThan(state.character.hunger);
    expect(after.character.thirst).toBeLessThan(state.character.thirst);
  });

  it('goes nowhere when no tram is running', () => {
    const lateAtNight = atTheStop(MONDAY + 1, 3 * HOUR);
    expect(rideTram(lateAtNight, 1, TRAMS)).toBe(lateAtNight);
    const beforeTheFirstTram = atTheStop(MONDAY, 5 * HOUR + 59);
    expect(rideTram(beforeTheFirstTram, 1, TRAMS)).toBe(beforeTheFirstTram);
  });

  it('runs the last tram after midnight, even if the trip ends after the trams stop', () => {
    const lastTram = atTheStop(MONDAY + 1, 0 * HOUR + 55);
    expect(rideTram(lastTram, 2, TRAMS).clock).toEqual({ day: MONDAY + 1, minuteOfDay: 55 + 2 * TRAM.minutesPerStop });
  });

  it('goes nowhere when the chosen stop is the one the Character is at', () => {
    const state = atTheStop(MONDAY, 9 * HOUR);
    expect(rideTram(state, 0, TRAMS)).toBe(state);
  });
});
