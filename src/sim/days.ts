import { rollIllness } from './illness.ts';
import { endRentDay } from './rent.ts';
import type { GameState } from './state.ts';

/**
 * Ends each day the clock has moved past since `fromDay`, however the day ended: awake, asleep
 * or fainted. Rent falls due, and the Character may fall ill.
 */
export function endDaysSince(fromDay: number, state: GameState): GameState {
  let after = state;
  for (let day = fromDay; day < state.clock.day; day++) after = rollIllness(endRentDay(after, day), day);
  return after;
}
