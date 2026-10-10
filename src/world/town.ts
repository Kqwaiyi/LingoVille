import { PASSER_BY_STOPS, TOWN_NPCS, TRAM_LINE, type GroceryId, type SignId, type TownNpcId, type TramStopId } from '../content/index.ts';
import type { JobId, PlaceId } from '../sim/index.ts';
import type { PaletteColour } from './palette.ts';
import type { TownPiece } from './townArt.ts';

// The town's layout: one long street along the x axis, with a tram line down its middle and three island platforms for
// the stops. Seven buildings face it from the north (doors on +z) and the clinic and bathhouse from the south (doors on
// -z), with the park, open to the street, between them. The layout, façades and roofs are the same in every Culture Pack.

export type Vec2 = readonly [x: number, z: number];
export type Vec3 = readonly [x: number, y: number, z: number];

export type Building = {
  placeId: PlaceId;
  centre: Vec2;
  /** Outer width (x) and depth (z). */
  size: Vec2;
  /** Which way the front wall, with its door, faces: +1 towards +z, -1 towards -z. Both face the street. */
  facing: 1 | -1;
  /** The walls' colour outside, and the roof's shape and colour. */
  facade: PaletteColour;
  roof: { shape: 'gable' | 'flat'; colour: PaletteColour };
};

export const WALL = { height: 2.4, thickness: 0.3, doorWidth: 1.8 } as const;

export const BUILDINGS: readonly Building[] = [
  { placeId: 'town-office', centre: [-44, -1], size: [12, 8], facing: 1, facade: 'linen', roof: { shape: 'flat', colour: 'slate' } },
  { placeId: 'bookshop', centre: [-30, -0.5], size: [8, 7], facing: 1, facade: 'lavender', roof: { shape: 'gable', colour: 'plum' } },
  { placeId: 'home', centre: [-10, 0], size: [8, 7], facing: 1, facade: 'sky', roof: { shape: 'gable', colour: 'terracotta' } },
  { placeId: 'convenience-store', centre: [0.5, -0.5], size: [7, 7], facing: 1, facade: 'mint', roof: { shape: 'flat', colour: 'denim' } },
  { placeId: 'cafe', centre: [12, -1], size: [10, 8], facing: 1, facade: 'peach', roof: { shape: 'gable', colour: 'brick' } },
  { placeId: 'supermarket', centre: [27, -1.5], size: [14, 9], facing: 1, facade: 'butter', roof: { shape: 'flat', colour: 'terracotta' } },
  { placeId: 'restaurant', centre: [42, -1], size: [10, 8], facing: 1, facade: 'blush', roof: { shape: 'gable', colour: 'brick' } },
  { placeId: 'clinic', centre: [-26, 16], size: [16, 10], facing: -1, facade: 'white', roof: { shape: 'flat', colour: 'sky' } },
  { placeId: 'bathhouse', centre: [24, 15.5], size: [12, 9], facing: -1, facade: 'sky', roof: { shape: 'gable', colour: 'denim' } },
];

/** The building a place is in, if it has one. */
export const buildingOf = (placeId: PlaceId) => BUILDINGS.find((b) => b.placeId === placeId);
const building = (placeId: PlaceId) => buildingOf(placeId)!;

/**
 * A building's own frame, for what stands inside it: from its centre, x along the front wall and z out through the
 * front door, with rotation 0 facing the door. So a building can move, or face the other way, and keep its insides.
 */
export function inside(placeId: PlaceId) {
  const { centre: [cx, cz], facing } = building(placeId);
  return {
    /** A point in the building's frame, in the town. */
    at: ([x, y, z]: Vec3): Vec3 => [cx + facing * x, y, cz + facing * z],
    /** A turn in the building's frame (radians about y; 0 faces the door), in the town. */
    turn: (rotation = 0) => rotation + (facing === 1 ? 0 : Math.PI),
  };
}

const home = inside('home');
const cafe = inside('cafe');
const supermarket = inside('supermarket');
const convenienceStore = inside('convenience-store');
const restaurant = inside('restaurant');
const clinic = inside('clinic');
const bookshop = inside('bookshop');
const bathhouse = inside('bathhouse');
const townOffice = inside('town-office');

export const STREET = { z: 7, width: 5 } as const;
export const GROUND_HALF_SIZE = 60;

/** The park: open grass on the south side of the street, with no walls or door. */
export const PARK = { centre: [0, 18] as Vec2, size: [22, 13] as Vec2 } as const;

