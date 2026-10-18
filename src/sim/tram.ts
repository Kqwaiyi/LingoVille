import { isOpen, type OpeningHours } from './clock.ts';
import { faintedBetween } from './faint.ts';
import type { GameState } from './state.ts';
import { TRAM } from './tuning.ts';
import { tick } from './wellBeing.ts';

/** How long a tram trip `stopsAway` stops along the line takes, in game minutes. */
export function tramTripMinutes(stopsAway: number): number {
  return stopsAway * TRAM.minutesPerStop;
}

/**
 * A free tram ride, `stopsAway` stops along the line, given the trams' hours
 * in this pack. Time passes on the way, and the Character gets off at a tram
 * stop, unless they faint on the way. Only boarding needs a tram running: the
 * last one may arrive after the trams stop. Where the stop is lies in the world, not here.
 */
export function rideTram(state: GameState, stopsAway: number, tramHours: OpeningHours): GameState {
  if (stopsAway <= 0 || !isOpen(tramHours, state.clock)) return state;
  const after = tick(state, tramTripMinutes(stopsAway));
  return faintedBetween(state, after) ? after : { ...after, placeId: 'tram-stop' };
}
