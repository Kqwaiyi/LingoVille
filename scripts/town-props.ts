/**
 * The Culture Packs' props for `scripts/build-town.ts`: each of `PROP_IDS` (`src/content/culturePacks.ts`) put together
 * from CC0 kit models, mostly Kenney's Food Kit (food, dishes, pots and packaging) and Fantasy Town Kit (stools,
 * benches, pointed roofs), with the furniture and building kits the town already uses. No kit has a lucky cat, a noren
 * or a vending machine, so those are assembled from parts too, in the palette's colours (`paint`).
 *
 * Each prop stands where the world sets it out (`src/world/setDressing.ts`), its front facing +z: on a counter top, a
 * table top or a floor, its base at y = 0. A door's prop stands at the foot of the door, outside, against the wall
 * (which is 0.05 m behind it): what hangs over the door is up in the prop, the door's top at 2.1 m, its frame 1.24 m
 * either side. A grocery stands on its shelf, a display about 1.2 m wide and 0.3 m deep.
 */
import type { PropId } from '../src/content/index.ts';
import type { PaletteColour } from '../src/world/palette.ts';
import type { Part, Vec3 } from './build-town.ts';

type Extra = Omit<Part, 'kit' | 'model'>;

/** Food Kit models are made big for their size; this brings most of them to life size. */
const FOOD = 0.35;
/** Kenney's furniture and nature kits are modelled small (as `build-town.ts` brings them to life size). */
const FURNITURE = 2.3;
const NATURE = 2.6;

const food = (model: string, extra: Extra = {}): Part => ({ kit: 'food-kit', model, scale: FOOD, ...extra });
const furniture = (model: string, extra: Extra = {}): Part => ({ kit: 'furniture-kit', model, scale: FURNITURE, ...extra });
const fantasy = (model: string, extra: Extra = {}): Part => ({ kit: 'fantasy-town-kit', model, ...extra });
const nature = (model: string, extra: Extra = {}): Part => ({ kit: 'nature-kit', model, scale: NATURE, ...extra });
/** A box of one colour, `size` in metres, made from a building kit floor tile: cloth, card, a label, a plank or a pole. */
const slab = (size: Vec3, at: Vec3, paint: PaletteColour): Part => ({ kit: 'building-kit', model: 'floor', fit: size, at, paint });
/** A round body of one colour, `size` in metres, made from a Food Kit tin: a post box, a column, a lantern's base. */
const drum = (size: Vec3, at: Vec3, paint: PaletteColour): Part => food('can', { scale: undefined, fit: size, at, paint });
/** A coin lying flat, a plate flattened to a disc. */
const coin = (at: Vec3, paint: PaletteColour, size = 0.026): Part => food('plate', { scale: undefined, fit: [size, 0.004, size], at, paint });
/** A banknote lying flat. */
const note = (at: Vec3, paint: PaletteColour): Part => food('plate-rectangle', { scale: undefined, fit: [0.15, 0.004, 0.075], at, paint });
/** `count` copies of a part across `width`, centred, at height `y` and depth `z`. */
const row = (count: number, width: number, make: (at: Vec3, i: number) => Part, y = 0, z = 0): Part[] =>
  Array.from({ length: count }, (_, i) => make([count === 1 ? 0 : -width / 2 + (i * width) / (count - 1), y, z], i));
/** Both sides of a door: a part mirrored either side, `x` out from the middle. */
const bothSides = (x: number, make: (side: -1 | 1) => Part): Part[] => [make(-1), make(1)].map((part, i) => ({ ...part, at: [i === 0 ? -x : x, part.at![1], part.at![2]] }));

/** A small table beside a bed, with something on it. */
const bedside = (onTop: Part): Part[] => [furniture('sideTable', { scale: undefined, fit: [0.45, 0.5, 0.4] }), { ...onTop, at: [0, 0.5, 0] }];
/** An open crate, in a colour, with `contents` across its top. */
const crate = (size: Vec3, paint: PaletteColour, contents: Part[]): Part[] => [furniture('cardboardBoxOpen', { scale: undefined, fit: size, paint }), ...contents];

