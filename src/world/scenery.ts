import type { PaletteColour } from './palette.ts';
import { NORTH_FRONT, onStreet, SOUTH_FRONT, STREET, TOWN_BOUNDS, TRAM_STOPS, type Building, type Vec2, type Vec3 } from './town.ts';
import type { Repaint, TownPiece } from './townArt.ts';

// What only dresses the town: the buildings nobody goes into, the high street's furniture, Old Town's square, the
// Market Street stalls, the gardens, the canal and the backdrop. None of it is a place, and nothing in it moves the
// game; it's the same in every Culture Pack. The places themselves are in `town.ts`.

/** A building nobody goes into: walls and windows like the town's own, its door shut, and its floors above lifting off like a roof. */
export type Filler = Pick<Building, 'centre' | 'size' | 'facing' | 'facade' | 'roof' | 'storeys' | 'awnings' | 'windowBoxes'>;

const filler = (x: number, side: 'north' | 'south', size: Vec2, rest: Omit<Filler, 'centre' | 'size' | 'facing'>): Filler => ({ ...onStreet(x, side, size), ...rest });
const gable = (colour: PaletteColour) => ({ shape: 'gable', colour }) as const;
const flat = (colour: PaletteColour) => ({ shape: 'flat', colour }) as const;

/** The buildings between the places, along both sides of the high street, and two set back facing Old Town's square and the market. */
export const FILLERS: readonly Filler[] = [
  // North side, west to east.
  filler(-84, 'north', [10, 9], { facade: 'peach', roof: gable('brick'), storeys: 3, windowBoxes: true }),
  filler(-72.5, 'north', [9, 9], { facade: 'mint', roof: gable('terracotta'), storeys: 2, awnings: 'denim' }),
  filler(-34, 'north', [8, 9], { facade: 'butter', roof: gable('brick'), storeys: 3, windowBoxes: true }),
  filler(-20, 'north', [10, 9], { facade: 'blush', roof: flat('slate'), storeys: 2, awnings: 'red' }),
  filler(23.5, 'north', [5, 8], { facade: 'lavender', roof: gable('plum'), storeys: 3, windowBoxes: true }),
  filler(64, 'north', [8, 9], { facade: 'sky', roof: gable('denim'), storeys: 2, awnings: 'teal' }),
  filler(74, 'north', [10, 10], { facade: 'linen', roof: flat('slate'), storeys: 3, windowBoxes: true }),
  filler(85.5, 'north', [9, 9], { facade: 'peach', roof: gable('terracotta'), storeys: 2, awnings: 'mustard' }),
  // South side, west to east.
  filler(-82, 'south', [10, 9], { facade: 'sky', roof: gable('denim'), storeys: 2 }),
  filler(-70, 'south', [9, 9], { facade: 'blush', roof: gable('brick'), storeys: 3, windowBoxes: true }),
  filler(-26, 'south', [8, 9], { facade: 'butter', roof: gable('terracotta'), storeys: 2, awnings: 'teal' }),
  filler(-18, 'south', [6, 9], { facade: 'mint', roof: gable('pine'), storeys: 3, windowBoxes: true }),
  filler(18.5, 'south', [7, 9], { facade: 'lavender', roof: gable('plum'), storeys: 2, awnings: 'mustard' }),
  filler(25.5, 'south', [5, 9], { facade: 'peach', roof: gable('brick'), storeys: 3, windowBoxes: true }),
  filler(70, 'south', [10, 9], { facade: 'linen', roof: flat('slate'), storeys: 2, awnings: 'red' }),
  filler(82, 'south', [10, 9], { facade: 'butter', roof: gable('brick'), storeys: 3, windowBoxes: true }),
  // Set back, across Old Town's square and behind the market's stalls.
  { centre: [-57, 33], size: [12, 6], facing: -1, facade: 'linen', roof: gable('slate'), storeys: 3, windowBoxes: true },
  { centre: [54, 31], size: [16, 9], facing: -1, facade: 'terracotta', roof: gable('brick'), storeys: 2, awnings: 'mustard' },
];

/** Old Town's square, across the street from the town office: paving, a fountain in the middle and the town clock by the street. */
export const OLD_TOWN_SQUARE = { centre: [-57, 23.5] as Vec2, size: [14, 16] as Vec2, fountain: [-57, 23] as Vec2, clock: [-51.8, 17.2] as Vec2 } as const;
/** Market Street's forecourt, between the bathhouse and the market hall: paving and a row of stalls. */
export const MARKET = { centre: [54.5, 21] as Vec2, size: [21, 11] as Vec2 } as const;

