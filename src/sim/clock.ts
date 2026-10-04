import type { GameState } from './state.ts';
import { CLOCK } from './tuning.ts';

const MS_PER_SECOND = 1000;

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Day 1 is a Monday. */
export function weekdayOf(day: number): Weekday {
  const days = WEEKDAYS.length;
  return WEEKDAYS[(((day - 1) % days) + days) % days]!;
}

/**
 * When a place is open, in minutes since midnight. A `closesAt` past 24:00
 * runs on into the next morning. On a `closedOn` weekday it doesn't open at
 * all. Null means always open.
 */
export type OpeningHours = { opensAt: number; closesAt: number; closedOn: readonly Weekday[] } | null;

/** The place is open at this moment: today's hours, or the tail of yesterday's that runs past midnight. */
export function isOpen(hours: OpeningHours, clock: GameState['clock']): boolean {
  if (hours === null) return true;
  const { day, minuteOfDay } = clock;
  const openOn = (d: number, minute: number) =>
    !hours.closedOn.includes(weekdayOf(d)) && minute >= hours.opensAt && minute < hours.closesAt;
  return openOn(day, minuteOfDay) || openOn(day - 1, minuteOfDay + CLOCK.minutesPerDay);
}

/**
 * Game minutes that pass in one frame: real delta × time scale. The real
 * delta is capped, so a stalled frame or a return to the tab never jumps the clock.
 */
export function gameMinutesFor(realDeltaMs: number, timeScale: number): number {
  const cappedSeconds = Math.min(realDeltaMs, CLOCK.maxRealDeltaMs) / MS_PER_SECOND;
  return cappedSeconds * CLOCK.gameMinutesPerRealSecond * timeScale;
}

export function advanceClock(clock: GameState['clock'], dtGameMinutes: number): GameState['clock'] {
  const total = clock.minuteOfDay + dtGameMinutes;
  const daysPassed = Math.floor(total / CLOCK.minutesPerDay);
  return { day: clock.day + daysPassed, minuteOfDay: total - daysPassed * CLOCK.minutesPerDay };
}
