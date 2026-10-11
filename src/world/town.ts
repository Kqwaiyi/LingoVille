import { PASSER_BY_STOPS, TOWN_NPCS, TRAM_LINE, type GroceryId, type SignId, type TownNpcId, type TramStopId } from '../content/index.ts';
import type { JobId, PlaceId } from '../sim/index.ts';
import type { PaletteColour } from './palette.ts';
import type { Repaint, Size, TownPiece } from './townArt.ts';

// The town's layout: one long high street along the x axis, with a double tram line down its middle and three island
// platforms between the tracks for the stops, Old Town in the west, the Town Centre and Market Street in the east. Seven
// buildings face it from the north (doors on +z) and the clinic and bathhouse from the south (doors on -z), with the
// park, open to the street, between them, running down to the canal. Everything in a building stands in the building's
// own frame (`inside`), and everything in the park from its centre. What only dresses the town (the buildings nobody goes
// into, the street furniture, the backdrop) is in `scenery.ts`. The layout, façades and roofs are the same in every
// Culture Pack.

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
  /** How many storeys it stands: the Character only ever goes in the ground floor; the floors above lift off with the roof. */
  storeys: 1 | 2 | 3;
  /** Striped awnings over the front windows, in this colour and white. */
  awnings?: PaletteColour;
  /** Flower boxes under the windows of the floors above. */
  windowBoxes?: boolean;
};

export const WALL = { height: 2.4, thickness: 0.3, doorWidth: 1.8 } as const;

/**
 * The high street: its middle, where the island platforms stand between the two tracks, the width from kerb to kerb,
 * the pavements' width either side, and how far each track runs from the middle.
 */
export const STREET = { z: 8, width: 9, pavement: 2.7, track: 2.5 } as const;
/** Where the buildings' front walls stand: north of the street, and south of it. */
export const NORTH_FRONT = STREET.z - STREET.width / 2 - STREET.pavement;
export const SOUTH_FRONT = STREET.z + STREET.width / 2 + STREET.pavement;

/** A building on the street: its door in the middle of its front wall, on the north side (facing the street) or the south. */
export function onStreet(x: number, side: 'north' | 'south', [width, depth]: Vec2): Pick<Building, 'centre' | 'size' | 'facing'> {
  return side === 'north'
    ? { centre: [x, NORTH_FRONT - depth / 2], size: [width, depth], facing: 1 }
    : { centre: [x, SOUTH_FRONT + depth / 2], size: [width, depth], facing: -1 };
}