/** Where the canal runs, south of the park and the promenade along it, and how deep its water lies below the banks. */
export const CANAL = { z: [40, 48], promenade: [TOWN_BOUNDS.z[1] - 3.1, TOWN_BOUNDS.z[1]], waterBelow: 0.5 } as const;

/** One piece standing somewhere: where, which way it faces, how it's sized and repainted, and whether it's solid (a box this size, standing on the ground). */
export type Prop = { piece: TownPiece; at: Vec3; rotation?: number; size?: readonly [number | null, number | null, number | null]; repaint?: Repaint; solid?: Vec3; lit?: boolean };

const along = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
/** On the north pavement, this far out from the front walls; and on the south. */
const north = (x: number, out: number): Vec3 => [x, 0, NORTH_FRONT + out];
const south = (x: number, out: number): Vec3 => [x, 0, SOUTH_FRONT - out];
const FACING_SOUTH = 0;
const FACING_NORTH = Math.PI;

/** A small seeded random number generator, so the scattered backdrop is the same every time. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const BENCH: Vec3 = [2, 0.5, 0.6];
const PLANTER: Vec3 = [1.4, 0.5, 0.55];
const TRUNK: Vec3 = [0.35, 2, 0.35];
const TREE_KINDS = ['tree-round', 'tree-oak', 'tree-small', 'tree-fat'] as const;

/** The high street's furniture: benches facing the street, planters, bicycles leaning by the doors, bins, and trees down the south pavement. */
export const STREET_PROPS: readonly Prop[] = [
  ...[-66.5, -36.5, 27.5, 45.5, 60.5, 80].map((x): Prop => ({ piece: 'bench', at: north(x, 1.1), rotation: FACING_SOUTH, solid: BENCH })),
  ...[-78, -30.5, -16.5, 21, 66.5].map((x): Prop => ({ piece: 'bench', at: south(x, 1.1), rotation: FACING_NORTH, solid: BENCH })),
  ...[-77.5, -50.2, -24.2, 6.4, 26.8, 44.7, 59.6, 68.6, 90].map((x): Prop => ({ piece: 'planter', at: north(x, 0.45), solid: PLANTER })),
  ...[-75, -64.8, -48.6, -31.4, -14.6, 14.6, 28.6, 43.4, 64.6, 76.5].map((x): Prop => ({ piece: 'planter', at: south(x, 0.45), rotation: FACING_NORTH, solid: PLANTER })),
  ...([
    [-67.5, 'denim'],
    [-28.6, 'red'],
    [26.6, 'mustard'],
    [46, 'plum'],
    [61.6, 'pine'],
  ] as const).map(([x, colour]): Prop => ({ piece: 'bicycle', at: north(x, 0.45), rotation: 0.08, repaint: { denim: colour } })),
  ...([
    [-29.5, 'brick'],
    [22.6, 'denim'],
    [67.8, 'teal'],
  ] as const).map(([x, colour]): Prop => ({ piece: 'bicycle', at: south(x, 0.45), rotation: Math.PI - 0.08, repaint: { denim: colour } })),
  ...[-65, -35.2, 28.9, 61.8, 79].map((x): Prop => ({ piece: 'bin', at: north(x, 1.1), solid: [0.5, 1, 0.5] })),
  ...[-79.6, -32, 19.4, 65].map((x): Prop => ({ piece: 'bin', at: south(x, 1.1), solid: [0.5, 1, 0.5] })),
  ...[-73, -62, -27, -18, 17, 52, 70, 80.5].map((x, i): Prop => ({ piece: TREE_KINDS[i % TREE_KINDS.length]!, at: south(x, 1.6), rotation: i, solid: TRUNK })),
];

/** The café's terrace on the pavement: parasol tables at either end of its front, clear of the view in from the door. */
export const CAFE_TERRACE: readonly Vec2[] = [
  [9.2, NORTH_FRONT + 1.6],
  [18.8, NORTH_FRONT + 1.6],
];

/** The tram line's poles, between the tracks, clear of the platforms and the walk off their ends. */
export const CATENARY_POLES: readonly number[] = along(-90, 90, 18)
  .map((x) => (Object.values(TRAM_STOPS).some(({ centre: [stop] }) => Math.abs(x - stop) < 9) ? x + 10 : x))
  .filter((x) => Math.abs(x) <= 95);

