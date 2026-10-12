// Where the town's lamps shine from at night: the street lights' and the promenade's lanterns, the lanterns either
// side of each front door, the lamps under the tram shelters and in the rooms, and each building's own rooms, lit
// from inside. `Lighting` lights the ones nearest the Character with real light; the rest just glow.
import { FILLERS, PROMENADE_LIGHTS } from './scenery.ts';
import { BUILDINGS, DECOR, STREET, STREET_LIGHTS, TRAM_STOPS, WALL, type Vec3 } from './town.ts';

/** What kind of lamp: how bright and how far it reaches is `Lighting`'s to say. */
export type LampKind = 'street' | 'door' | 'shelter' | 'room' | 'lamp';
export type LampSpot = { at: Vec3; kind: LampKind };

/**
 * Where a street light's lantern hangs from the point its pole stands on, out over the street (`street-light` in
 * `art/town/architecture.py`): 1.23 m out and 2.55 m up. A door's lantern stands 1.25 m either side of the door,
 * 2.13 m up and 0.29 m out from the wall.
 */
const STREET_LANTERN = { out: 1.23, height: 2.55 } as const;
const DOOR_LANTERN = { across: 1.25, height: 2.13, out: 0.29 } as const;
/** A shelter's lamp, from its tram stop's middle. */
const SHELTER_LAMP: Vec3 = [-2.2, 1.9, 0];
/** How high a standing or table lamp's shade is over where it stands. */
const LAMP_SHADE = { 'floor-lamp': 1.45, 'table-lamp': 0.45 } as const;

export const LAMP_SPOTS: readonly LampSpot[] = [
  ...STREET_LIGHTS.map(([x, z]): LampSpot => ({ at: [x, STREET_LANTERN.height, z + (z < STREET.z ? 1 : -1) * STREET_LANTERN.out], kind: 'street' })),
  ...PROMENADE_LIGHTS.map(([x, z]): LampSpot => ({ at: [x, STREET_LANTERN.height, z + 0.73 - 0.5], kind: 'street' })),
  ...[...BUILDINGS, ...FILLERS].flatMap(({ centre: [cx, cz], size: [, d], facing }) =>
    [-1, 1].map((side): LampSpot => ({ at: [cx + side * DOOR_LANTERN.across, DOOR_LANTERN.height, cz + facing * (d / 2 + DOOR_LANTERN.out)], kind: 'door' })),
  ),
  ...Object.values(TRAM_STOPS).map(({ centre: [x, z] }): LampSpot => ({ at: [x + SHELTER_LAMP[0], SHELTER_LAMP[1], z + SHELTER_LAMP[2]], kind: 'shelter' })),
  ...BUILDINGS.map(({ centre: [cx, cz] }): LampSpot => ({ at: [cx, WALL.height - 0.35, cz], kind: 'room' })),
  ...DECOR.flatMap(({ piece, position: [x, y, z] }): LampSpot[] => (piece === 'floor-lamp' || piece === 'table-lamp' ? [{ at: [x, y + LAMP_SHADE[piece], z], kind: 'lamp' }] : [])),
];

/** The `count` lamps nearest a point, nearest first. */
export function nearestLamps(spots: readonly LampSpot[], [x, y, z]: Vec3, count: number): LampSpot[] {
  const distance = ({ at: [lx, ly, lz] }: LampSpot) => (lx - x) ** 2 + (ly - y) ** 2 + (lz - z) ** 2;
  return [...spots].sort((a, b) => distance(a) - distance(b)).slice(0, count);
}
