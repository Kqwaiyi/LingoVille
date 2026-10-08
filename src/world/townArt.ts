// What the game expects of the shared town art in `public/town/`, built by `npm run build:town`.
// The build script and `tooling/townArt.test.ts` hold the art to these names.
import type { PaletteColour } from './palette.ts';

export const TOWN_ART_URL = '/town/town.glb';

/**
 * The kit pieces the town is built from, each a node of `town.glb`: in metres, standing on the ground (y = 0) and
 * centred on its footprint, its front facing +z. Wall pieces run along x, 2 m long and 2.4 m high.
 */
export const TOWN_PIECES = [
  // The buildings: walls, doors, floors and roofs, the same in every Culture Pack.
  'wall',
  'wall-window',
  'wall-doorway',
  'door',
  'floor',
  'roof-gable',
  'roof-gable-end',
  'roof-flat',
  'roof-edge',
  // The street and the tram stops.
  'road',
  'rail',
  'street-light',
  'stop-pole',
  'shelter-post',
  'shelter-roof',
  // The park.
  'tree-round',
  'tree-oak',
  'tree-tall',
  'bush',
  'flowers-red',
  'flowers-yellow',
  'flowers-purple',
  'bench',
  // Furniture.
  'counter',
  'shelf',
  'bookcase',
  'table',
  'bed',
  'sink',
  'stove',
  'fridge',
  'cushioned-bench',
  'plant',
  'rug',
  'treadmill',
] as const;
export type TownPiece = (typeof TOWN_PIECES)[number];

/** The glass in a window, lit while its place is open. Every other material is named for its palette colour. */
export const WINDOW_GLASS = 'window';
export type TownMaterial = PaletteColour | typeof WINDOW_GLASS;

/** The colour the kit's walls come in, which each building repaints with its own façade colour. */
export const KIT_FACADE: PaletteColour = 'lavender';
/** The colour the kit's roofs come in, which each building repaints with its own roof colour. */
export const KIT_ROOF: PaletteColour = 'charcoal';
