import { throwOutSpoiled } from './inventory.ts';
import { clampMeter } from './meters.ts';
import { endDaysSince } from './days.ts';
import type { GameState } from './state.ts';
import { CLOCK, MOOD } from './tuning.ts';

/** The bed can be used from 20:00 until the hour it wakes the Character. There are no naps. */
export function bedUsable({ minuteOfDay }: GameState['clock']): boolean {
  return minuteOfDay >= CLOCK.bedUsableFrom || minuteOfDay < CLOCK.wakeAt;
}

/**
 * The Character goes to bed at home and wakes at 07:00 the next morning, past
 * midnight if it isn't yet, with a small Mood boost. Nothing decays while
 * asleep. Too early, or away from home, nothing happens.
 */
export function sleep(state: GameState): GameState {
  if (state.placeId !== 'home' || !bedUsable(state.clock)) return state;
  const { day, minuteOfDay } = state.clock;
  const wakeDay = minuteOfDay < CLOCK.wakeAt ? day : day + 1;
  const slept = endDaysSince(day, {
    ...state,
    clock: { day: wakeDay, minuteOfDay: CLOCK.wakeAt },
    character: { ...state.character, mood: clampMeter(state.character.mood + MOOD.changes.sleep) },
  });
  return throwOutSpoiled(slept);
}
