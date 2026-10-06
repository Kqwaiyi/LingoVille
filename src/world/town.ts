import { TOWN_NPCS, TRAM_LINE, type GroceryId, type PropId, type SignId, type TownNpcId, type TramStopId } from '../content/index.ts';
import { PLACE_IDS, type JobId, type PlaceId } from '../sim/index.ts';
import type { Arrival } from '../store/index.ts';

// Greybox layout: one long street along the x axis, with a tram line down its
// middle and three island platforms for the stops. Seven buildings face it
// from the north (doors on +z) and the clinic and bathhouse from the south
// (doors on -z), with the park, open to the street, between them.

export type Vec2 = readonly [x: number, z: number];
export type Vec3 = readonly [x: number, y: number, z: number];

export type Building = {
  placeId: PlaceId;
  centre: Vec2;
  /** Outer width (x) and depth (z). */
  size: Vec2;
  colour: string;
  /** Which way the front wall, with its door, faces: +1 towards +z, -1 towards -z. Both face the street. */
  facing: 1 | -1;
};

export const WALL = { height: 2.4, thickness: 0.3, doorWidth: 1.8 } as const;

export const BUILDINGS: readonly Building[] = [
  { placeId: 'town-office', centre: [-44, -1], size: [12, 8], colour: '#c8c2b4', facing: 1 },
  { placeId: 'bookshop', centre: [-30, -0.5], size: [8, 7], colour: '#b7a3c9', facing: 1 },
  { placeId: 'home', centre: [-10, 0], size: [8, 7], colour: '#a9bfdc', facing: 1 },
  { placeId: 'convenience-store', centre: [0.5, -0.5], size: [7, 7], colour: '#9fd0c4', facing: 1 },
  { placeId: 'cafe', centre: [12, -1], size: [10, 8], colour: '#e9bf96', facing: 1 },
  { placeId: 'supermarket', centre: [27, -1.5], size: [14, 9], colour: '#d9d48f', facing: 1 },
  { placeId: 'restaurant', centre: [42, -1], size: [10, 8], colour: '#d99a8f', facing: 1 },
  { placeId: 'clinic', centre: [-26, 16], size: [16, 10], colour: '#e6eef0', facing: -1 },
  { placeId: 'bathhouse', centre: [24, 15.5], size: [12, 9], colour: '#8fb3cf', facing: -1 },
];

export const STREET = { z: 7, width: 5 } as const;
export const GROUND_HALF_SIZE = 60;

/** The park: open grass on the south side of the street, with no walls or door. */
export const PARK = { centre: [0, 18] as Vec2, size: [22, 13] as Vec2 } as const;

/** Each tram stop: an island platform in the middle of the street, with a pole at its centre. */
export const TRAM_STOPS: Record<TramStopId, { centre: Vec2 }> = {
  'west-stop': { centre: [-30, STREET.z] },
  'central-stop': { centre: [-4, STREET.z] },
  'east-stop': { centre: [35, STREET.z] },
};
export const PLATFORM = { size: [8, 1.6] as Vec2, height: 0.12 } as const;

/** Where each person in town stands. Staff stand behind their counter, facing the door. */
export const NPC_SPOTS: Record<TownNpcId, Vec3> = {
  // In the hallway beside the front door, so the Character passes within talking range on the way out
  // (and the landlord can catch them), but not from where a new game starts.
  landlord: [-11.4, 1, 2.7],
  barista: [12, 1, -4.1],
  cashier: [24, 1, -0.7],
  'convenience-clerk': [0.5, 1, -3.2],
  server: [43.5, 1, 0.5],
  receptionist: [-30, 1, 14.6],
  pharmacist: [-21, 1, 14.6],
  doctor: [-31, 1, 19.2],
  nurse: [-23, 1, 19.2],
  'park-regular-1': [-6, 1, 16],
  'park-regular-2': [3, 1, 21],
  'park-regular-3': [8, 1, 14.5],
  // At the east end of each platform, clear of the pole.
  'passer-by-1': [TRAM_STOPS['west-stop'].centre[0] + 3.2, 1, STREET.z],
  'passer-by-2': [TRAM_STOPS['central-stop'].centre[0] + 3.2, 1, STREET.z],
  'passer-by-3': [TRAM_STOPS['east-stop'].centre[0] + 3.2, 1, STREET.z],
  shopkeeper: [-30, 1, -3.1],
  attendant: [24, 1, 14.6],
  'office-clerk': [-44, 1, -3.7],
};

/** Passers-by wait on the platforms only while the trams run. */
export const isWaitingForTram = (npcId: TownNpcId) => TOWN_NPCS[npcId].role === 'passer-by';

