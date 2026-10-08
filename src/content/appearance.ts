// The Appearance Preset pool: the parts every look on the shared character rig is made from.
// The Character, Named NPCs and Shift Customers all draw on it.
import { z } from 'zod';

/** The body and face presets: a build and a face. */
export const BODY_IDS = ['body-1', 'body-2', 'body-3', 'body-4'] as const;
export type BodyId = (typeof BODY_IDS)[number];

/** The builds: each a skeleton in its everyday clothes. */
export const BUILDS = ['masculine', 'feminine'] as const;
export type Build = (typeof BUILDS)[number];

/** Each body and face preset: a build and one of the two faces. */
export const BODY_PRESETS: Record<BodyId, { build: Build; face: 'a' | 'b' }> = {
  'body-1': { build: 'masculine', face: 'a' },
  'body-2': { build: 'masculine', face: 'b' },
  'body-3': { build: 'feminine', face: 'b' },
  'body-4': { build: 'feminine', face: 'a' },
};

export const HAIR_STYLE_IDS = ['short', 'long', 'buns', 'buzzed', 'bearded', 'bald'] as const;
export type HairStyleId = (typeof HAIR_STYLE_IDS)[number];

/** Hair colours, as the hair and eyebrows are tinted. */
export const HAIR_COLOURS = {
  black: '#1d1816',
  'dark-brown': '#3a2519',
  brown: '#6e4529',
  auburn: '#8c3a1f',
  blonde: '#d0a457',
  grey: '#a29c95',
} as const;
export type HairColourId = keyof typeof HAIR_COLOURS;
export const HAIR_COLOUR_IDS = Object.keys(HAIR_COLOURS) as [HairColourId, ...HairColourId[]];

/** Skin tones, lightest first, as the skin is tinted. */
export const SKIN_TONES = {
  'tone-1': '#f6d2b8',
  'tone-2': '#e9b48f',
  'tone-3': '#d09a72',
  'tone-4': '#a8704b',
  'tone-5': '#7c4b31',
  'tone-6': '#553222',
} as const;
export type SkinToneId = keyof typeof SKIN_TONES;
export const SKIN_TONE_IDS = Object.keys(SKIN_TONES) as [SkinToneId, ...SkinToneId[]];

export const AppearancePresetSchema = z.object({
  body: z.enum(BODY_IDS),
  hairStyle: z.enum(HAIR_STYLE_IDS),
  hairColour: z.enum(HAIR_COLOUR_IDS),
  skinTone: z.enum(SKIN_TONE_IDS),
});

/** One look on the shared rig: a body and face, hair style and colour, and skin tone. */
export type AppearancePreset = z.infer<typeof AppearancePresetSchema>;

/** The look setup starts from, until the Player chooses. */
export const DEFAULT_APPEARANCE: AppearancePreset = { body: 'body-1', hairStyle: 'short', hairColour: 'dark-brown', skinTone: 'tone-3' };

/** How often each of some parts turns up, by how much it weighs against the others. */
export type Weights<K extends string> = Partial<Record<K, number>>;

/** How often each part of an anonymous look turns up in a pack: the body, a hair style that suits its build, hair colour and skin tone. */
export type CustomerWeights = {
  body: Weights<BodyId>;
  hairStyle: Record<Build, Weights<HairStyleId>>;
  hairColour: Weights<HairColourId>;
  skinTone: Weights<SkinToneId>;
};

/** Weights over `ids` that leave something to draw. */
const weights = <K extends string>(ids: readonly [K, ...K[]]) =>
  z.partialRecord(z.enum(ids), z.number().positive()).refine((drawn) => Object.keys(drawn).length > 0, 'Something must be left to draw.');

export const CustomerWeightsSchema = z.object({
  body: weights(BODY_IDS),
  hairStyle: z.object({ masculine: weights(HAIR_STYLE_IDS), feminine: weights(HAIR_STYLE_IDS) }),
  hairColour: weights(HAIR_COLOUR_IDS),
  skinTone: weights(SKIN_TONE_IDS),
});