/** A point in the park, from its centre. */
export const inPark = ([x, y, z]: Vec3): Vec3 => [PARK.centre[0] + x, y, PARK.centre[1] + z];
const onPark = ([x, z]: Vec2): Vec2 => [PARK.centre[0] + x, PARK.centre[1] + z];

/** Bushes and flowers around the park's edges and by its benches, clear of the way in from the street. */
export const PARK_PLANTING: readonly { at: Vec2; piece: TownPiece }[] = (
  [
    { at: [-10.2, -3], piece: 'bush' },
    { at: [-10.2, 1.5], piece: 'bush' },
    { at: [10.2, -1.5], piece: 'bush' },
    { at: [10.2, 2.5], piece: 'bush' },
    { at: [-4.5, 6], piece: 'bush' },
    { at: [0.5, 6], piece: 'bush' },
    { at: [6, 6], piece: 'bush' },
    { at: [-4.6, 0.3], piece: 'flowers-red' },
    { at: [-7.4, 0.3], piece: 'flowers-yellow' },
    { at: [1.6, 5.3], piece: 'flowers-purple' },
    { at: [4.4, 5.3], piece: 'flowers-red' },
    { at: [-9.6, -0.8], piece: 'flowers-purple' },
    { at: [9.6, 0.5], piece: 'flowers-yellow' },
  ] as const
).map(({ at, piece }) => ({ at: onPark(at), piece }));

/** Street lights, as where each pole stands: along the pavement either side of the street, clear of doors and stops. */
export const STREET_LIGHTS: readonly Vec2[] = [
  ...[-50.5, -37, -20, 6, 19.5, 34.5, 50.5].map((x): Vec2 => [x, STREET.z - STREET.width / 2 - 0.5]),
  ...[-40, -15, 14, 34, 48].map((x): Vec2 => [x, STREET.z + STREET.width / 2 + 0.5]),
];

/**
 * Each tram stop: an island platform in the middle of the street, with a pole at its centre. Passers-by name the stop
 * nearest each building (`STOP_PLACES`), so moving a stop or a building means checking that list still holds.
 */
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
  landlord: home.at([-1.4, 1, 2.7]),
  barista: cafe.at([0, 1, -3.1]),
  cashier: supermarket.at([-3, 1, 0.8]),
  'convenience-clerk': convenienceStore.at([0, 1, -2.7]),
  server: restaurant.at([1.5, 1, 1.5]),
  receptionist: clinic.at([4, 1, 1.4]),
  pharmacist: clinic.at([-5, 1, 1.4]),
  doctor: clinic.at([5, 1, -3.2]),
  nurse: clinic.at([-3, 1, -3.2]),
  'park-regular-1': inPark([-6, 1, -2]),
  'park-regular-2': inPark([3, 1, 3]),
  'park-regular-3': inPark([8, 1, -3.5]),
  // At the east end of the platform each waits at, clear of the pole.
  'passer-by-1': [TRAM_STOPS[PASSER_BY_STOPS['passer-by-1']].centre[0] + 3.2, 1, STREET.z],
  'passer-by-2': [TRAM_STOPS[PASSER_BY_STOPS['passer-by-2']].centre[0] + 3.2, 1, STREET.z],
  'passer-by-3': [TRAM_STOPS[PASSER_BY_STOPS['passer-by-3']].centre[0] + 3.2, 1, STREET.z],
  shopkeeper: bookshop.at([0, 1, -2.6]),
  attendant: bathhouse.at([0, 1, 0.9]),
  'office-clerk': townOffice.at([0, 1, -2.7]),
};

/** Passers-by wait on the platforms only while the trams run. */
export const isWaitingForTram = (npcId: TownNpcId) => TOWN_NPCS[npcId].role === 'passer-by';

/**
 * Where each grocery sits on the supermarket's aisle shelves, facing the aisle south of it.
 * The vegetables and eggs face the door; the noodles are down the aisle between the shelves.
 */
export const SHELF_SPOTS: Record<GroceryId, Vec3> = {
  vegetables: supermarket.at([0, 1, 1.45]),
  eggs: supermarket.at([3.5, 1, 1.45]),
  noodles: supermarket.at([2, 1, -1.05]),
};

/** Park trees: trunk positions on the ground. */
export const TREES: readonly Vec2[] = (
  [
    [-9, -5],
    [-2, 4],
    [6, 0],
    [9, 5],
    [-8, 4],
  ] as const
).map(onPark);

