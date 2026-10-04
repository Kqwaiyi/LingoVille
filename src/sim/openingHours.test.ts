import { describe, expect, it } from 'vitest';
import { createSave, enterPlace, isOpen, type GameState, type OpeningHours } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const HOUR = 60;
// Day 1 is a Monday.
const MONDAY = 1;
const SUNDAY = 7;
const at = (day: number, hour: number) => ({ day, minuteOfDay: hour * HOUR });

const CAFE: OpeningHours = { opensAt: 7 * HOUR, closesAt: 19 * HOUR, closedOn: [] };
const SHUT_ON_SUNDAY: OpeningHours = { ...CAFE, closedOn: ['sunday'] };
/** Trams: 6:00 until 1:00 the next morning. */
const TRAMS: OpeningHours = { opensAt: 6 * HOUR, closesAt: 25 * HOUR, closedOn: [] };

describe('isOpen', () => {
  it('is open from opening time up to, but not at, closing time', () => {
    expect(isOpen(CAFE, at(MONDAY, 6.99))).toBe(false);
    expect(isOpen(CAFE, at(MONDAY, 7))).toBe(true);
    expect(isOpen(CAFE, at(MONDAY, 18.99))).toBe(true);
    expect(isOpen(CAFE, at(MONDAY, 19))).toBe(false);
  });

  it('is always open with no hours', () => {
    expect(isOpen(null, at(SUNDAY, 3))).toBe(true);
  });

  it('stays shut all day on a closed weekday', () => {
    expect(isOpen(SHUT_ON_SUNDAY, at(SUNDAY - 1, 12))).toBe(true);
    expect(isOpen(SHUT_ON_SUNDAY, at(SUNDAY, 12))).toBe(false);
    expect(isOpen(SHUT_ON_SUNDAY, at(SUNDAY + 1, 12))).toBe(true);
  });

  it('runs past midnight into the next morning when it closes after 24:00', () => {
    expect(isOpen(TRAMS, at(MONDAY + 1, 0.5))).toBe(true);
    expect(isOpen(TRAMS, at(MONDAY + 1, 1))).toBe(false);
    expect(isOpen(TRAMS, at(MONDAY + 1, 5.99))).toBe(false);
  });

  it('keeps the late hours of a day that ended open, even if today is a closed day', () => {
    const notOnMonday: OpeningHours = { ...TRAMS, closedOn: ['monday'] };
    expect(isOpen(notOnMonday, at(MONDAY, 0.5))).toBe(true);
    expect(isOpen(notOnMonday, at(MONDAY, 12))).toBe(false);
    expect(isOpen(notOnMonday, at(MONDAY + 1, 0.5))).toBe(false);
  });
});

describe('enterPlace: closed places', () => {
  function atCafeDoor(hour: number): GameState {
    return { ...createSave(TEST_SETUP), clock: at(MONDAY, hour) };
  }

  it('lets the Character into an open place', () => {
    expect(enterPlace(atCafeDoor(9), 'cafe', CAFE).placeId).toBe('cafe');
  });

  it('keeps the Character out of a closed place', () => {
    const state = atCafeDoor(20);
    expect(enterPlace(state, 'cafe', CAFE)).toBe(state);
  });
});