export const PROP_PARTS: Record<PropId, Part[]> = {
  // Money at the till. Japan: a tray for the customer's money; China: a QR code to scan; the UK: a contactless card
  // reader; Germany: a little dish for change.
  'cash-tray': [
    food('plate-rectangle', { scale: undefined, fit: [0.22, 0.025, 0.15], paint: 'denim' }),
    coin([-0.05, 0.02, -0.02], 'mustard'),
    coin([0.0, 0.02, 0.03], 'stone'),
    coin([0.05, 0.02, -0.03], 'terracotta'),
    note([0.0, 0.02, -0.03], 'linen'),
  ],
  'qr-stand': [
    slab([0.12, 0.02, 0.06], [0, 0, 0], 'charcoal'),
    slab([0.12, 0.17, 0.012], [0, 0.02, 0], 'white'),
    slab([0.08, 0.08, 0.004], [0, 0.07, 0.007], 'ink'),
    slab([0.1, 0.02, 0.004], [0, 0.16, 0.007], 'teal'),
  ],
  'card-reader': [
    furniture('computerMouse', { scale: undefined, fit: [0.08, 0.03, 0.15], paint: 'charcoal' }),
    slab([0.06, 0.035, 0.004], [0, 0.03, -0.03], 'sky'),
  ],
  'coin-dish': [
    food('plate', { scale: undefined, fit: [0.15, 0.02, 0.15], paint: 'white' }),
    coin([-0.03, 0.015, 0.01], 'mustard', 0.024),
    coin([0.02, 0.015, -0.02], 'stone', 0.024),
    coin([0.025, 0.015, 0.03], 'terracotta', 0.02),
  ],

  // At the door.
  noren: [slab([1.9, 0.04, 0.04], [0, 2.08, 0.04], 'walnut'), ...row(3, 1.22, (at) => slab([0.58, 0.62, 0.015], at, 'denim'), 1.46, 0.04)],
  'red-lantern': [
    // Spring couplets either side of the door and across its top, and a lantern hung either side.
    ...bothSides(1.41, () => slab([0.3, 1.5, 0.01], [0, 0.45, -0.045], 'red')),
    slab([1.5, 0.24, 0.01], [0, 2.12, -0.045], 'red'),
    ...bothSides(1.41, () => food('pumpkin-basic', { scale: undefined, fit: [0.34, 0.38, 0.34], at: [0, 1.62, 0.3], paint: 'red' })),
    ...bothSides(1.41, () => food('can-small', { scale: undefined, fit: [0.18, 0.04, 0.18], at: [0, 2.0, 0.3], paint: 'mustard' })),
    ...bothSides(1.41, () => food('can-small', { scale: undefined, fit: [0.16, 0.04, 0.16], at: [0, 1.6, 0.3], paint: 'mustard' })),
    ...bothSides(1.41, () => slab([0.03, 0.18, 0.03], [0, 1.42, 0.3], 'mustard')),
    ...bothSides(1.41, () => slab([0.03, 0.03, 0.34], [0, 2.18, 0.15], 'ink')),
  ],
  bunting: [
    slab([3.8, 0.015, 0.015], [0, 2.3, 0.06], 'ink'),
    ...row(11, 3.6, (at, i) => fantasy('roof-point', { fit: [0.2, 0.24, 0.015], flip: true, at, paint: (['red', 'white', 'denim'] as const)[i % 3] }), 2.06, 0.06),
  ],
  'flower-box': bothSides(1.8, () => fantasy('planks', { fit: [0.9, 0.24, 0.28], at: [0, 0, 0.15], paint: 'walnut' })).concat(
    ...[-1, 1].map((side) =>
      row(3, 0.56, (at, i) => nature((['flower_redA', 'flower_redA', 'flower_yellowA'] as const)[i]!, { scale: 1.5, at: [side * 1.8 + at[0], 0.22, 0.15] })),
    ),
  ),

  // On a counter.
  'lucky-cat': [
    food('egg', { scale: undefined, fit: [0.12, 0.13, 0.1], paint: 'white' }),
    food('can-small', { scale: undefined, fit: [0.09, 0.015, 0.08], at: [0, 0.1, 0], paint: 'red' }),
    food('apple', { scale: undefined, fit: [0.12, 0.1, 0.1], at: [0, 0.1, 0], paint: 'white' }),
    ...bothSides(0.035, () => fantasy('roof-point', { fit: [0.035, 0.04, 0.02], at: [0, 0.19, 0], paint: 'white' })),
    slab([0.025, 0.08, 0.025], [0.065, 0.11, 0.02], 'white'),
    coin([0, 0.06, 0.05], 'mustard', 0.05),
  ],
  'tea-set': [
    food('plate-rectangle', { scale: undefined, fit: [0.36, 0.02, 0.24], paint: 'walnut' }),
    food('coconut', { scale: undefined, fit: [0.12, 0.09, 0.12], at: [-0.07, 0.015, 0], paint: 'terracotta' }),
    food('can-small', { scale: undefined, fit: [0.03, 0.02, 0.03], at: [-0.07, 0.1, 0], paint: 'terracotta' }),
    slab([0.08, 0.018, 0.018], [0.0, 0.07, 0], 'terracotta'),
    ...[[0.07, -0.05], [0.11, 0.03], [0.05, 0.07]].map(([x, z]) => food('bowl', { scale: undefined, fit: [0.05, 0.03, 0.05], at: [x!, 0.015, z!], paint: 'white' })),
  ],
  'cake-stand': [
    food('plate', { scale: undefined, fit: [0.14, 0.015, 0.14], paint: 'white' }),
    drum([0.03, 0.12, 0.03], [0, 0.01, 0], 'white'),
    food('plate', { scale: undefined, fit: [0.3, 0.02, 0.3], at: [0, 0.12, 0], paint: 'white' }),
    food('cake', { at: [0, 0.135, 0] }),
  ],
  'bread-basket': [
    food('bowl', { scale: undefined, fit: [0.4, 0.09, 0.28], paint: 'wood' }),
    food('loaf-baguette', { at: [0, 0.04, -0.05] }),
    food('loaf-round', { scale: 0.22, at: [-0.08, 0.04, 0.05] }),
    food('croissant', { scale: 0.4, at: [0.1, 0.05, 0.05] }),
  ],
  onigiri: [food('plate-rectangle', { scale: undefined, fit: [0.34, 0.025, 0.2], paint: 'white' }), ...row(4, 0.24, (at) => food('rice-ball', { scale: 0.75, at }), 0.02)],
  'tea-eggs': [food('pot-stew', { scale: 0.4 }), ...row(3, 0.12, (at) => food('egg', { at, paint: 'walnut' }), 0, 0.15)],
  'sausage-rolls': [
    food('plate-rectangle', { scale: undefined, fit: [0.36, 0.025, 0.22], paint: 'slate' }),
    ...row(4, 0.24, (at) => food('loaf-baguette', { scale: 0.18, turns: 1, at }), 0.02),
  ],
  bockwurst: [
    food('pot', { scale: 0.38, at: [-0.06, 0, 0] }),
    food('plate', { scale: undefined, fit: [0.16, 0.015, 0.16], at: [0.14, 0, 0.04], paint: 'white' }),
    ...row(2, 0.05, (at) => food('sausage', { turns: 1, at: [0.14 + at[0], 0.01, 0.04] })),
    food('bottle-musterd', { at: [0.17, 0, -0.08] }),
  ],
  'medicine-boxes': [
    furniture('cardboardBoxClosed', { scale: undefined, fit: [0.14, 0.07, 0.09], at: [-0.1, 0, 0], paint: 'white' }),
    furniture('cardboardBoxClosed', { scale: undefined, fit: [0.12, 0.06, 0.08], at: [-0.1, 0.07, 0], paint: 'sky' }),
    furniture('cardboardBoxClosed', { scale: undefined, fit: [0.1, 0.12, 0.06], at: [0.04, 0, 0], paint: 'blush' }),
    food('bag', { scale: undefined, fit: [0.1, 0.16, 0.06], at: [0.15, 0, 0.02], paint: 'white' }),
  ],
  'book-stack': [furniture('books', { at: [-0.12, 0, 0] }), furniture('books', { turns: 1, at: [0.15, 0, 0] })],
  paperwork: [
    food('plate-rectangle', { scale: undefined, fit: [0.3, 0.035, 0.22], paint: 'white' }),
    slab([0.15, 0.012, 0.012], [0.02, 0.035, 0.06], 'ink'),
    food('cup', { scale: undefined, fit: [0.07, 0.1, 0.07], at: [0.22, 0, 0], paint: 'denim' }),
  ],
  'towel-stack': [0, 1, 2].map((i) => furniture('pillowLong', { scale: undefined, fit: [0.34, 0.06, 0.22], at: [0, i * 0.06, 0], paint: i === 1 ? 'sky' : 'white' })),
  nabe: [food('pot-stew', { scale: 0.45 })],
  steamer: [food('pot', { scale: 0.4 }), food('steamer', { scale: 0.38, at: [0, 0.13, 0] })],
  'fry-up': [food('frying-pan', { scale: 0.4 }), food('egg-cooked', { scale: 0.25, at: [-0.03, 0.03, 0.02] }), ...row(2, 0.05, (at) => food('bacon', { scale: 0.3, at: [0.06 + at[0], 0.03, 0] }))],
  'sausage-pan': [food('pan', { scale: 0.4 }), ...row(3, 0.1, (at) => food('sausage', { at: [at[0], 0.03, 0.02] }))],

  // On a table: a meal, set before the seat facing the door.
  teishoku: [
    food('plate-rectangle', { scale: undefined, fit: [0.42, 0.025, 0.3], paint: 'walnut' }),
    food('bowl', { scale: undefined, fit: [0.11, 0.06, 0.11], at: [-0.11, 0.02, 0.07], paint: 'white' }),
    food('bowl-soup', { scale: undefined, fit: [0.11, 0.06, 0.11], at: [0.11, 0.02, 0.07], paint: 'brick' }),
    food('plate-rectangle', { scale: undefined, fit: [0.2, 0.02, 0.1], at: [0, 0.02, -0.07], paint: 'white' }),
    food('sushi-salmon', { scale: 0.9, turns: 1, at: [0, 0.035, -0.07] }),
    food('chopstick', { scale: 0.45, turns: 1, at: [0, 0.02, 0.135] }),
  ],
  'dim-sum': [
    food('steamer', { scale: undefined, fit: [0.2, 0.08, 0.2], at: [-0.07, 0, 0] }),
    ...row(3, 0.1, (at) => food('dim-sum', { at: [-0.07 + at[0], 0.08, 0] })),
    food('cup-tea', { at: [0.13, 0, 0.04] }),
    food('soy', { at: [0.13, 0, -0.08] }),
  ],
  'fish-and-chips': [
    food('plate', { scale: undefined, fit: [0.3, 0.025, 0.3], paint: 'white' }),
    food('meat-cooked', { scale: undefined, fit: [0.18, 0.035, 0.09], at: [-0.03, 0.02, -0.04], paint: 'mustard' }),
    ...row(5, 0.1, (at, i) => food('celery-stick', { scale: undefined, fit: [0.015, 0.015, 0.08], at: [0.03 + at[0], 0.02 + (i % 2) * 0.012, 0.06], paint: 'butter' })),
    food('lemon-half', { scale: 0.3, at: [0.1, 0.02, -0.06] }),
    food('bottle-oil', { scale: 0.3, at: [0.2, 0, -0.1] }),
  ],
  sauerkraut: [food('plate-sauerkraut'), food('glass', { scale: undefined, fit: [0.08, 0.16, 0.08], at: [0.2, 0, -0.08], paint: 'mustard' })],

  // On a floor.
  'mikan-crate': [
    ...crate([0.5, 0.25, 0.36], 'wood', row(4, 0.3, (at) => food('orange', { scale: 0.45, at }, ), 0.2, -0.06)),
    ...row(4, 0.3, (at) => food('orange', { scale: 0.45, at }), 0.2, 0.08),
  ],
  'rice-sacks': [
    food('bag', { scale: undefined, fit: [0.36, 0.45, 0.24], at: [-0.2, 0, 0], paint: 'linen' }),
    food('bag', { scale: undefined, fit: [0.36, 0.45, 0.24], at: [0.2, 0, 0.05], paint: 'linen' }),
    slab([0.16, 0.12, 0.004], [-0.2, 0.18, 0.125], 'red'),
    slab([0.16, 0.12, 0.004], [0.2, 0.18, 0.175], 'red'),
  ],
  'flower-buckets': row(3, 0.6, (at) => food('can', { scale: undefined, fit: [0.26, 0.3, 0.26], at, paint: 'slate' })).concat(
    row(3, 0.6, (at, i) => nature((['flower_redA', 'flower_yellowA', 'flower_purpleA'] as const)[i]!, { scale: 1.8, at }), 0.28),
  ),
  'drinks-crates': [
    ...crate([0.4, 0.28, 0.3], 'denim', []),
    furniture('cardboardBoxOpen', { scale: undefined, fit: [0.4, 0.28, 0.3], at: [0.42, 0, 0], paint: 'denim' }),
    furniture('cardboardBoxOpen', { scale: undefined, fit: [0.4, 0.28, 0.3], at: [0.21, 0.28, 0], paint: 'mustard' }),
    ...row(3, 0.24, (at) => food('soda-bottle', { scale: 0.3, at: [0.21 + at[0], 0.36, 0] })),
  ],
  bonsai: [furniture('sideTable', { scale: undefined, fit: [0.5, 0.35, 0.35], paint: 'walnut' }), furniture('plantSmall2', { at: [0, 0.35, 0] })],
  'water-dispenser': [
    furniture('kitchenFridgeSmall', { scale: undefined, fit: [0.36, 0.9, 0.36], paint: 'white' }),
    food('soda-bottle', { scale: undefined, fit: [0.24, 0.42, 0.24], at: [0, 0.9, 0], paint: 'sky' }),
    slab([0.06, 0.04, 0.02], [-0.07, 0.62, 0.19], 'red'),
    slab([0.06, 0.04, 0.02], [0.07, 0.62, 0.19], 'denim'),
  ],
  'magazine-table': [furniture('tableCoffeeSquare', { scale: undefined, fit: [0.6, 0.4, 0.6] }), furniture('books', { at: [0, 0.4, 0] })],
  'coat-stand': [furniture('coatRackStanding')],
  'wash-buckets': [
    ...row(2, 0.3, (at) => food('barrel', { scale: undefined, fit: [0.26, 0.17, 0.26], at, paint: 'wood' })),
    food('barrel', { scale: undefined, fit: [0.26, 0.17, 0.26], at: [0, 0.17, 0], paint: 'wood' }),
    fantasy('stall-stool', { scale: 1.6, at: [0.45, 0, 0.1], paint: 'wood' }),
  ],
  'foot-basins': [...row(2, 0.5, (at) => food('tajine', { scale: undefined, fit: [0.42, 0.15, 0.42], at, paint: 'wood' })), fantasy('stall-stool', { scale: 1.6, at: [0, 0, -0.4], paint: 'wood' })],
  'sauna-bucket': [
    fantasy('stall-bench', { turns: 1, scale: 1.6, paint: 'wood' }),
    food('barrel', { scale: undefined, fit: [0.28, 0.24, 0.28], at: [0.6, 0, 0.1], paint: 'wood' }),
    food('cooking-spoon', { scale: 0.6, turns: 1, at: [0.6, 0.24, 0.1], paint: 'walnut' }),
  ],
  andon: [furniture('lampSquareFloor', { scale: undefined, fit: [0.32, 0.7, 0.32] })],
  'lucky-bamboo': bedside(furniture('plantSmall3')),
  radio: bedside(furniture('radio', { scale: 1 })),
  teddy: bedside(furniture('bear', { scale: 0.7 })),

  // On the park's lawn.
  'hanami-mat': [
    furniture('rugSquare', { scale: undefined, fit: [2, 0.01, 2], paint: 'denim' }),
    ...row(2, 0.4, (at) => food('plate-rectangle', { scale: undefined, fit: [0.3, 0.07, 0.22], at, paint: 'ink' }), 0.01, -0.2),
    ...row(3, 0.2, (at) => food('rice-ball', { scale: 0.75, at }), 0.01, 0.25),
    ...row(2, 0.6, (at) => food('soda-can', { scale: 0.35, at }), 0.01, 0.5),
  ],
  'stone-lantern': [
    food('can-small', { scale: undefined, fit: [0.5, 0.12, 0.5], paint: 'stone' }),
    drum([0.2, 0.55, 0.2], [0, 0.12, 0], 'stone'),
    food('can-small', { scale: undefined, fit: [0.4, 0.08, 0.4], at: [0, 0.67, 0], paint: 'stone' }),
    furniture('cardboardBoxClosed', { scale: undefined, fit: [0.3, 0.26, 0.3], at: [0, 0.75, 0], paint: 'slate' }),
    slab([0.12, 0.12, 0.01], [0, 0.82, 0.155], 'lamplight'),
    fantasy('roof-point', { fit: [0.62, 0.22, 0.62], at: [0, 1.01, 0], paint: 'stone' }),
    food('onion', { scale: undefined, fit: [0.1, 0.1, 0.1], at: [0, 1.2, 0], paint: 'stone' }),
  ],
  'xiangqi-table': [
    drum([0.25, 0.7, 0.25], [0, 0, 0], 'stone'),
    food('plate', { scale: undefined, fit: [0.8, 0.06, 0.8], at: [0, 0.7, 0], paint: 'stone' }),
    food('cutting-board', { scale: undefined, fit: [0.42, 0.015, 0.46], at: [0, 0.76, 0], paint: 'wood' }),
    ...[[-0.1, -0.1, 'red'], [0.05, -0.15, 'red'], [0.12, 0.08, 'ink'], [-0.06, 0.14, 'ink'], [0.0, 0.0, 'red']].map(([x, z, colour]) =>
      coin([x as number, 0.775, z as number], colour as PaletteColour, 0.04),
    ),
    ...bothSides(0.75, () => food('can', { scale: undefined, fit: [0.3, 0.42, 0.3], at: [0, 0, 0], paint: 'stone' })),
  ],
  'picnic-blanket': [
    furniture('rugSquare', { scale: undefined, fit: [1.6, 0.01, 1.4], paint: 'red' }),
    ...row(3, 1.2, (at) => slab([0.08, 0.004, 1.4], at, 'cream'), 0.01),
    furniture('cardboardBoxClosed', { scale: undefined, fit: [0.42, 0.26, 0.3], at: [-0.4, 0.01, -0.3], paint: 'wood' }),
    ...row(2, 0.3, (at) => food('sandwich', { at }), 0.01, 0.2),
    ...row(2, 0.5, (at) => food('cup-tea', { at }), 0.01, -0.35),
  ],
  'beer-bench': [
    slab([1.8, 0.04, 0.6], [0, 0.72, 0], 'wood'),
    ...bothSides(0.7, () => slab([0.05, 0.72, 0.5], [0, 0, 0], 'walnut')),
    ...[-1, 1].flatMap((side) => [slab([1.8, 0.04, 0.26], [0, 0.42, side * 0.62], 'wood'), ...bothSides(0.7, () => slab([0.05, 0.42, 0.22], [0, 0, side * 0.62], 'walnut'))]),
    ...row(2, 0.8, (at) => food('glass', { scale: undefined, fit: [0.09, 0.18, 0.09], at, paint: 'mustard' }), 0.74),
  ],

  // On a tram platform: what stands at a stop in each country.
  'vending-machine': [
    furniture('kitchenFridgeLarge', { scale: undefined, fit: [0.7, 1.75, 0.6], paint: 'white' }),
    slab([0.6, 0.62, 0.02], [0, 0.95, 0.3], 'sky'),
    ...row(5, 0.44, (at, i) => food('soda-can', { scale: undefined, fit: [0.06, 0.12, 0.06], at, paint: (['red', 'mustard', 'leaf', 'denim', 'peach'] as const)[i] }), 1.2, 0.33),
    ...row(5, 0.44, (at, i) => food('soda-can', { scale: undefined, fit: [0.06, 0.12, 0.06], at, paint: (['teal', 'red', 'butter', 'brick', 'leaf'] as const)[i] }), 1.0, 0.33),
    slab([0.5, 0.1, 0.02], [0, 0.22, 0.3], 'charcoal'),
  ],
  'sorting-bins': row(2, 0.4, (at, i) => furniture('trashcan', { scale: undefined, fit: [0.34, 0.8, 0.34], at: [0, 0, at[0]], paint: i === 0 ? 'leaf' : 'slate' })),
  'post-box': [
    drum([0.42, 1.2, 0.42], [0, 0, 0], 'red'),
    food('pot-lid', { scale: undefined, fit: [0.5, 0.12, 0.5], at: [0, 1.2, 0], paint: 'red' }),
    slab([0.24, 0.04, 0.02], [0, 1.0, 0.21], 'ink'),
    drum([0.5, 0.06, 0.5], [0, 0, 0], 'ink'),
  ],
  'litfass-column': [
    drum([0.72, 0.15, 0.72], [0, 0, 0], 'pine'),
    drum([0.64, 2.1, 0.64], [0, 0.15, 0], 'linen'),
    ...[[0, 1.3, 'mustard'], [0.0, 0.6, 'blush'], [0, 1.95, 'sky']].map(([x, y, colour]) => slab([0.42, 0.5, 0.02], [x as number, y as number, 0.33], colour as PaletteColour)),
    fantasy('roof-point', { fit: [0.8, 0.35, 0.8], at: [0, 2.25, 0], paint: 'pine' }),
  ],

  // Groceries on their shelf.
  cabbages: row(5, 0.96, (at) => food('cabbage', { scale: 0.5, at })),
  'bok-choy': row(6, 1.0, (at) => food('leek', { scale: 0.38, at })),
  carrots: crate([1.1, 0.08, 0.26], 'wood', row(7, 0.96, (at) => food('carrot', { scale: 0.32, at }), 0.02)),
  potatoes: crate([1.1, 0.08, 0.26], 'wood', [...row(6, 0.96, (at) => food('onion', { scale: 0.48, at, paint: 'sand' }), 0.03, -0.05), ...row(5, 0.86, (at) => food('onion', { scale: 0.48, at, paint: 'sand' }), 0.03, 0.06)]),
  eggs: [-0.4, 0, 0.4].flatMap((x) => [
    furniture('cardboardBoxOpen', { scale: undefined, fit: [0.3, 0.05, 0.13], at: [x, 0, 0], paint: 'sand' }),
    ...[-0.03, 0.03].flatMap((z) => row(3, 0.18, (at) => food('egg', { at: [x + at[0], 0.02, z] }))),
  ]),
  udon: row(5, 1.0, (at) => food('bag-flat', { scale: undefined, fit: [0.2, 0.06, 0.15], at, paint: 'white' })).concat(
    row(5, 1.0, (at) => slab([0.08, 0.04, 0.005], [at[0], 0.01, 0.077], 'denim')),
  ),
  'dried-noodles': row(5, 1.0, (at, i) => food('bag-flat', { scale: undefined, fit: [0.2, 0.05, 0.14], at, paint: i % 2 ? 'mustard' : 'red' })),
  spaghetti: row(8, 1.0, (at) => furniture('cardboardBoxClosed', { scale: undefined, fit: [0.08, 0.26, 0.06], at, paint: 'denim' })),
  spaetzle: row(6, 1.0, (at) => food('bag', { scale: undefined, fit: [0.14, 0.2, 0.08], at, paint: 'mustard' })),
};