/** Old Town's square: its fountain, the clock, benches round the fountain, trees at the corners and pennants on posts across it. */
export const SQUARE_PROPS: readonly Prop[] = (() => {
  const [fx, fz] = OLD_TOWN_SQUARE.fountain;
  const [cx, cz] = OLD_TOWN_SQUARE.centre;
  const [w, d] = OLD_TOWN_SQUARE.size;
  return [
    { piece: 'fountain', at: [fx, 0, fz], solid: [4.6, 1, 4.6] },
    { piece: 'street-clock', at: [OLD_TOWN_SQUARE.clock[0], 0, OLD_TOWN_SQUARE.clock[1]], rotation: Math.PI / 2, solid: [0.6, 4, 0.6] },
    ...([
      [-4.4, 0, Math.PI / 2],
      [4.4, 0, -Math.PI / 2],
      [0, 4.4, Math.PI],
    ] as const).map(([dx, dz, rotation]): Prop => ({ piece: 'bench', at: [fx + dx, 0, fz + dz], rotation, solid: Math.abs(dx) > 0 ? [0.6, 0.5, 2] : BENCH })),
    ...[-1, 1].flatMap((sx) => [1, -1].map((sz, i): Prop => ({ piece: i === 0 ? 'tree-cone' : 'tree-oak', at: [cx + sx * (w / 2 - 3), 0, cz + sz * (d / 2 - 3.2)], rotation: sx + sz, solid: TRUNK }))),
    ...[-1, 1].map((sx): Prop => ({ piece: 'flowers-red', at: [fx + sx * 2.8, 0, fz - 3.4] })),
    ...[-1, 1].map((sx): Prop => ({ piece: 'flowers-yellow', at: [fx + sx * 3.2, 0, fz + 3] })),
  ];
})();

/** Market Street's stalls along the forecourt, a cart, and barrels and crates beside them. */
export const MARKET_PROPS: readonly Prop[] = [
  ...([
    [47, 'red'],
    [51, 'teal'],
    [55, 'mustard'],
    [59, 'denim'],
  ] as const).map(([x, colour]): Prop => ({ piece: 'market-stall', at: [x, 0, SOUTH_FRONT + 4], rotation: FACING_NORTH, repaint: { red: colour }, solid: [2.2, 2, 2] })),
  { piece: 'cart', at: [62.6, 0, SOUTH_FRONT + 3.6], rotation: FACING_NORTH + 0.4, solid: [1.6, 1, 2.4] },
  { piece: 'boxes', at: [49, 0, SOUTH_FRONT + 5.6], rotation: 0.3 },
  { piece: 'boxes', at: [57, 0, SOUTH_FRONT + 5.4], rotation: -0.4 },
  { piece: 'pot-plant', at: [45.2, 0, SOUTH_FRONT + 7.5] },
  { piece: 'pot-plant', at: [63.8, 0, SOUTH_FRONT + 7.5] },
];

/** Strings of pennants, from post to post (each post `PENNANT_POST` tall): over Old Town's square and the market. */
export const PENNANT_POST = 4.4;
export const PENNANTS: readonly [from: Vec2, to: Vec2][] = (() => {
  const corners = ({ centre: [cx, cz], size: [w, d] }: { centre: Vec2; size: Vec2 }): Vec2[] => [
    [cx - w / 2 + 0.6, cz - d / 2 + 1.2],
    [cx + w / 2 - 0.6, cz - d / 2 + 1.2],
    [cx + w / 2 - 0.6, cz + d / 2 - 0.6],
    [cx - w / 2 + 0.6, cz + d / 2 - 0.6],
  ];
  const [a, b, c, e] = corners(OLD_TOWN_SQUARE);
  const [p, q, r, s] = corners(MARKET);
  return [
    [a!, c!],
    [b!, e!],
    [a!, b!],
    [p!, q!],
    [s!, r!],
    [p!, r!],
    [q!, s!],
  ];
})();