export const BUILDINGS: readonly Building[] = [
  { placeId: 'town-office', ...onStreet(-58, 'north', [14, 10]), facade: 'linen', roof: { shape: 'flat', colour: 'slate' }, storeys: 2 },
  { placeId: 'bookshop', ...onStreet(-42.5, 'north', [9, 8]), facade: 'lavender', roof: { shape: 'gable', colour: 'plum' }, storeys: 2, windowBoxes: true },
  { placeId: 'home', ...onStreet(-9, 'north', [10, 9]), facade: 'sky', roof: { shape: 'gable', colour: 'terracotta' }, storeys: 3, windowBoxes: true },
  { placeId: 'convenience-store', ...onStreet(1, 'north', [8, 8]), facade: 'mint', roof: { shape: 'flat', colour: 'denim' }, storeys: 1 },
  { placeId: 'cafe', ...onStreet(14, 'north', [12, 9]), facade: 'peach', roof: { shape: 'gable', colour: 'brick' }, storeys: 2, awnings: 'teal', windowBoxes: true },
  { placeId: 'supermarket', ...onStreet(36, 'north', [16, 11]), facade: 'butter', roof: { shape: 'flat', colour: 'terracotta' }, storeys: 1, awnings: 'mustard' },
  { placeId: 'restaurant', ...onStreet(53, 'north', [12, 9]), facade: 'blush', roof: { shape: 'gable', colour: 'brick' }, storeys: 2, awnings: 'red', windowBoxes: true },
  { placeId: 'clinic', ...onStreet(-40, 'south', [18, 11]), facade: 'white', roof: { shape: 'flat', colour: 'sky' }, storeys: 2 },
  { placeId: 'bathhouse', ...onStreet(36, 'south', [14, 10]), facade: 'sky', roof: { shape: 'gable', colour: 'denim' }, storeys: 1 },
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

/** The ground the town stands on: x from west to east, z from north to south. Past it, only the backdrop. */
export const GROUND = { x: [-320, 320], z: [-320, 320] } as const;
/** Where the Character can walk: from the back gardens' fence in the north to the canal's railing in the south, and between the ends of town. */
export const TOWN_BOUNDS = { x: [-96, 96], z: [-16, 39.6] } as const;

/** The park: open grass on the south side of the street, with no walls or door, running down to the canal. */
export const PARK = { centre: [0, 26] as Vec2, size: [28, 21] as Vec2 } as const;

/** A point in the park, from its centre: its way in, from the street, is at -z. */
export const inPark = ([x, y, z]: Vec3): Vec3 => [PARK.centre[0] + x, y, PARK.centre[1] + z];
const onPark = ([x, z]: Vec2): Vec2 => [PARK.centre[0] + x, PARK.centre[1] + z];

/** The park's gravel paths, as centre and size: one from the way in down to the canal, one across past the bandstand. */
export const PARK_PATHS: readonly { centre: Vec2; size: Vec2 }[] = [
  { centre: onPark([0, 0]), size: [2.2, PARK.size[1]] },
  { centre: onPark([0, -5]), size: [PARK.size[0] - 2, 2] },
];

/** The bandstand, east of the path in, its steps facing the way in; and the pond, west of the path, with lilies on it. */
export const BANDSTAND: Vec2 = onPark([7, -0.5]);
export const POND = { centre: onPark([-6, 4.5]), radius: 2.6 } as const;

/** Hedges, bushes and flowers around the park's edges and by its benches, clear of the way in and the paths. */
export const PARK_PLANTING: readonly { at: Vec2; piece: TownPiece; rotation?: number }[] = (
  [
    // Hedges along the street, either side of the way in.
    ...[-12.5, -10.5, -8.5, -6.5].map((x) => ({ at: [x, -10] as const, piece: 'hedge' as const })),
    ...[3.5, 5.5, 7.5, 9.5, 11.5].map((x) => ({ at: [x, -10] as const, piece: 'hedge' as const })),
    { at: [-13.2, -6.5], piece: 'bush' },
    { at: [-13.2, 1.5], piece: 'bush-large' },
    { at: [13.2, -2.5], piece: 'bush' },
    { at: [13.2, 4.5], piece: 'bush-large' },
    { at: [-4.5, 9.5], piece: 'bush' },
    { at: [4.5, 9.5], piece: 'bush' },
    { at: [9.5, 9.5], piece: 'bush-large' },
    { at: [-8.5, -2.8], piece: 'flowers-red' },
    { at: [-5.5, -2.8], piece: 'flowers-yellow' },
    { at: [1.8, 7.3], piece: 'flowers-purple' },
    { at: [5.8, 6.8], piece: 'flowers-red' },
    { at: [-12.6, -3.6], piece: 'flowers-purple' },
    { at: [12.6, 1.5], piece: 'flowers-yellow' },
    { at: [-2.2, -8.5], piece: 'flowers-red' },
    { at: [2.2, -8.5], piece: 'flowers-yellow' },
    { at: [-9.3, 3.2], piece: 'rock' },
    { at: [-3.4, 6.4], piece: 'grass-tuft' },
    { at: [-8.6, 6.6], piece: 'grass-tuft' },
  ] as const
).map(({ at, piece }, i) => ({ at: onPark(at), piece, rotation: piece === 'hedge' ? 0 : i * 1.3 }));

/** Street lights, as where each pole stands: along the pavement either side of the street, clear of doors, terraces and the ways onto the platforms. */
export const STREET_LIGHTS: readonly Vec2[] = [
  ...[-80, -64, -49, -34, -19, 6, 22, 45, 62, 78].map((x): Vec2 => [x, NORTH_FRONT + STREET.pavement - 0.5]),
  ...[-85, -70, -54, -33, -22, -12, 12, 24, 46, 60, 75].map((x): Vec2 => [x, SOUTH_FRONT - STREET.pavement + 0.5]),
];

/**
 * Each tram stop: an island platform between the tracks, with a pole at its centre. Passers-by name the stop nearest
 * each building (`STOP_PLACES`), so moving a stop or a building means checking that list still holds
 * (`tooling/stopPlaces.test.ts` checks it).
 */
export const TRAM_STOPS: Record<TramStopId, { centre: Vec2 }> = {
  'west-stop': { centre: [-45, STREET.z] },
  'central-stop': { centre: [-2, STREET.z] },
  'east-stop': { centre: [44, STREET.z] },
};
export const PLATFORM = { size: [10, 2.2] as Vec2, height: 0.15 } as const;

/** Where each person in town stands. Staff stand behind their counter, facing the door. */
export const NPC_SPOTS: Record<TownNpcId, Vec3> = {
  // In the hallway beside the front door, so the Character passes within talking range on the way out
  // (and the landlord can catch them), but not from where a new game starts.
  landlord: home.at([-1.6, 1, 3.4]),
  barista: cafe.at([0, 1, -3.4]),
  cashier: supermarket.at([-4, 1, 1.6]),
  'convenience-clerk': convenienceStore.at([0, 1, -3]),
  server: restaurant.at([1.8, 1, 2]),
  receptionist: clinic.at([4.5, 1, 1.7]),
  pharmacist: clinic.at([-5.5, 1, 1.7]),
  doctor: clinic.at([5.5, 1, -3.8]),
  nurse: clinic.at([-3.5, 1, -3.7]),
  'park-regular-1': inPark([-7, 1, -3]),
  'park-regular-2': inPark([4, 1, 4]),
  'park-regular-3': inPark([10.5, 1, -4.6]),
  // At the east end of the platform each waits at, clear of the pole.
  'passer-by-1': [TRAM_STOPS[PASSER_BY_STOPS['passer-by-1']].centre[0] + 3.8, 1, STREET.z],
  'passer-by-2': [TRAM_STOPS[PASSER_BY_STOPS['passer-by-2']].centre[0] + 3.8, 1, STREET.z],
  'passer-by-3': [TRAM_STOPS[PASSER_BY_STOPS['passer-by-3']].centre[0] + 3.8, 1, STREET.z],
  shopkeeper: bookshop.at([0, 1, -2.9]),
  attendant: bathhouse.at([0, 1, 1.1]),
  'office-clerk': townOffice.at([0, 1, -3]),
};

/** Passers-by wait on the platforms only while the trams run. */
export const isWaitingForTram = (npcId: TownNpcId) => TOWN_NPCS[npcId].role === 'passer-by';

/**
 * Where each grocery sits on the supermarket's aisle shelves, facing the aisle south of it.
 * The vegetables and eggs face the door; the noodles are down the aisle between the shelves.
 */
const SHELF_SPOTS_LOCAL: Record<GroceryId, Vec3> = { vegetables: [0, 1, 1.6], eggs: [3.5, 1, 1.6], noodles: [2, 1, -1.0] };
export const SHELF_SPOTS: Record<GroceryId, Vec3> = {
  vegetables: supermarket.at(SHELF_SPOTS_LOCAL.vegetables),
  eggs: supermarket.at(SHELF_SPOTS_LOCAL.eggs),
  noodles: supermarket.at(SHELF_SPOTS_LOCAL.noodles),
};

/** Park trees: trunk positions on the ground, around the edges and by the paths. */
export const TREES: readonly Vec2[] = (
  [
    [-11, -7.5],
    [-11.5, 4],
    [-3.5, 9],
    [11.5, 8],
    [12, -7],
    [-12, 9],
    [3, 9.5],
    [-9.6, 0.6],
  ] as const
).map(onPark);

/** The tap at home, against the back wall straight ahead of the spawn point. */
export const HOME_TAP: Vec3 = home.at([0, 0.5, -3.85]);
export const HOME_BED: Vec3 = home.at([-3.9, 0.25, -3]);
/** The stove at home, along the back wall to the right of the tap. */
export const HOME_STOVE: Vec3 = home.at([2.4, 0.5, -3.85]);

/** The gym at the bathhouse: a running machine by the side wall beside the door, out of talking range of the attendant. */
export const BATHHOUSE_GYM: Vec3 = bathhouse.at([5.5, 0.5, 2.2]);

/** The Fainting ward's bed, at the back of the clinic, within talking range of the nurse. */
export const WARD_BED: Vec3 = clinic.at([-5.5, 0.25, -3.9]);

type Furniture = { position: Vec3; size: Vec3; piece: TownPiece; rotation?: number; height?: number; repaint?: Repaint };

/** Something solid that's drawn as something else, or not at all: a table among its chairs, the bandstand, the pond. */
type SolidBox = { position: Vec3; size: Vec3 };

/** A table for two or four (round, or square under a cloth), with its chairs round it, their cushions in `colour`: table and chairs solid together, as one box. */
function tableFor(at: ReturnType<typeof inside>, [x, z]: Vec2, seats: 2 | 4, colour: PaletteColour, piece: 'table-round' | 'table' = 'table-round'): { solid: SolidBox; decor: Decor[] } {
  const sides: Vec2[] = seats === 2 ? [[-0.95, 0], [0.95, 0]] : [[-0.95, 0], [0.95, 0], [0, -0.95], [0, 0.95]];
  return {
    solid: { position: at.at([x, 0.4, z]), size: seats === 2 ? [2.4, 0.8, 1.1] : [2.4, 0.8, 2.4] },
    decor: [
      { position: at.at([x, 0, z]), piece, rotation: at.turn(), size: [1.1, 0.8, 1.1] },
      ...sides.map(([dx, dz]) => ({ position: at.at([x + dx, 0, z + dz]), piece: 'chair' as const, rotation: at.turn(Math.atan2(-dx, -dz)), repaint: { red: colour } })),
    ],
  };
}

const cafeTables = [tableFor(cafe, [-3.9, 2], 2, 'teal'), tableFor(cafe, [3.9, 2], 2, 'teal'), tableFor(cafe, [4.3, -0.4], 2, 'teal')];
const restaurantTables = [tableFor(restaurant, [-3, -2.6], 4, 'brick', 'table'), tableFor(restaurant, [1, -2.6], 4, 'brick', 'table'), tableFor(restaurant, [4.3, 0.4], 2, 'brick', 'table')];

/**
 * A shelf's stock, in a building's frame: rows of books or goods (a metre each) from one end of the shelf to the other,
 * at each of its shelves' heights, facing the way the shelf does; none where `keepClear` says (where the groceries are).
 */
function stock(at: ReturnType<typeof inside>, piece: 'shelf-books' | 'shelf-goods', [x0, z0]: Vec2, [x1, z1]: Vec2, levels: readonly number[], facing: number, keepClear: (x: number, y: number) => boolean = () => false): Decor[] {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const count = Math.max(1, Math.round(length));
  return levels.flatMap((y) =>
    Array.from({ length: count }, (_, i) => (i + 0.5) / count)
      .map((t): [number, number] => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t])
      .filter(([x]) => !keepClear(x, y))
      .map(([x, z]): Decor => ({ position: at.at([x, y, z]), piece, rotation: at.turn(facing), size: [(length / count) * 0.95, null, null] })),
  );
}
/** The heights of the shelves in a 2 m bookcase, and in a 1.6 m open shelf unit. */
const BOOKCASE_SHELVES = [0.17, 0.7, 1.22] as const;
const SHELF_LEVELS = [0.18, 0.66, 1.09] as const;
/** Where the groceries sit on an aisle shelf (its grocery spots' z), which its stock leaves clear. */
const nearGroceries = (z: number) => (x: number, y: number) =>
  y > 0.5 && y < 1.2 && Object.values(SHELF_SPOTS_LOCAL).some(([gx, , gz]) => Math.abs(gz - z) < 0.8 && Math.abs(gx - x) < 0.9);