/** Counters, shelves and tables: solid greybox furniture, as centre and size. */
export const FURNITURE: readonly { position: Vec3; size: Vec3; colour: string }[] = [
  // Café counter.
  { position: [12, 0.55, -3], size: [4, 1.1, 0.8], colour: '#8b6a4f' },
  // Convenience store counter and shelves.
  { position: [0.5, 0.55, -2.2], size: [3, 1.1, 0.7], colour: '#6f8f86' },
  { position: [-1.8, 0.8, 1], size: [0.6, 1.6, 2.4], colour: '#c9d6d2' },
  // Supermarket checkout and aisles.
  { position: [24, 0.55, 0.4], size: [2.4, 1.1, 0.8], colour: '#8f8a52' },
  { position: [29, 0.8, -3], size: [6, 1.6, 0.7], colour: '#ece9c6' },
  { position: [29, 0.8, -0.5], size: [6, 1.6, 0.7], colour: '#ece9c6' },
  // Restaurant tables.
  { position: [39.5, 0.4, -3], size: [1.4, 0.8, 1.4], colour: '#7a5442' },
  { position: [44.5, 0.4, -3], size: [1.4, 0.8, 1.4], colour: '#7a5442' },
  { position: [39.5, 0.4, 0.5], size: [1.4, 0.8, 1.4], colour: '#7a5442' },
  // Clinic reception and pharmacy counters, and the waiting room bench.
  { position: [-30, 0.55, 13.5], size: [3, 1.1, 0.8], colour: '#9fb4ba' },
  { position: [-21, 0.55, 13.5], size: [3, 1.1, 0.8], colour: '#9fb4ba' },
  { position: [-26, 0.25, 17], size: [3, 0.5, 0.7], colour: '#b8c7cc' },
  // Bookshop counter and shelves.
  { position: [-30, 0.55, -2], size: [2.6, 1.1, 0.7], colour: '#6e5a7f' },
  { position: [-33, 1, 0], size: [0.6, 2, 3], colour: '#8e7aa0' },
  { position: [-27, 1, 0], size: [0.6, 2, 3], colour: '#8e7aa0' },
  // Bathhouse front desk.
  { position: [24, 0.55, 13.5], size: [3, 1.1, 0.8], colour: '#5f88a8' },
  // Town office counter.
  { position: [-44, 0.55, -2.5], size: [5, 1.1, 0.8], colour: '#8d8778' },
  // Park benches.
  { position: [-6, 0.25, 17.4], size: [2, 0.5, 0.6], colour: '#8b6a4f' },
  { position: [3, 0.25, 22.4], size: [2, 0.5, 0.6], colour: '#8b6a4f' },
];

/**
 * Where each grocery sits on the supermarket's aisle shelves, facing the aisle south of it.
 * The vegetables and eggs face the door; the noodles are down the aisle between the shelves.
 */
export const SHELF_SPOTS: Record<GroceryId, Vec3> = {
  vegetables: [27, 1, -0.05],
  eggs: [30.5, 1, -0.05],
  noodles: [29, 1, -2.55],
};

/** Park trees: trunk positions on the ground. */
export const TREES: readonly Vec2[] = [
  [-9, 13],
  [-2, 22],
  [6, 18],
  [9, 23],
  [-8, 22],
];

/** The tap at home, against the back wall straight ahead of the spawn point. */
export const HOME_TAP: Vec3 = [-10, 0.5, -2.85];
export const HOME_BED: Vec3 = [-12.4, 0.25, -1.4];
/** The stove at home, along the back wall to the right of the tap. */
export const HOME_STOVE: Vec3 = [-7.6, 0.5, -2.85];

/**
 * Where each Job is worked: its staff door, set in its place's west wall (and where the Character stands to use it);
 * where the Character stands through a Shift, behind the counter beside its staff; and where a Shift Customer stands,
 * across the counter. The café's is level with its counter; the supermarket's, with the customers' side of its till.
 */
export const WORKPLACES: Partial<Record<JobId, { door: Vec3; usedFrom: Vec3; behindTheCounter: Vec3; customerSpot: Vec3 }>> = {
  barista: { door: [7.22, 1.1, -2.2], usedFrom: [7.7, 1, -2.2], behindTheCounter: [13.4, 1, -4], customerSpot: [13.4, 1, -1.8] },
  cashier: { door: [20.22, 1.1, 1], usedFrom: [20.7, 1, 1], behindTheCounter: [25, 1, -0.6], customerSpot: [25, 1, 1.6] },
};