/** The back gardens behind the north side's buildings: trees and bushes, a shed's worth of boxes, and the fence along the back. */
export const GARDEN_PROPS: readonly Prop[] = (() => {
  const random = seeded(7);
  const props: Prop[] = [];
  for (let x = -92; x <= 92; x += 7 + random() * 5) {
    const z = TOWN_BOUNDS.z[0] + 1.5 + random() * 3;
    const piece = random() < 0.55 ? TREE_KINDS[Math.floor(random() * TREE_KINDS.length)]! : random() < 0.5 ? 'bush-large' : 'bush';
    props.push({ piece, at: [x, 0, z], rotation: random() * 6, solid: piece.startsWith('tree') ? TRUNK : undefined });
  }
  // Behind the south side: the gardens between the clinic, the bathhouse and the canal.
  for (const x of [-46, -38, -30, -22, 22, 30, 38, 66, 74, 86]) props.push({ piece: TREE_KINDS[Math.abs(x) % 4]!, at: [x, 0, CANAL.promenade[0] - 3 - random() * 2], rotation: random() * 6, solid: TRUNK });
  return props;
})();

/**
 * Along the canal: benches looking over the water, lamps and planters on the promenade; and behind the south side's
 * buildings, a hedge along the promenade with flower beds and bushes in the gardens behind it.
 */
export const CANAL_SIDE_PROPS: readonly Prop[] = (() => {
  const random = seeded(53);
  const [p0] = CANAL.promenade;
  const props: Prop[] = [];
  for (let x = -90; x <= 90; x += 12) {
    props.push({ piece: 'bench', at: [x, 0, p0 + 0.7], rotation: 0, solid: BENCH });
    props.push({ piece: 'planter', at: [x + 6, 0, p0 + 0.5], solid: PLANTER });
  }
  // Behind the buildings on the south side, but not behind the park or the buildings set back there.
  const open = (x: number) => Math.abs(x) > 15 && !(x > -64 && x < -50) && !(x > 45 && x < 63);
  for (let x = -94; x <= 94; x += 2) {
    if (open(x) && open(x + 1)) props.push({ piece: 'hedge', at: [x + 1, 0, p0 - 0.6], solid: [2, 1.2, 0.8] });
  }
  const flowers = ['flowers-red', 'flowers-yellow', 'flowers-purple'] as const;
  for (let x = -92; x <= 92; x += 2.6 + random() * 2) {
    if (!open(x)) continue;
    const z = p0 - 2.2 - random() * 5;
    props.push(random() < 0.6 ? { piece: flowers[Math.floor(random() * 3)]!, at: [x, 0, z], rotation: random() * 6 } : { piece: random() < 0.5 ? 'bush' : 'bush-large', at: [x, 0, z], rotation: random() * 6 });
  }
  return props;
})();

/** Lamps along the promenade, reaching out over the walk. */
export const PROMENADE_LIGHTS: readonly Vec2[] = along(-84, 84, 24).map((x): Vec2 => [x + 3, CANAL.promenade[0] + 0.3]);

/** The fence along the back gardens and the railing along the canal, as runs of fence pieces: solid, so the Character stays in town. */
export const FENCES: readonly { from: Vec2; to: Vec2; piece: TownPiece; repaint?: Repaint }[] = [
  { from: [TOWN_BOUNDS.x[0], TOWN_BOUNDS.z[0]], to: [TOWN_BOUNDS.x[1], TOWN_BOUNDS.z[0]], piece: 'fence', repaint: { wood: 'white', red: 'white' } },
  { from: [TOWN_BOUNDS.x[0], TOWN_BOUNDS.z[1]], to: [TOWN_BOUNDS.x[1], TOWN_BOUNDS.z[1]], piece: 'fence', repaint: { wood: 'charcoal', red: 'charcoal' } },
];

/** Hedges across each end of town, from the back gardens to the canal, leaving the tracks clear for the trams. */
export const TOWN_ENDS: readonly number[] = [TOWN_BOUNDS.x[0], TOWN_BOUNDS.x[1]];

/** Rowing boats moored along both banks of the canal. */
export const BOATS: readonly Prop[] = [-78, -51, -33, -8, 9, 27, 48, 71, 88].map((x, i): Prop => ({
  piece: 'boat',
  at: [x, -CANAL.waterBelow + 0.05, i % 2 === 0 ? CANAL.z[0] + 1.2 : CANAL.z[1] - 1.2],
  rotation: (i % 2 === 0 ? 0 : Math.PI) + (i % 3) * 0.06,
  repaint: { red: (['red', 'denim', 'teal', 'mustard'] as const)[i % 4] },
}));

/**
 * The backdrop: rows of townhouses behind the back gardens, along the street beyond each end of town and across the
 * canal; cottages and pine woods up on the hills to the north and over the far bank; the hills, and mountains far off.
 */
