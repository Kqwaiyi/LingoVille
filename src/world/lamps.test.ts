import { describe, expect, it } from 'vitest';
import { LAMP_SPOTS, nearestLamps, type LampSpot } from './lamps.ts';
import { FILLERS, PROMENADE_LIGHTS } from './scenery.ts';
import { BUILDINGS, STREET_LIGHTS } from './town.ts';

describe('the lamps', () => {
  it('shine from every street light and promenade light, both lanterns at every door, and every building’s rooms', () => {
    const count = (kind: LampSpot['kind']) => LAMP_SPOTS.filter((spot) => spot.kind === kind).length;
    expect(count('street')).toBe(STREET_LIGHTS.length + PROMENADE_LIGHTS.length);
    expect(count('door')).toBe(2 * (BUILDINGS.length + FILLERS.length));
    expect(count('room')).toBe(BUILDINGS.length);
  });

  it('hang over head height and never below the ground', () => {
    expect(LAMP_SPOTS.filter(({ at: [, y] }) => y < 0.3 || y > 3)).toEqual([]);
  });

  it('are found nearest first', () => {
    const spots: LampSpot[] = [
      { at: [10, 2, 0], kind: 'street' },
      { at: [1, 2, 0], kind: 'door' },
      { at: [0, 2, 5], kind: 'room' },
    ];
    expect(nearestLamps(spots, [0, 1, 0], 2).map(({ kind }) => kind)).toEqual(['door', 'room']);
  });
});