/** Where each sign hangs, facing +z (towards the street, or the café door), and its size in metres. */
export const SIGNS: Record<SignId, { position: Vec3; size: readonly [width: number, height: number] }> = {
  // Over the café door, on the outside of the front wall.
  'cafe-name': { position: [12, 2.75, 3.02], size: [3.4, 0.7] },
  // Beside the door, at eye height.
  'cafe-hours': { position: [14.1, 1.5, 3.02], size: [1, 0.7] },
  // On the back wall behind the counter, to the barista's left.
  'cafe-menu': { position: [14.3, 1.65, -4.68], size: [1.7, 1.5] },
};

/** Where a pack's props stand: hung at the café door, or set out on the counter (one spot per counter prop). */
export const PROP_SPOTS = {
  door: [12, 2.1, 3.1] as Vec3,
  counter: [[10.5, 1.1, -3] as Vec3, [13.5, 1.1, -3] as Vec3],
} as const;

/** Which spot each prop takes. */
export const SPOT_FOR_PROP: Record<PropId, 'door' | 'counter'> = {
  noren: 'door',
  'red-lantern': 'door',
  bunting: 'door',
  'lucky-cat': 'counter',
  'tea-set': 'counter',
  'cake-stand': 'counter',
  'pretzel-basket': 'counter',
  teapot: 'counter',
};

/** Where the tram sets the Character down: on the platform, west of the pole. */
export function tramStopSpawn(stopId: TramStopId): Vec3 {
  const [x, z] = TRAM_STOPS[stopId].centre;
  return [x - 1.5, 1, z];
}

/** Just inside a building's door. */
function insideTheDoor({ centre: [x, z], size: [, depth], facing }: Building): Vec3 {
  return [x, 1, z + facing * (depth / 2 - 1.5)];
}

/**
 * Where the Character starts at each place. At home it stands facing the tap
 * (the First Morning); in other buildings just inside the door; at the tram
 * stop on the first platform of the line. The save keeps only the place, not
 * which stop, so Continue at a tram stop always starts at the first one.
 */
export const SPAWN_POINTS: Record<PlaceId, Vec3> = {
  ...(Object.fromEntries(BUILDINGS.map((building) => [building.placeId, insideTheDoor(building)])) as Record<PlaceId, Vec3>),
  home: [-10, 1, 0.5],
  park: [PARK.centre[0], 1, PARK.centre[1] - PARK.size[1] / 2 + 1.5],
  'tram-stop': tramStopSpawn(TRAM_LINE[0]),
};

export function spawnAt(placeId: PlaceId): Vec3 {
  return SPAWN_POINTS[placeId];
}

/** Back from a save at home, the Character wakes up in bed. It drops onto the mattress. */
export const IN_BED: Vec3 = [HOME_BED[0], 1.5, HOME_BED[2]];

/** The Fainting ward's bed, at the back of the clinic, within talking range of the nurse. */
export const WARD_BED: Vec3 = [-21.2, 0.25, 19.4];
/** After Fainting, the Character wakes up in the ward bed. */
export const IN_WARD_BED: Vec3 = [WARD_BED[0], 1.5, WARD_BED[2]];

/**
 * Where the Character appears. A new game starts the First Morning at home
 * (or, in dev, wherever `?spawn=` says); Continue puts the Character at the
 * saved place's entrance, or in bed if that's home.
 */
export function spawnPoint(arrival: Arrival, placeId: PlaceId, search: string): Vec3 {
  if (arrival === 'newGame') return spawnAt(devSpawnPlace(search));
  return placeId === 'home' ? IN_BED : spawnAt(placeId);
}

/** Dev only: `?spawn=cafe` starts a new game at the café door, so a smoke test doesn't have to walk across town. */
function devSpawnPlace(search: string): PlaceId {
  const place = new URLSearchParams(search).get('spawn');
  return import.meta.env.DEV && (PLACE_IDS as readonly (string | null)[]).includes(place) ? (place as PlaceId) : 'home';
}

const within = (x: number, z: number, [cx, cz]: Vec2, [w, d]: Vec2) => Math.abs(x - cx) < w / 2 && Math.abs(z - cz) < d / 2;

/** The tram stop whose platform this point is on, or null. */
export function tramStopAt(x: number, z: number): TramStopId | null {
  return TRAM_LINE.find((stopId) => within(x, z, TRAM_STOPS[stopId].centre, PLATFORM.size)) ?? null;
}

/** The place this point is in: inside a building, on a tram platform or in the park. Null on the street. */
export function placeAt(x: number, z: number): PlaceId | null {
  for (const { placeId, centre, size } of BUILDINGS) {
    if (within(x, z, centre, [size[0] - 2 * WALL.thickness, size[1] - 2 * WALL.thickness])) return placeId;
  }
  if (tramStopAt(x, z)) return 'tram-stop';
  if (within(x, z, PARK.centre, PARK.size)) return 'park';
  return null;
}
