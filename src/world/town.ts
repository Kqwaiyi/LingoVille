import type { PlaceId } from '../sim/index.ts';

// Greybox layout: a street along the x axis with a home on one side and a café
// on the other, both with their door facing the street (+z). The town grows to
// 11 places later (ticket 13).

export type Vec2 = readonly [x: number, z: number];
export type Vec3 = readonly [x: number, y: number, z: number];

export type Building = {
  placeId: PlaceId;
  centre: Vec2;
  /** Outer width (x) and depth (z). */
  size: Vec2;
  colour: string;
};

export const WALL = { height: 2.4, thickness: 0.3, doorWidth: 1.8 } as const;

export const BUILDINGS: readonly Building[] = [
  { placeId: 'home', centre: [-10, 0], size: [8, 7], colour: '#a9bfdc' },
  { placeId: 'cafe', centre: [12, -1], size: [10, 8], colour: '#e9bf96' },
];

export const STREET = { z: 7, width: 5 } as const;
export const GROUND_HALF_SIZE = 40;

/** The tap at home, against the back wall straight ahead of the spawn point. */
export const HOME_TAP: Vec3 = [-10, 0.5, -2.85];
export const HOME_BED: Vec3 = [-12.4, 0.25, -1.4];
export const CAFE_COUNTER: Vec3 = [12, 0.55, -3];

/** Where the Character stands on the First Morning, facing the tap. */
export const SPAWN: Vec3 = [-10, 1, 0.5];

/** The place whose interior contains this point, or null on the street. */
export function placeAt(x: number, z: number): PlaceId | null {
  for (const { placeId, centre, size } of BUILDINGS) {
    const halfW = size[0] / 2 - WALL.thickness;
    const halfD = size[1] / 2 - WALL.thickness;
    if (Math.abs(x - centre[0]) < halfW && Math.abs(z - centre[1]) < halfD) return placeId;
  }
  return null;
}
