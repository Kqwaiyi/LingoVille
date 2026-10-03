import type { GameState } from './state.ts';
import { CLOCK } from './tuning.ts';

const MS_PER_SECOND = 1000;

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Day 1 is a Monday. */
export function weekdayOf(day: number): Weekday {
  return WEEKDAYS[(day - 1) % WEEKDAYS.length]!;
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
