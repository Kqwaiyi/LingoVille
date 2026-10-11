import { describe, expect, it } from 'vitest';
import { STOP_PLACES, TRAM_LINE, type TramStopId } from '../src/content/index.ts';
import type { PlaceId } from '../src/sim/index.ts';
import { buildingOf, frontOf, PARK, TRAM_STOPS, type Vec2 } from '../src/world/town.ts';

// Holds the passers-by's directions (`STOP_PLACES` in content) to the town as the world lays it out: each place is
// listed under the tram stop nearest its way in, so "get off at …" is always the right stop.

/** Where each place is entered from the street: a building's front door, the park's way in. */
function wayIn(placeId: PlaceId): Vec2 {
  const building = buildingOf(placeId);
  if (building) {
    const { x, z } = frontOf(building);
    return [x, z];
  }
  return [PARK.centre[0], PARK.centre[1] - PARK.size[1] / 2];
}

/** Every place listed under a stop that isn't the nearest to its way in, one line each. */
function stopPlaceProblems(stopPlaces: Record<TramStopId, readonly PlaceId[]>, stops: Record<TramStopId, { centre: Vec2 }>): string[] {
  return TRAM_LINE.flatMap((listed) =>
    stopPlaces[listed].flatMap((placeId) => {
      const [x, z] = wayIn(placeId);
      const distance = (stopId: TramStopId) => Math.hypot(stops[stopId].centre[0] - x, stops[stopId].centre[1] - z);
      const nearest = [...TRAM_LINE].sort((a, b) => distance(a) - distance(b))[0]!;
      return nearest === listed ? [] : [`the ${placeId} is listed at ${listed}, but ${nearest} is nearer.`];
    }),
  );
}

describe('the tram directions', () => {
  it('list every place under the stop nearest its way in', () => {
    expect(stopPlaceProblems(STOP_PLACES, TRAM_STOPS)).toEqual([]);
  });

  it('catch a place listed under a stop further away', () => {
    const swapped = { ...STOP_PLACES, 'west-stop': [...STOP_PLACES['west-stop'], 'restaurant' as const], 'east-stop': STOP_PLACES['east-stop'].filter((p) => p !== 'restaurant') };
    expect(stopPlaceProblems(swapped, TRAM_STOPS)).toEqual(['the restaurant is listed at west-stop, but east-stop is nearer.']);
  });
});
