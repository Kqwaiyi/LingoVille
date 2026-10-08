// What the game expects of the shared character art in `public/characters/`, built by `npm run build:characters`.
// The build script and `tooling/characterArt.test.ts` hold the art to these names.
import { BODY_IDS, BODY_PRESETS, HAIR_STYLE_IDS, type AppearancePreset, type HairStyleId } from '../content/index.ts';

export const CHARACTER_ART_URLS = { characters: '/characters/characters.glb', animations: '/characters/animations.glb' } as const;

/** The clips in the shared animation library. */
export const CHARACTER_CLIPS = ['idle', 'walk', 'jog', 'talk', 'sit', 'interact'] as const;
export type CharacterClip = (typeof CHARACTER_CLIPS)[number];

/** The bones the game moves or hangs things on (an expression's head turn, a role's apron), in every build. */
export const CHARACTER_BONES = ['Head', 'pelvis', 'spine_03'] as const;
export const HEAD_BONE = 'Head' satisfies CharacterBone;
export type CharacterBone = (typeof CHARACTER_BONES)[number];

/** The hair parts each style shows. A part ending in `-` is cut to fit each face, and takes the face's letter. */
const HAIR: Record<HairStyleId, string[]> = {
  short: ['hair-parted'],
  long: ['hair-long'],
  buns: ['hair-buns'],
  buzzed: ['hair-buzzed-'],
  bearded: ['hair-parted', 'beard'],
  bald: [],
};

/** Parts that only some looks show. Everything else (the outfit) every look of a build wears. */
export const OPTIONAL_PART = /^(head|brows|eyes|hair|beard)/;

/** The optional parts a look shows: its face, and its hair cut to fit that face. */
export function partsOf({ body, hairStyle }: Pick<AppearancePreset, 'body' | 'hairStyle'>) {
  const { face } = BODY_PRESETS[body];
  return new Set([`head-${face}`, `brows-${face}`, `eyes-${face}`, ...HAIR[hairStyle].map((part) => (part.endsWith('-') ? part + face : part))]);
}

/** Every build, each with every optional part any of its looks can show: what the art must hold. */
export function partsByBuild() {
  const parts = new Map<string, Set<string>>();
  for (const body of BODY_IDS) {
    const { build } = BODY_PRESETS[body];
    const set = parts.get(build) ?? new Set<string>();
    for (const hairStyle of HAIR_STYLE_IDS) for (const part of partsOf({ body, hairStyle })) set.add(part);
    parts.set(build, set);
  }
  return parts;
}
