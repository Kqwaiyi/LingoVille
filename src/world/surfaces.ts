// What the town is made of. Every material in the town art is a palette colour (`palette.ts`) and a surface, named
// `colour:surface` (just `colour` is matte): the colour is the paint, which a building can swap for its own, and the
// surface is how it's made, which stays. The game draws each surface with its own roughness and shine and, for most,
// a detail texture (`public/town/surfaces/<surface>.png`, built by `npm run build:surfaces`) projected from the world on
// three sides, so it needs no texture coordinates and keeps its size however a piece is stretched.
import { PALETTE, type PaletteColour } from './palette.ts';

export const SURFACES = [
  'matte',
  'plaster',
  'brick',
  'stone',
  'tile',
  'roofing',
  'paint',
  'wood',
  'planks',
  'metal',
  'brass',
  'ceramic',
  'fabric',
  'foliage',
  'bark',
  'grass',
  'asphalt',
  'cobbles',
  'paving',
  'gravel',
] as const;
export type Surface = (typeof SURFACES)[number];

/**
 * How a surface looks under the light. `roughness` (0 mirror to 1 chalk) and `metalness` as physically based materials
 * take them; `texture`, its detail texture: how many metres one repeat of it covers, and how strongly it shades the
 * colour (`albedo`) and bumps the surface (`normal`). `macro` mottles the colour across metres so repeats don't show;
 * `grime` darkens the foot of a wall where rain splashes it. `fade` is how far sun and weather have chalked the colour
 * towards a warm grey as light as it is (0 not at all, 1 all the way): limewash and old paint are never as bright as
 * the pot they came from.
 */
export type SurfaceLook = {
  roughness: number;
  metalness: number;
  texture?: { metres: number; albedo: number; normal: number };
  macro: number;
  grime: number;
  fade: number;
};

const look = (roughness: number, extra: Partial<SurfaceLook> = {}): SurfaceLook => ({ roughness, metalness: 0, macro: 0.04, grime: 0, fade: 0, ...extra });

export const SURFACE_LOOKS: Record<Surface, SurfaceLook> = {
  matte: look(0.85, { macro: 0 }),
  plaster: look(0.92, { texture: { metres: 2, albedo: 1, normal: 0.7 }, macro: 0.06, grime: 0.22, fade: 0.38 }),
  brick: look(0.88, { texture: { metres: 1, albedo: 1, normal: 1 }, macro: 0.06, grime: 0.2, fade: 0.15 }),
  stone: look(0.8, { texture: { metres: 2, albedo: 1, normal: 0.8 }, macro: 0.06, grime: 0.18 }),
  tile: look(0.72, { texture: { metres: 2, albedo: 1, normal: 1 }, macro: 0.1, fade: 0.25 }),
  roofing: look(0.95, { texture: { metres: 2, albedo: 1, normal: 0.8 }, macro: 0.08 }),
  paint: look(0.5, { macro: 0.015, fade: 0.12 }),
  wood: look(0.55, { texture: { metres: 1, albedo: 1, normal: 0.4 }, macro: 0.03 }),
  planks: look(0.45, { texture: { metres: 2, albedo: 1, normal: 0.6 }, macro: 0.04 }),
  metal: look(0.42, { metalness: 0.55, macro: 0.02, fade: 0.1 }),
  brass: look(0.3, { metalness: 1, macro: 0 }),
  ceramic: look(0.35, { macro: 0.03 }),
  fabric: look(0.97, { texture: { metres: 0.5, albedo: 1, normal: 0.5 }, macro: 0.02, fade: 0.15 }),
  foliage: look(0.75, { texture: { metres: 1.6, albedo: 0.85, normal: 0.75 }, macro: 0.12, fade: 0.08 }),
  bark: look(0.9, { texture: { metres: 1, albedo: 1, normal: 1 }, macro: 0.05 }),
  grass: look(0.95, { texture: { metres: 4, albedo: 1, normal: 0.6 }, macro: 0.16, fade: 0.14 }),
  asphalt: look(0.85, { texture: { metres: 2, albedo: 1, normal: 0.6 }, macro: 0.08 }),
  cobbles: look(0.78, { texture: { metres: 2, albedo: 1, normal: 1 }, macro: 0.08 }),
  paving: look(0.82, { texture: { metres: 2.4, albedo: 1, normal: 0.8 }, macro: 0.06 }),
  gravel: look(0.95, { texture: { metres: 1, albedo: 1, normal: 0.9 }, macro: 0.08 }),
};

/** The surfaces that have a detail texture. */
export const TEXTURED_SURFACES = SURFACES.filter((surface) => SURFACE_LOOKS[surface].texture);

export const surfaceTextureUrl = (surface: Surface) => `/town/surfaces/${surface}.png`;

/** A town material's name: its colour, and its surface unless that's matte. */
export const materialName = (colour: PaletteColour, surface: Surface = 'matte'): PaletteColour | `${PaletteColour}:${Surface}` => (surface === 'matte' ? colour : `${colour}:${surface}`);

/** A town material's colour and surface, by its name; `null` for a name that isn't one. */
export function parseMaterialName(name: string): { colour: PaletteColour; surface: Surface } | null {
  const [colour = '', surface = 'matte', ...rest] = name.split(':');
  if (rest.length || !(colour in PALETTE) || !(SURFACES as readonly string[]).includes(surface)) return null;
  return { colour: colour as PaletteColour, surface: surface as Surface };
}