/** The tap at home, against the back wall straight ahead of the spawn point. */
export const HOME_TAP: Vec3 = home.at([0, 0.5, -2.85]);
export const HOME_BED: Vec3 = home.at([-2.4, 0.25, -1.4]);
/** The stove at home, along the back wall to the right of the tap. */
export const HOME_STOVE: Vec3 = home.at([2.4, 0.5, -2.85]);

/** The gym at the bathhouse: a running machine against the west wall beside the door, out of talking range of the attendant. */
export const BATHHOUSE_GYM: Vec3 = bathhouse.at([3.5, 0.5, 2.5]);

/** The Fainting ward's bed, at the back of the clinic, within talking range of the nurse. */
export const WARD_BED: Vec3 = clinic.at([-4.8, 0.25, -3.4]);

/**
 * The furniture: solid to the Character, as centre and size, each drawn by a kit piece turned by `rotation` (radians about
 * y; 0 faces +z). A piece fills its box, repeated along the box's length if it's long, unless `height` keeps the piece taller
 * than what's solid (a bed's headboard, a bench's back).
 */
export const FURNITURE: readonly { position: Vec3; size: Vec3; piece: TownPiece; rotation?: number; height?: number }[] = [
  // Café counter.
  { position: cafe.at([0, 0.55, -2]), size: [4, 1.1, 0.8], piece: 'counter', rotation: cafe.turn() },
  // Convenience store counter and shelves.
  { position: convenienceStore.at([0, 0.55, -1.7]), size: [3, 1.1, 0.7], piece: 'counter', rotation: convenienceStore.turn() },
  { position: convenienceStore.at([-2.3, 0.8, 1.5]), size: [0.6, 1.6, 2.4], piece: 'shelf', rotation: convenienceStore.turn(Math.PI / 2) },
  // Supermarket checkout and aisles.
  { position: supermarket.at([-3, 0.55, 1.9]), size: [2.4, 1.1, 0.8], piece: 'counter', rotation: supermarket.turn() },
  { position: supermarket.at([2, 0.8, -1.5]), size: [6, 1.6, 0.7], piece: 'shelf', rotation: supermarket.turn() },
  { position: supermarket.at([2, 0.8, 1]), size: [6, 1.6, 0.7], piece: 'shelf', rotation: supermarket.turn() },
  // Restaurant tables.
  { position: restaurant.at([-2.5, 0.4, -2]), size: [1.4, 0.8, 1.4], piece: 'table', rotation: restaurant.turn() },
  { position: restaurant.at([2.5, 0.4, -2]), size: [1.4, 0.8, 1.4], piece: 'table', rotation: restaurant.turn() },
  // The server's table on a Shift, west of the door and clear of the way from the door to the staff door.
  { position: restaurant.at([-2.5, 0.4, 0.7]), size: [1.4, 0.8, 1.4], piece: 'table', rotation: restaurant.turn() },
  // Clinic reception and pharmacy counters, and the waiting room bench.
  { position: clinic.at([4, 0.55, 2.5]), size: [3, 1.1, 0.8], piece: 'counter', rotation: clinic.turn() },
  { position: clinic.at([-5, 0.55, 2.5]), size: [3, 1.1, 0.8], piece: 'counter', rotation: clinic.turn() },
  { position: clinic.at([0, 0.25, -1]), size: [3, 0.5, 0.7], piece: 'cushioned-bench', rotation: clinic.turn(), height: 1 },
  // Bookshop counter and shelves.
  { position: bookshop.at([0, 0.55, -1.5]), size: [2.6, 1.1, 0.7], piece: 'counter', rotation: bookshop.turn() },
  { position: bookshop.at([-3, 1, 0.5]), size: [0.6, 2, 3], piece: 'bookcase', rotation: bookshop.turn(Math.PI / 2) },
  { position: bookshop.at([3, 1, 0.5]), size: [0.6, 2, 3], piece: 'bookcase', rotation: bookshop.turn(-Math.PI / 2) },
  // Bathhouse front desk.
  { position: bathhouse.at([0, 0.55, 2]), size: [3, 1.1, 0.8], piece: 'counter', rotation: bathhouse.turn() },
  // Town office counter.
  { position: townOffice.at([0, 0.55, -1.5]), size: [5, 1.1, 0.8], piece: 'counter', rotation: townOffice.turn() },
  // Park benches, facing the park regulars who sit by them.
  { position: inPark([-6, 0.25, -0.6]), size: [2, 0.5, 0.6], piece: 'bench', rotation: Math.PI, height: 1 },
  { position: inPark([3, 0.25, 4.4]), size: [2, 0.5, 0.6], piece: 'bench', rotation: Math.PI, height: 1 },
  // Home: the tap and the stove against the back wall, and the bed.
  { position: HOME_TAP, size: [1.2, 1, 0.6], piece: 'sink', rotation: home.turn() },
  { position: HOME_STOVE, size: [1.2, 1, 0.6], piece: 'stove', rotation: home.turn() },
  { position: HOME_BED, size: [1.4, 0.5, 2.2], piece: 'bed', rotation: home.turn(), height: 0.9 },
  // The clinic's ward bed and the bathhouse's running machine.
  { position: WARD_BED, size: [1.4, 0.5, 2.2], piece: 'bed', rotation: clinic.turn(Math.PI), height: 0.9 },
  { position: BATHHOUSE_GYM, size: [1, 1, 2], piece: 'treadmill', rotation: bathhouse.turn(Math.PI), height: 1.4 },
];

