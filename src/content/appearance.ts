// The Appearance Preset pool: what everyone in town wears. Everyone is Clawd, the Claude Code mascot, in the same
// orange; what tells them apart is a hat, eyewear and neckwear, in a colour. The Character, Named NPCs, Shift Customers
// and Passers-by all draw on it.
import { z } from 'zod';

export const HAT_IDS = ['none', 'beanie', 'cap', 'beret', 'top-hat', 'sun-hat', 'bow', 'flower', 'party-hat'] as const;
export type HatId = (typeof HAT_IDS)[number];

/** Glasses with no glass in them, so the eyes, and Patience in them, always show. */
export const EYEWEAR_IDS = ['none', 'round-glasses', 'square-glasses', 'monocle'] as const;
export type EyewearId = (typeof EYEWEAR_IDS)[number];

export const NECKWEAR_IDS = ['none', 'scarf', 'bow-tie', 'tie', 'bandana'] as const;
export type NeckwearId = (typeof NECKWEAR_IDS)[number];

/**
 * The colours what's worn comes in, as the hat, the neckwear and some frames are tinted: each one of the town's
 * palette colours (`src/world/palette.ts`), which `tooling/characterArt.test.ts` holds them to.
 */
export const ACCESSORY_COLOURS = {
  denim: '#5b7fae',
  sky: '#bcd6ea',
  teal: '#4f8f84',
  pine: '#4f8a5b',
  leaf: '#86b86c',
  mustard: '#d4ac44',
  red: '#d9554a',
  blush: '#efbcbf',
  plum: '#7b5f99',
  cream: '#f6efe2',
  charcoal: '#4d5260',
} as const;
export type AccessoryColourId = keyof typeof ACCESSORY_COLOURS;
export const ACCESSORY_COLOUR_IDS = Object.keys(ACCESSORY_COLOURS) as [AccessoryColourId, ...AccessoryColourId[]];

export const AppearancePresetSchema = z.object({
  hat: z.enum(HAT_IDS),
  eyewear: z.enum(EYEWEAR_IDS),
  neckwear: z.enum(NECKWEAR_IDS),
  colour: z.enum(ACCESSORY_COLOUR_IDS),
});

/** One look on Clawd: a hat, eyewear and neckwear (any of them none), and the colour they come in. */
export type AppearancePreset = z.infer<typeof AppearancePresetSchema>;

/** The look setup starts from, until the Player chooses: Clawd as the mascot is, wearing nothing. */
export const DEFAULT_APPEARANCE: AppearancePreset = { hat: 'none', eyewear: 'none', neckwear: 'none', colour: 'denim' };

/** The builds an NPC Voice suits. Clawd's shape is the same for both: only the voice tells. */
export const BUILDS = ['masculine', 'feminine'] as const;
export type Build = (typeof BUILDS)[number];

export const NpcLookSchema = AppearancePresetSchema.extend({ build: z.enum(BUILDS) });

/** An NPC's look: their Appearance Preset, and the build their NPC Voice suits. */
export type NpcLook = z.infer<typeof NpcLookSchema>;

/** How often each of some parts turns up, by how much it weighs against the others. */
export type Weights<K extends string> = Partial<Record<K, number>>;

/** How often each part of an anonymous look turns up in a pack: the build their voice suits, what they wear and its colour. */
export type CustomerWeights = {
  build: Weights<Build>;
  hat: Weights<HatId>;
  eyewear: Weights<EyewearId>;
  neckwear: Weights<NeckwearId>;
  colour: Weights<AccessoryColourId>;
};

/** Weights over `ids` that leave something to draw. */
const weights = <K extends string>(ids: readonly [K, ...K[]]) =>
  z.partialRecord(z.enum(ids), z.number().positive()).refine((drawn) => Object.keys(drawn).length > 0, 'Something must be left to draw.');

export const CustomerWeightsSchema = z.object({
  build: weights(BUILDS),
  hat: weights(HAT_IDS),
  eyewear: weights(EYEWEAR_IDS),
  neckwear: weights(NECKWEAR_IDS),
  colour: weights(ACCESSORY_COLOUR_IDS),
});