export const BACKDROP: readonly Prop[] = (() => {
  const random = seeded(31);
  const facades: PaletteColour[] = ['peach', 'butter', 'mint', 'sky', 'lavender', 'blush', 'linen', 'white', 'cream'];
  const roofs: PaletteColour[] = ['brick', 'terracotta', 'slate', 'denim', 'plum'];
  const house = (piece: 'townhouse' | 'cottage', at: Vec3, rotation: number): Prop => ({
    piece,
    at,
    rotation,
    repaint: { lavender: facades[Math.floor(random() * facades.length)]!, charcoal: roofs[Math.floor(random() * roofs.length)]! },
    lit: random() < 0.6,
  });
  const props: Prop[] = [];
  // Behind the back gardens, facing the town; and across the canal, facing it.
  for (let x = -150; x <= 150; ) {
    const roll = random();
    const z = TOWN_BOUNDS.z[0] - 6.5 - random() * 1.5;
    if (roll < 0.6) props.push(house('townhouse', [x + 2.8, 0, z], 0));
    else if (roll < 0.85) props.push(house('cottage', [x + 3.3, 0, z + 0.5], 0));
    else props.push({ piece: TREE_KINDS[Math.floor(random() * TREE_KINDS.length)]!, at: [x + 2.5, 0, z + 1], rotation: random() * 6 });
    x += roll < 0.6 ? 5.8 + random() * 0.6 : roll < 0.85 ? 7 + random() : 5 + random() * 2;
  }
  for (let x = -150; x <= 150; x += 6 + random() * 2.5) props.push(house(random() < 0.5 ? 'townhouse' : 'cottage', [x, 0, CANAL.z[1] + 6.5], Math.PI));
  // Along the street beyond each end of town, facing it.
  for (const side of [-1, 1]) {
    for (let x = 100; x <= 190; x += 6 + random() * 2) {
      props.push(house('townhouse', [side * x, 0, NORTH_FRONT - 3.4], 0));
      props.push(house('townhouse', [side * x, 0, SOUTH_FRONT + 3.4], Math.PI));
    }
  }
  // Cottages and pines up on the hillsides.
  for (let i = 0; i < 70; i++) {
    const x = -180 + random() * 360;
    const z = TOWN_BOUNDS.z[0] - 16 - random() * 28;
    props.push(random() < 0.35 ? house('cottage', [x, 0, z], (random() - 0.5) * 0.25) : { piece: random() < 0.6 ? 'tree-pine' : 'tree-cone', at: [x, 0, z], rotation: random() * 6, size: [null, 3 + random() * 3, null] });
  }
  for (let i = 0; i < 50; i++) {
    const x = -180 + random() * 360;
    const z = CANAL.z[1] + 14 + random() * 32;
    props.push(random() < 0.3 ? house('cottage', [x, 0, z], Math.PI + (random() - 0.5) * 0.25) : { piece: random() < 0.5 ? 'tree-pine' : 'tree-fat', at: [x, 0, z], rotation: random() * 6 });
  }
  // The hills, behind the houses, and the mountains far off, north and south.
  for (let x = -260; x <= 260; x += 55) {
    props.push({ piece: 'hill', at: [x + random() * 15, 0, -95 - random() * 20], size: [70 + random() * 30, 16 + random() * 12, 45], rotation: (random() - 0.5) * 0.3 });
    props.push({ piece: 'hill', at: [x + 25 + random() * 15, 0, 125 + random() * 20], size: [70 + random() * 30, 12 + random() * 10, 45], rotation: Math.PI + (random() - 0.5) * 0.3 });
  }
  for (const x of [-280, -140, 0, 140, 280]) {
    props.push({ piece: 'mountain', at: [x + random() * 40, 0, -210], size: [180, 55 + random() * 25, 100], rotation: (random() - 0.5) * 0.4 });
    props.push({ piece: 'mountain', at: [x + 70 + random() * 40, 0, 240], size: [180, 45 + random() * 20, 100], rotation: Math.PI });
  }
  return props;
})();

/** The trams that come and go along the line while it runs: how fast, how long each waits at a platform, and how far past either end of town they run. */
export const TRAMS = { speed: 9, dwell: 8, reach: 200, gap: 40 } as const;
/** The two tracks: westbound on the north side, eastbound on the south. */
export const TRACKS = { westbound: STREET.z - STREET.track, eastbound: STREET.z + STREET.track } as const;