/** Set dressing nobody bumps into: rugs, plants and fridges, as where each stands, its piece, and how it's turned. */
export const DECOR: readonly { position: Vec3; piece: TownPiece; rotation?: number }[] = [
  { position: home.at([0, 0.02, -0.4]), piece: 'rug', rotation: home.turn() },
  { position: home.at([3.4, 0, -2.8]), piece: 'plant', rotation: home.turn() },
  { position: cafe.at([-2.6, 0, -3.4]), piece: 'fridge', rotation: cafe.turn() },
  { position: cafe.at([-4.2, 0, 3.2]), piece: 'plant', rotation: cafe.turn() },
  { position: cafe.at([4.2, 0, 3.2]), piece: 'plant', rotation: cafe.turn() },
  { position: restaurant.at([4.2, 0, 3.2]), piece: 'plant', rotation: restaurant.turn() },
  // Out on the pavement, west of the bookshop.
  { position: bookshop.at([-6.6, 0, 2.7]), piece: 'plant', rotation: bookshop.turn() },
  { position: townOffice.at([-5.2, 0, 3.2]), piece: 'plant', rotation: townOffice.turn() },
  { position: clinic.at([7.4, 0, -3.8]), piece: 'plant', rotation: clinic.turn() },
  { position: clinic.at([-7.2, 0, 4.4]), piece: 'plant', rotation: clinic.turn() },
];

/**
 * Where each Job is worked: its staff door, set in its place's west wall (and where the Character stands to use it);
 * where the Character stands through a Shift, behind the counter beside its staff; and where a Shift Customer stands,
 * across the counter. The café's is level with its counter; the supermarket's, with the customers' side of its till.
 * At the restaurant the staff door is level with the front door; the Character stands at the table by the west wall,
 * and the customer is seated across it, with the rest of their table (`otherSeats`) on either side.
 */
export const WORKPLACES: Record<
  JobId,
  { door: Vec3; doorRotation: number; usedFrom: Vec3; behindTheCounter: Vec3; customerSpot: Vec3; otherSeats?: readonly Vec3[] }
> = {
  barista: {
    door: cafe.at([-4.78, 1.1, -1.2]),
    doorRotation: cafe.turn(Math.PI / 2),
    usedFrom: cafe.at([-4.3, 1, -1.2]),
    behindTheCounter: cafe.at([1.4, 1, -3]),
    customerSpot: cafe.at([1.4, 1, -0.8]),
  },
  cashier: {
    door: supermarket.at([-6.78, 1.1, 2.5]),
    doorRotation: supermarket.turn(Math.PI / 2),
    usedFrom: supermarket.at([-6.3, 1, 2.5]),
    behindTheCounter: supermarket.at([-2, 1, 0.9]),
    customerSpot: supermarket.at([-2, 1, 3.1]),
  },
  server: {
    door: restaurant.at([-4.78, 1.1, 2.5]),
    doorRotation: restaurant.turn(Math.PI / 2),
    usedFrom: restaurant.at([-4.3, 1, 2.5]),
    behindTheCounter: restaurant.at([-1, 1, 0.7]),
    customerSpot: restaurant.at([-3.7, 1, 0.7]),
    otherSeats: [restaurant.at([-2.5, 1, -0.35]), restaurant.at([-2.5, 1, 1.75])],
  },
};

/**
 * A sign: where its middle hangs, its size in metres, and which way it faces (radians about y; 0 faces +z). A building's
 * name board hides while the Character is inside (`liftsInside`), when the roof is off too, so it never hides them.
 */