/**
 * The furniture: solid to the Character, as centre and size, each drawn by a kit piece turned by `rotation` (radians about
 * y; 0 faces +z). A piece fills its box, repeated along the box's length if it's long, unless `height` keeps the piece taller
 * than what's solid (a bed's headboard, a bench's back), or shorter (a table among its chairs).
 */
export const FURNITURE: readonly Furniture[] = [
  // Café: the counter, with the back counter and its coffee machine behind it, and tables in the window.
  { position: cafe.at([0, 0.55, -2.3]), size: [4.4, 1.1, 0.8], piece: 'counter', rotation: cafe.turn() },
  { position: cafe.at([-2.6, 0.55, -3.85]), size: [2.4, 1.1, 0.6], piece: 'counter', rotation: cafe.turn() },
  // Convenience store: the counter, shelves down both sides and a drinks fridge at the back.
  { position: convenienceStore.at([0, 0.55, -2]), size: [3, 1.1, 0.7], piece: 'counter', rotation: convenienceStore.turn() },
  { position: convenienceStore.at([-3.3, 0.8, 0.6]), size: [0.6, 1.6, 2.6], piece: 'shelf', rotation: convenienceStore.turn(Math.PI / 2) },
  { position: convenienceStore.at([3.3, 0.8, 0.6]), size: [0.6, 1.6, 2.6], piece: 'shelf', rotation: convenienceStore.turn(-Math.PI / 2) },
  { position: convenienceStore.at([-2.6, 1.05, -3.2]), size: [1.2, 2.1, 0.9], piece: 'fridge-tall', rotation: convenienceStore.turn() },
  { position: convenienceStore.at([2.7, 0.45, -3.3]), size: [1.6, 0.9, 0.6], piece: 'bookcase-low', rotation: convenienceStore.turn() },
  // Supermarket: the checkout, two aisles of shelves, a shelf along the side wall and chiller cabinets along the back.
  { position: supermarket.at([-4, 0.55, 2.6]), size: [2.4, 1.1, 0.8], piece: 'counter', rotation: supermarket.turn() },
  { position: supermarket.at([2, 0.8, -1.4]), size: [6, 1.6, 0.7], piece: 'shelf', rotation: supermarket.turn() },
  { position: supermarket.at([2, 0.8, 1.2]), size: [6, 1.6, 0.7], piece: 'shelf', rotation: supermarket.turn() },
  { position: supermarket.at([-7.3, 0.8, -2]), size: [0.6, 1.6, 3.6], piece: 'shelf', rotation: supermarket.turn(Math.PI / 2) },
  { position: supermarket.at([2.6, 1.05, -4.7]), size: [6, 2.1, 0.9], piece: 'fridge-tall', rotation: supermarket.turn() },
  // Restaurant: tables, and the server's table on a Shift, west of the door and clear of the way from the door to the staff door.
  { position: restaurant.at([-3, 0.4, 1]), size: [1.4, 0.8, 1.4], piece: 'table', rotation: restaurant.turn() },
  // Clinic: reception and pharmacy counters, the pharmacy's shelves, the waiting room bench and the doctor's desk.
  { position: clinic.at([4.5, 0.55, 2.8]), size: [3, 1.1, 0.8], piece: 'counter', rotation: clinic.turn() },
  { position: clinic.at([-5.5, 0.55, 2.8]), size: [3, 1.1, 0.8], piece: 'counter', rotation: clinic.turn() },
  { position: clinic.at([-8.3, 0.8, 1.6]), size: [0.6, 1.6, 2.4], piece: 'shelf', rotation: clinic.turn(Math.PI / 2) },
  { position: clinic.at([0, 0.25, -0.5]), size: [3, 0.5, 0.7], piece: 'cushioned-bench', rotation: clinic.turn(), height: 1 },
  { position: clinic.at([5.5, 0.44, -4.65]), size: [1.7, 0.88, 0.8], piece: 'desk', rotation: clinic.turn(Math.PI) },
  { position: clinic.at([-7.8, 0.25, -3.9]), size: [1.4, 0.5, 2.2], piece: 'bed', rotation: clinic.turn(Math.PI), height: 0.9 },
  // A rack of leaflets by the way in.
  { position: clinic.at([6.5, 0.45, 4.85]), size: [1.6, 0.9, 0.57], piece: 'bookcase-low', rotation: clinic.turn(Math.PI) },
  // Bookshop: the counter, bookcases down both sides and either side of the counter.
  { position: bookshop.at([0, 0.55, -2]), size: [2.6, 1.1, 0.7], piece: 'counter', rotation: bookshop.turn() },
  { position: bookshop.at([-3.9, 1, 0.3]), size: [0.6, 2, 3.6], piece: 'bookcase', rotation: bookshop.turn(Math.PI / 2) },
  { position: bookshop.at([3.9, 1, 0.3]), size: [0.6, 2, 3.6], piece: 'bookcase', rotation: bookshop.turn(-Math.PI / 2) },
  { position: bookshop.at([-2.8, 1, -3.4]), size: [2, 2, 0.6], piece: 'bookcase', rotation: bookshop.turn() },
  { position: bookshop.at([2.8, 1, -3.4]), size: [2, 2, 0.6], piece: 'bookcase', rotation: bookshop.turn() },
  // Bathhouse: the front desk, the two baths, a bench between them, the showers and the lockers.
  { position: bathhouse.at([0, 0.55, 2.2]), size: [3, 1.1, 0.8], piece: 'counter', rotation: bathhouse.turn() },
  { position: bathhouse.at([-3.2, 0.5, -2.8]), size: [3.5, 1, 2.85], piece: 'bath', rotation: bathhouse.turn() },
  { position: bathhouse.at([3.2, 0.5, -2.8]), size: [3.5, 1, 2.85], piece: 'bath', rotation: bathhouse.turn() },
  { position: bathhouse.at([0, 0.25, -0.2]), size: [2, 0.5, 0.6], piece: 'bench', rotation: bathhouse.turn(), height: 1 },
  { position: bathhouse.at([-6, 1.25, 0.1]), size: [1.3, 2.5, 2.7], piece: 'shower', rotation: bathhouse.turn(Math.PI / 2) },
  { position: bathhouse.at([6.3, 1, -0.6]), size: [0.6, 2, 2], piece: 'bookcase', rotation: bathhouse.turn(-Math.PI / 2), repaint: { wood: 'sky' } },
  // Cubbies of rolled towels either side of the way in.
  { position: bathhouse.at([-3.8, 0.45, 4.4]), size: [1.6, 0.9, 0.5], piece: 'cubbies', rotation: bathhouse.turn(Math.PI) },
  { position: bathhouse.at([4.2, 0.45, 4.4]), size: [1.6, 0.9, 0.5], piece: 'cubbies', rotation: bathhouse.turn(Math.PI) },
  // Town office: the counter, the clerks' desks and the filing behind it, and a bench to wait on.
  { position: townOffice.at([0, 0.55, -2]), size: [5, 1.1, 0.8], piece: 'counter', rotation: townOffice.turn() },
  { position: townOffice.at([-4.5, 0.44, -3.9]), size: [1.7, 0.88, 0.9], piece: 'desk', rotation: townOffice.turn() },
  { position: townOffice.at([4.5, 0.44, -3.9]), size: [1.7, 0.88, 0.9], piece: 'desk', rotation: townOffice.turn() },
  { position: townOffice.at([-2, 1, -4.4]), size: [2, 2, 0.6], piece: 'bookcase', rotation: townOffice.turn() },
  { position: townOffice.at([2, 1, -4.4]), size: [2, 2, 0.6], piece: 'bookcase', rotation: townOffice.turn() },
  { position: townOffice.at([-6.1, 0.25, 1]), size: [0.7, 0.5, 3], piece: 'cushioned-bench', rotation: townOffice.turn(Math.PI / 2), height: 1 },
  // Park benches, facing the park regulars who sit by them.
  { position: inPark([-7, 0.25, -1.6]), size: [2, 0.5, 0.6], piece: 'bench', rotation: Math.PI, height: 1 },
  { position: inPark([4, 0.25, 5.4]), size: [2, 0.5, 0.6], piece: 'bench', rotation: Math.PI, height: 1 },
  { position: inPark([-1.9, 0.25, 6]), size: [0.6, 0.5, 2], piece: 'bench', rotation: Math.PI / 2, height: 1 },
  // Home: the sink with its tap, the worktop and the stove along the back wall, the fridge, the bed, the table and the sofa.
  { position: HOME_TAP, size: [1.2, 1, 0.6], piece: 'sink', rotation: home.turn() },
  { position: home.at([1.2, 0.5, -3.85]), size: [1.2, 1, 0.6], piece: 'counter', rotation: home.turn() },
  { position: HOME_STOVE, size: [1.2, 1, 0.6], piece: 'stove', rotation: home.turn() },
  { position: home.at([4, 1.05, -3.7]), size: [1.2, 2.1, 0.9], piece: 'fridge-tall', rotation: home.turn() },
  { position: HOME_BED, size: [1.4, 0.5, 2.2], piece: 'bed', rotation: home.turn(), height: 0.9 },
  { position: home.at([-3.4, 0.375, 0.8]), size: [0.8, 0.75, 1.2], piece: 'table-plain', rotation: home.turn(Math.PI / 2) },
  { position: home.at([3.9, 0.45, 1.4]), size: [0.94, 0.9, 2.2], piece: 'sofa', rotation: home.turn(-Math.PI / 2), height: 1.06, repaint: { red: 'denim' } },
  { position: home.at([4.3, 0.45, -1.4]), size: [0.57, 0.9, 1.6], piece: 'bookcase-low', rotation: home.turn(-Math.PI / 2) },
  // The clinic's ward bed and the bathhouse's running machine.
  { position: WARD_BED, size: [1.4, 0.5, 2.2], piece: 'bed', rotation: clinic.turn(Math.PI), height: 0.9 },
  { position: BATHHOUSE_GYM, size: [1, 1, 2], piece: 'treadmill', rotation: bathhouse.turn(Math.PI), height: 1.4 },
];

