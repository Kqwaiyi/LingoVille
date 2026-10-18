// What the game expects of the character art in `public/characters/clawd.glb`: Clawd, the Claude Code mascot, modelled,
// rigged and animated in Blender. These are the names the game asks the art for.
import { EYEWEAR_IDS, HAT_IDS, NECKWEAR_IDS, type AppearancePreset } from '../content/index.ts';

export const CHARACTER_ART_URL = '/characters/clawd.glb';

/** The figure the art holds: Clawd on its rig, the scene's one root. */
export const FIGURE = 'clawd';

/** The clips in the art. */
export const CHARACTER_CLIPS = ['idle', 'walk', 'talk'] as const;
export type CharacterClip = (typeof CHARACTER_CLIPS)[number];

/** The bone an expression's tilt and nod turn: the body, which is all of Clawd but the arms and legs. */
export const BODY_BONE = 'body';
/** The bones the game moves itself. */
export const CHARACTER_BONES = [BODY_BONE] as const;

/** The eyes, and the shape keys the game eases them between: a blink, and an expression's (relaxed is the eyes as they are). */
export const EYES = 'eyes';
export const EYE_SHAPES = ['blink', 'puzzled', 'strained'] as const;
export type EyeShape = (typeof EYE_SHAPES)[number];

/** What staff wear, tinted in their role's colour. */
export const APRON = 'apron';
/** A drop of sweat, shown while someone is strained. */
export const SWEAT = 'sweat';

/** The material what's worn is drawn in, tinted with the look's colour; the apron's is tinted with the role's. */
export const ACCENT_MATERIAL = 'accent';
export const APRON_MATERIAL = 'apron';

/** Parts only some figures show: what's worn, the apron and the sweat. Everything else (Clawd) every figure shows. */
export const OPTIONAL_PART = /^(hat|eyewear|neckwear)-|^(apron|sweat)$/;

/** The parts a look wears, each named for its kind and what it is: `hat-beret`, `eyewear-monocle`, `neckwear-scarf`. */
export function partsOf({ hat, eyewear, neckwear }: Pick<AppearancePreset, 'hat' | 'eyewear' | 'neckwear'>): Set<string> {
  return new Set([`hat-${hat}`, `eyewear-${eyewear}`, `neckwear-${neckwear}`].filter((part) => !part.endsWith('-none')));
}

/** Every optional part the art must hold: whatever any look can wear, the apron and the sweat. */
export function optionalParts(): Set<string> {
  return new Set([
    ...HAT_IDS.map((hat) => `hat-${hat}`),
    ...EYEWEAR_IDS.map((eyewear) => `eyewear-${eyewear}`),
    ...NECKWEAR_IDS.map((neckwear) => `neckwear-${neckwear}`),
    APRON,
    SWEAT,
  ].filter((part) => !part.endsWith('-none')));
}