export type SignSpot = { position: Vec3; size: readonly [width: number, height: number]; rotation?: number; liftsInside?: PlaceId };

/** A building's front, outside: the middle of its wall's outer face, its width, and the way it faces (and turns to). */
export function frontOf({ centre: [x, z], size: [width, depth], facing }: Building) {
  return { x, z: z + (facing * depth) / 2, width, facing, rotation: facing === 1 ? 0 : Math.PI };
}

/** Over a building's door, hung from the eaves in front of the roof. */
function nameBoard(building: Building): SignSpot {
  const { x, z, facing, rotation } = frontOf(building);
  return { position: [x, 2.75, z + facing * 0.32], size: [3.4, 0.7], rotation, liftsInside: building.placeId };
}

/** Beside a building's door at eye height, clear of the door frame and the window: smaller where the wall beside the door is short. */
function hoursBoard(building: Building): SignSpot {
  const { x, z, width, facing, rotation } = frontOf(building);
  const roomy = width >= 10;
  return { position: [x + facing * (roomy ? 2.1 : 1.55), 1.5, z + facing * 0.02], size: roomy ? [1, 0.7] : [0.6, 0.45], rotation };
}

/** On a tram stop's pole, above head height. */
function stopBoard(stopId: TramStopId): SignSpot {
  const [x, z] = TRAM_STOPS[stopId].centre;
  return { position: [x, 2.45, z + 0.17], size: [1.3, 0.4] };
}

/** Where each sign hangs. The park's name stands on two posts at its way in; each tram stop's hangs on its pole. */
export const SIGNS: Record<SignId, SignSpot> = {
  'home-name': nameBoard(building('home')),
  'cafe-name': nameBoard(building('cafe')),
  'supermarket-name': nameBoard(building('supermarket')),
  'convenience-store-name': nameBoard(building('convenience-store')),
  'restaurant-name': nameBoard(building('restaurant')),
  'clinic-name': nameBoard(building('clinic')),
  'park-name': { position: inPark([-3.2, 1.6, -PARK.size[1] / 2 + 0.1]), size: [2, 0.5] },
  'bookshop-name': nameBoard(building('bookshop')),
  'bathhouse-name': nameBoard(building('bathhouse')),
  'town-office-name': nameBoard(building('town-office')),
  'west-stop-name': stopBoard('west-stop'),
  'central-stop-name': stopBoard('central-stop'),
  'east-stop-name': stopBoard('east-stop'),
  'cafe-hours': hoursBoard(building('cafe')),
  'supermarket-hours': hoursBoard(building('supermarket')),
  'restaurant-hours': hoursBoard(building('restaurant')),
  'clinic-hours': hoursBoard(building('clinic')),
  'bookshop-hours': hoursBoard(building('bookshop')),
  'bathhouse-hours': hoursBoard(building('bathhouse')),
  'town-office-hours': hoursBoard(building('town-office')),
  // On the back wall behind the counter, to the barista's left.
  'cafe-menu': { position: cafe.at([2.3, 1.65, -3.68]), size: [1.7, 1.5], rotation: cafe.turn() },
  // On the back wall, between the two tables.
  'restaurant-menu': { position: restaurant.at([0, 1.65, -3.68]), size: [1.7, 1.5], rotation: restaurant.turn() },
};

/** The posts the park's name board stands on. */
export const PARK_SIGN_POSTS: readonly Vec2[] = [-1, 1].map((side): Vec2 => [SIGNS['park-name'].position[0] + side * 0.9, SIGNS['park-name'].position[2] - 0.05]);

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
  park: inPark([0, 1, -PARK.size[1] / 2 + 1.5]),
  'tram-stop': tramStopSpawn(TRAM_LINE[0]),
};

export function spawnAt(placeId: PlaceId): Vec3 {
  return SPAWN_POINTS[placeId];
}

/** Back from a save at home, the Character wakes up in bed. It drops onto the mattress. */
export const IN_BED: Vec3 = [HOME_BED[0], 1.5, HOME_BED[2]];

/** After Fainting, the Character wakes up in the ward bed. */
export const IN_WARD_BED: Vec3 = [WARD_BED[0], 1.5, WARD_BED[2]];

/** In front of the doctor: where the Character goes when the doctor calls their name from the waiting room. */
export const BEFORE_THE_DOCTOR: Vec3 = clinic.at([5, 1.5, -3.2 + 1.8]);

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