type Decor = { position: Vec3; piece: TownPiece; rotation?: number; size?: Size; repaint?: Repaint };

/** Set dressing nobody bumps into: rugs, plants, lamps, chairs and what stands on the furniture, as where each stands, its piece, and how it's turned. */
export const DECOR: readonly Decor[] = [
  // Home.
  { position: home.at([0, 0.02, -1.2]), piece: 'rug', rotation: home.turn() },
  { position: home.at([2.2, 0.02, 1.4]), piece: 'rug-round', rotation: home.turn(), size: [1.8, null, 1.8], repaint: { red: 'mustard', brick: 'wood' } },
  { position: home.at([2.3, 0, 1.4]), piece: 'coffee-table', rotation: home.turn(Math.PI / 2), size: [0.8, 0.45, 1.2] },
  { position: home.at([4.3, 0, 3.7]), piece: 'floor-lamp', rotation: home.turn() },
  { position: home.at([-4.3, 0, 3.7]), piece: 'plant', rotation: home.turn() },
  { position: home.at([-2.6, 0, 0.8]), piece: 'chair', rotation: home.turn(-Math.PI / 2), repaint: { red: 'sky' } },
  { position: home.at([-4.2, 0, 0.8]), piece: 'chair', rotation: home.turn(Math.PI / 2), repaint: { red: 'sky' } },
  { position: home.at([-3.4, 0.75, 0.8]), piece: 'table-lamp', rotation: home.turn() },
  { position: home.at([1.2, 1.5, -4.0]), piece: 'wall-cabinet', rotation: home.turn() },
  { position: home.at([4.3, 0.9, -1.4]), piece: 'books', rotation: home.turn(-Math.PI / 2) },
  { position: home.at([3.5, 0, 3.8]), piece: 'coat-rack', rotation: home.turn() },
  // Café.
  ...cafeTables.flatMap(({ decor }) => decor),
  { position: cafe.at([-4.8, 0, -3.6]), piece: 'fridge', rotation: cafe.turn() },
  { position: cafe.at([-2.2, 1.1, -3.85]), piece: 'coffee-machine', rotation: cafe.turn() },
  { position: cafe.at([-3.2, 1.1, -3.85]), piece: 'coffee-machine', rotation: cafe.turn() },
  { position: cafe.at([-2.6, 1.55, -4.0]), piece: 'wall-cabinet', rotation: cafe.turn() },
  { position: cafe.at([-5.2, 0, 3.7]), piece: 'plant', rotation: cafe.turn() },
  { position: cafe.at([5.2, 0, 3.7]), piece: 'plant', rotation: cafe.turn() },
  { position: cafe.at([5.2, 0, -3.7]), piece: 'floor-lamp', rotation: cafe.turn() },
  { position: cafe.at([-3.9, 0.8, 2]), piece: 'plant-small', rotation: cafe.turn() },
  { position: cafe.at([3.9, 0.8, 2]), piece: 'plant-small', rotation: cafe.turn() },
  // Convenience store.
  { position: convenienceStore.at([2.9, 0, 3.3]), piece: 'boxes', rotation: convenienceStore.turn(0.3) },
  { position: convenienceStore.at([2.4, 0, 3.4]), piece: 'boxes', rotation: convenienceStore.turn(-0.4) },
  { position: convenienceStore.at([-2.9, 0, 3.3]), piece: 'bin', rotation: convenienceStore.turn() },
  ...stock(convenienceStore, 'shelf-goods', [-3.3, -0.6], [-3.3, 1.8], SHELF_LEVELS, Math.PI / 2),
  ...stock(convenienceStore, 'shelf-goods', [3.3, -0.6], [3.3, 1.8], SHELF_LEVELS, -Math.PI / 2),
  ...stock(convenienceStore, 'shelf-goods', [2, -3.3], [3.4, -3.3], [0.05, 0.5], 0),
  // Supermarket.
  { position: supermarket.at([-1.6, 0, 4.4]), piece: 'boxes', rotation: supermarket.turn(0.2) },
  { position: supermarket.at([-2.1, 0, 4.6]), piece: 'boxes', rotation: supermarket.turn(-0.3) },
  { position: supermarket.at([-7.1, 0, -4.6]), piece: 'boxes', rotation: supermarket.turn() },
  { position: supermarket.at([7.2, 0, -1.5]), piece: 'plant', rotation: supermarket.turn() },
  { position: supermarket.at([-4.9, 1.1, 2.6]), piece: 'computer', rotation: supermarket.turn(Math.PI), size: [0.6, 0.45, 0.35] },
  ...stock(supermarket, 'shelf-goods', [-0.9, 1.2], [4.9, 1.2], SHELF_LEVELS, 0, nearGroceries(1.6)),
  ...stock(supermarket, 'shelf-goods', [-0.9, -1.4], [4.9, -1.4], SHELF_LEVELS, 0, nearGroceries(-1.0)),
  ...stock(supermarket, 'shelf-goods', [-7.3, -3.7], [-7.3, -0.3], SHELF_LEVELS, Math.PI / 2),
  // Restaurant.
  ...restaurantTables.flatMap(({ decor }) => decor),
  { position: restaurant.at([5.2, 0, 3.7]), piece: 'plant', rotation: restaurant.turn() },
  { position: restaurant.at([-5.2, 0, -3.7]), piece: 'pot-plant', rotation: restaurant.turn() },
  { position: restaurant.at([5.2, 0, -3.7]), piece: 'coat-rack', rotation: restaurant.turn() },
  // Clinic.
  { position: clinic.at([7.4, 0, -3.8]), piece: 'plant', rotation: clinic.turn() },
  { position: clinic.at([-8.1, 0, 4.4]), piece: 'plant', rotation: clinic.turn() },
  { position: clinic.at([8.1, 0, 4.4]), piece: 'plant', rotation: clinic.turn() },
  { position: clinic.at([3.6, 1.1, 2.8]), piece: 'computer', rotation: clinic.turn(Math.PI), size: [0.6, 0.45, 0.35] },
  { position: clinic.at([5.5, 0.88, -4.65]), piece: 'computer', rotation: clinic.turn(), size: [0.6, 0.45, 0.35] },
  { position: clinic.at([-2.2, 0, -0.5]), piece: 'chair', rotation: clinic.turn(), repaint: { red: 'sky' } },
  { position: clinic.at([2.2, 0, -0.5]), piece: 'chair', rotation: clinic.turn(), repaint: { red: 'sky' } },
  { position: clinic.at([-6.6, 0, -2.6]), piece: 'side-table', rotation: clinic.turn(Math.PI), size: [0.6, 0.6, 0.45] },
  { position: clinic.at([0, 0.02, 1.4]), piece: 'rug', rotation: clinic.turn(), repaint: { red: 'sky' } },
  ...stock(clinic, 'shelf-goods', [-8.2, 0.5], [-8.2, 2.7], SHELF_LEVELS, Math.PI / 2),
  ...[-2.4, -1.5, 1.5, 2.4].map((x): Decor => ({ position: clinic.at([x, 0, 4.75]), piece: 'chair', rotation: clinic.turn(Math.PI), repaint: { red: 'sky' } })),
  { position: clinic.at([6.5, 0.9, 4.85]), piece: 'books', rotation: clinic.turn(Math.PI) },
  { position: clinic.at([-6.6, 0, 4.6]), piece: 'pot-plant', rotation: clinic.turn() },
  // Bookshop.
  { position: bookshop.at([0, 0.02, 0.6]), piece: 'rug-round', rotation: bookshop.turn(), repaint: { red: 'plum', brick: 'lavender' } },
  { position: bookshop.at([-2.7, 0, 2.6]), piece: 'armchair', rotation: bookshop.turn(Math.PI / 2 + 0.4), repaint: { red: 'plum' } },
  { position: bookshop.at([-3.5, 0, 3.4]), piece: 'floor-lamp', rotation: bookshop.turn() },
  { position: bookshop.at([3.3, 0, 3.3]), piece: 'plant', rotation: bookshop.turn() },
  { position: bookshop.at([-2.8, 2, -3.4]), piece: 'books', rotation: bookshop.turn() },
  { position: bookshop.at([2.8, 2, -3.4]), piece: 'books', rotation: bookshop.turn(0.3) },
  ...stock(bookshop, 'shelf-books', [-3.8, -1.4], [-3.8, 2], BOOKCASE_SHELVES, Math.PI / 2),
  ...stock(bookshop, 'shelf-books', [3.8, -1.4], [3.8, 2], BOOKCASE_SHELVES, -Math.PI / 2),
  ...stock(bookshop, 'shelf-books', [-3.7, -3.3], [-1.9, -3.3], BOOKCASE_SHELVES, 0),
  ...stock(bookshop, 'shelf-books', [1.9, -3.3], [3.7, -3.3], BOOKCASE_SHELVES, 0),
  // Bathhouse.
  { position: bathhouse.at([-6, 0, -4.2]), piece: 'plant', rotation: bathhouse.turn() },
  { position: bathhouse.at([6.2, 0, -4.2]), piece: 'pot-plant', rotation: bathhouse.turn() },
  { position: bathhouse.at([-6.45, 1, -2.2]), piece: 'mirror', rotation: bathhouse.turn(Math.PI / 2) },
  { position: bathhouse.at([0, 0.02, 3.4]), piece: 'rug', rotation: bathhouse.turn(), repaint: { red: 'denim' } },
  { position: bathhouse.at([-2.2, 0, 4.2]), piece: 'stool', rotation: bathhouse.turn(), repaint: { red: 'denim' } },
  { position: bathhouse.at([6.2, 0, 4.2]), piece: 'plant', rotation: bathhouse.turn() },
  // Town office.
  { position: townOffice.at([-4.5, 0.88, -3.9]), piece: 'computer', rotation: townOffice.turn(), size: [0.6, 0.45, 0.35] },
  { position: townOffice.at([4.5, 0.88, -3.9]), piece: 'computer', rotation: townOffice.turn(), size: [0.6, 0.45, 0.35] },
  { position: townOffice.at([-4.5, 0, -3]), piece: 'chair', rotation: townOffice.turn(Math.PI), repaint: { red: 'slate' } },
  { position: townOffice.at([4.5, 0, -3]), piece: 'chair', rotation: townOffice.turn(Math.PI), repaint: { red: 'slate' } },
  { position: townOffice.at([-6.2, 0, 4.2]), piece: 'plant', rotation: townOffice.turn() },
  { position: townOffice.at([6.2, 0, 4.2]), piece: 'coat-rack', rotation: townOffice.turn() },
  { position: townOffice.at([6.2, 0, -4.2]), piece: 'floor-lamp', rotation: townOffice.turn() },
  ...stock(townOffice, 'shelf-books', [-2.9, -4.3], [-1.1, -4.3], BOOKCASE_SHELVES, 0),
  ...stock(townOffice, 'shelf-books', [1.1, -4.3], [2.9, -4.3], BOOKCASE_SHELVES, 0),
  { position: townOffice.at([0, 0.02, 2]), piece: 'rug', rotation: townOffice.turn(), repaint: { red: 'slate' } },
];

