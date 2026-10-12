/**
 * What the kit pieces are made of, for `scripts/build-town.ts`. The town's own Blender pieces name their surfaces
 * themselves (`colour:surface`); Kenney's kits only have colours, so here each piece says which of its colours is
 * which surface (`src/world/surfaces.ts`), as do the town's older pieces that came before surfaces. A colour a piece
 * doesn't name stays matte.
 */
import type { PaletteColour } from '../src/world/palette.ts';
import type { Surface } from '../src/world/surfaces.ts';
import type { ArtPiece } from '../src/world/townArt.ts';

type Surfaces = Partial<Record<PaletteColour, Surface>>;

const WOODWORK: Surfaces = { wood: 'wood', walnut: 'wood', sand: 'wood', terracotta: 'wood' };
const UPHOLSTERED: Surfaces = {
  ...WOODWORK,
  denim: 'fabric',
  red: 'fabric',
  teal: 'fabric',
  plum: 'fabric',
  mustard: 'fabric',
  sky: 'fabric',
  blush: 'fabric',
  lavender: 'fabric',
  mint: 'fabric',
  peach: 'fabric',
  butter: 'fabric',
  linen: 'fabric',
  cream: 'fabric',
  white: 'fabric',
  stone: 'fabric',
  slate: 'fabric',
  charcoal: 'metal',
};
const KITCHEN: Surfaces = { white: 'ceramic', cream: 'ceramic', linen: 'ceramic', slate: 'metal', stone: 'metal', charcoal: 'metal', ink: 'metal', ...WOODWORK };
const PLANTED: Surfaces = { leaf: 'foliage', pine: 'foliage', grass: 'foliage', mint: 'foliage', teal: 'foliage', wood: 'bark', walnut: 'bark' };
const IRONWORK: Surfaces = { slate: 'metal', stone: 'metal', charcoal: 'metal', ink: 'metal', pine: 'metal', denim: 'metal', white: 'paint' };

export const PIECE_SURFACES: Partial<Record<ArtPiece, Surfaces>> = {
  // The street and the tram stops.
  tram: { white: 'paint', butter: 'paint', red: 'paint', denim: 'paint', teal: 'paint', mustard: 'paint', slate: 'metal', charcoal: 'metal', ink: 'metal', stone: 'metal' },
  fountain: { stone: 'stone', slate: 'stone', white: 'stone', cream: 'stone', linen: 'stone' },
  'market-stall': { ...WOODWORK, red: 'fabric', white: 'fabric', cream: 'fabric' },
  cart: WOODWORK,
  bin: { pine: 'paint', ink: 'metal', charcoal: 'metal' },
  fence: WOODWORK,
  'catenary-pole': IRONWORK,

  // Trees, rocks and plants.
  'grass-tuft': PLANTED,
  lily: PLANTED,
  'pot-plant': { ...PLANTED, terracotta: 'ceramic', brick: 'ceramic', stone: 'ceramic' },
  'plant-small': { ...PLANTED, terracotta: 'ceramic', white: 'ceramic', stone: 'ceramic' },
  'flowers-red': PLANTED,
  'flowers-yellow': PLANTED,
  'flowers-purple': PLANTED,
  rock: { stone: 'stone', slate: 'stone', leaf: 'foliage' },
  hill: { grass: 'grass', leaf: 'foliage', pine: 'foliage', slate: 'stone', white: 'stone' },
  mountain: { grass: 'grass', leaf: 'foliage', pine: 'foliage', slate: 'stone', white: 'stone' },
  planter: { ...WOODWORK, leaf: 'foliage' },
  'window-box': { ...WOODWORK, leaf: 'foliage' },

  // The town's own pieces that came before surfaces.
  awning: { red: 'fabric', white: 'fabric', stone: 'metal' },
  parasol: { red: 'fabric', white: 'fabric', charcoal: 'metal' },
  bicycle: { denim: 'paint', ink: 'metal', stone: 'metal', wood: 'wood', walnut: 'wood' },
  'street-clock': { charcoal: 'metal', pine: 'paint', mustard: 'brass', white: 'ceramic', ink: 'metal' },
  gazebo: { stone: 'stone', wood: 'planks', white: 'paint', red: 'tile', mustard: 'brass' },
  bath: { ...WOODWORK, stone: 'stone', leaf: 'wood' },
  boat: { white: 'paint', red: 'paint', wood: 'wood', walnut: 'wood' },
  cottage: { lavender: 'plaster', cream: 'paint', charcoal: 'tile', brick: 'brick', walnut: 'wood' },
  townhouse: { lavender: 'plaster', cream: 'paint', charcoal: 'tile', brick: 'brick', walnut: 'wood' },
  'wall-lantern': { ink: 'metal' },
  cubbies: { ...WOODWORK, white: 'fabric', sky: 'fabric', blush: 'fabric', mint: 'fabric', butter: 'fabric' },

  // The rooms.
  'fridge-tall': KITCHEN,
  washer: KITCHEN,
  'coffee-machine': KITCHEN,
  shower: KITCHEN,
  basin: KITCHEN,
  mirror: { ...KITCHEN, sky: 'brass' },
  shelf: WOODWORK,
  bookcase: WOODWORK,
  'bookcase-low': WOODWORK,
  'side-table': WOODWORK,
  desk: WOODWORK,
  'coat-rack': WOODWORK,
  stool: { ...WOODWORK, slate: 'metal', charcoal: 'metal', stone: 'metal' },
  'cushioned-bench': UPHOLSTERED,
  'ceiling-lamp': { charcoal: 'metal', slate: 'metal' },
  tv: { ...WOODWORK, charcoal: 'paint', ink: 'paint', slate: 'metal' },
  computer: { charcoal: 'paint', ink: 'paint', slate: 'metal' },
  boxes: { wood: 'fabric', sand: 'fabric', walnut: 'fabric' },
  treadmill: { charcoal: 'fabric', ink: 'fabric', slate: 'metal', white: 'paint' },
};

/** How sharp an angle between two faces shows as an edge, in degrees; flatter than this, they're shaded as one curve. */
export const SMOOTH_ANGLE = 40;
/** Rounder pieces, shaded smoother still: leaves, the hills. */
export const SMOOTHER: Partial<Record<ArtPiece, number>> = Object.fromEntries(
  (['tree-round', 'tree-oak', 'tree-tall', 'tree-pine', 'tree-fat', 'tree-cone', 'tree-small', 'bush', 'bush-large', 'hedge', 'hill', 'mountain', 'rock'] as const).map((piece) => [piece, 65]),
);
