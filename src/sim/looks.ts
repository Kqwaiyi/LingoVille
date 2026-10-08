import type { AppearancePreset, BodyId, HairColourId, HairStyleId, SkinToneId, Weights } from '../content/index.ts';
import { nextRandom, seedRng } from './rng.ts';

/** A pack's weights for anonymous looks: the body, a hair style weighed for each body (as its build wears it), hair colour and skin tone. */
export type LookWeights = {
  body: Weights<BodyId>;
  hairStyle: Record<BodyId, Weights<HairStyleId>>;
  hairColour: Weights<HairColourId>;
  skinTone: Weights<SkinToneId>;
};

/** One of the weighed parts, drawn from the RNG as often as its weight says. */
function drawWeighed<K extends string>(rngState: number, weights: Weights<K>): { value: K; rngState: number } {
  const entries = Object.entries(weights) as [K, number][];
  const roll = nextRandom(rngState);
  let left = roll.value * entries.reduce((total, [, weight]) => total + weight, 0);
  const drawn = entries.find(([, weight]) => (left -= weight) < 0) ?? entries.at(-1)!;
  return { value: drawn[0], rngState: roll.rngState };
}

/** An anonymous look, drawn from the RNG with a pack's weights: a body, then a hair style that body wears, then hair colour and skin tone. */
function drawLook(rngState: number, weights: LookWeights): { value: AppearancePreset; rngState: number } {
  const body = drawWeighed(rngState, weights.body);
  const hairStyle = drawWeighed(body.rngState, weights.hairStyle[body.value]);
  const hairColour = drawWeighed(hairStyle.rngState, weights.hairColour);
  const skinTone = drawWeighed(hairColour.rngState, weights.skinTone);
  return {
    value: { body: body.value, hairStyle: hairStyle.value, hairColour: hairColour.value, skinTone: skinTone.value },
    rngState: skinTone.rngState,
  };
}

/** `count` anonymous looks, one after another from the RNG. */
export function drawLooks(rngState: number, weights: LookWeights, count: number): { value: AppearancePreset[]; rngState: number } {
  const looks: AppearancePreset[] = [];
  let next = rngState;
  for (let i = 0; i < count; i++) {
    const look = drawLook(next, weights);
    looks.push(look.value);
    next = look.rngState;
  }
  return { value: looks, rngState: next };
}

/** The look of an anonymous someone who is always about (a passer-by): drawn from their own `seed`, not the save's RNG, so it never changes. */
export function lookFromSeed(seed: number, weights: LookWeights): AppearancePreset {
  return drawLook(seedRng(seed), weights).value;
}