/** What's solid but drawn otherwise: the tables among their chairs, the bandstand and the pond. */
export const SOLIDS: readonly SolidBox[] = [
  ...[...cafeTables, ...restaurantTables].map(({ solid }) => solid),
  { position: [BANDSTAND[0], 1.5, BANDSTAND[1]], size: [4.4, 3, 4.4] },
  { position: [POND.centre[0], 0.3, POND.centre[1]], size: [POND.radius * 1.7, 0.6, POND.radius * 1.7] },
];

/**
 * Where each Job is worked: its staff door, set in its place's side wall (and where the Character stands to use it);
 * where the Character stands through a Shift, behind the counter beside its staff; and where a Shift Customer stands,
 * across the counter. The café's is level with its counter; the supermarket's, with the customers' side of its till.
 * At the restaurant the staff door is level with the front door; the Character stands at the table by the side wall,
 * and the customer is seated across it, with the rest of their table (`otherSeats`) on either side.
 */
export const WORKPLACES: Record<
  JobId,
  { door: Vec3; doorRotation: number; usedFrom: Vec3; behindTheCounter: Vec3; customerSpot: Vec3; otherSeats?: readonly Vec3[] }
> = {
  barista: {
    door: cafe.at([-5.78, 1.1, -1]),
    doorRotation: cafe.turn(Math.PI / 2),
    usedFrom: cafe.at([-5.3, 1, -1]),
    behindTheCounter: cafe.at([1.5, 1, -3.4]),
    customerSpot: cafe.at([1.5, 1, -1.2]),
  },
  cashier: {
    door: supermarket.at([-7.78, 1.1, 3.4]),
    doorRotation: supermarket.turn(Math.PI / 2),
    usedFrom: supermarket.at([-7.3, 1, 3.4]),
    behindTheCounter: supermarket.at([-3, 1, 1.6]),
    customerSpot: supermarket.at([-3, 1, 3.8]),
  },
  server: {
    door: restaurant.at([-5.78, 1.1, 3]),
    doorRotation: restaurant.turn(Math.PI / 2),
    usedFrom: restaurant.at([-5.3, 1, 3]),
    behindTheCounter: restaurant.at([-1.6, 1, 1]),
    customerSpot: restaurant.at([-4.3, 1, 1]),
    otherSeats: [restaurant.at([-3, 1, -0.05]), restaurant.at([-3, 1, 2.05])],
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

/** Over a building's door, hung just in front of the wall above it. */
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

/** On a building's back wall, inside, at eye height. */
const onTheBackWall = (placeId: PlaceId, x: number): Vec3 => [x, 1.65, -building(placeId).size[1] / 2 + WALL.thickness + 0.02];

/** Where each sign hangs. The park's name stands on two posts at its way in; each tram stop's hangs on its pole. */
export const SIGNS: Record<SignId, SignSpot> = {
  'home-name': nameBoard(building('home')),
  'cafe-name': nameBoard(building('cafe')),
  'supermarket-name': nameBoard(building('supermarket')),
  'convenience-store-name': nameBoard(building('convenience-store')),
  'restaurant-name': nameBoard(building('restaurant')),
  'clinic-name': nameBoard(building('clinic')),
  'park-name': { position: inPark([-3.6, 1.6, -PARK.size[1] / 2 + 0.1]), size: [2, 0.5] },
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
  'cafe-menu': { position: cafe.at(onTheBackWall('cafe', 2.6)), size: [1.7, 1.5], rotation: cafe.turn() },
  // On the back wall, between the two back tables.
  'restaurant-menu': { position: restaurant.at(onTheBackWall('restaurant', -1)), size: [1.7, 1.5], rotation: restaurant.turn() },
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
  home: home.at([0, 1, 0.5]),
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
export const BEFORE_THE_DOCTOR: Vec3 = clinic.at([5.5, 1.5, -3.8 + 1.8]);

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
