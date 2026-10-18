import type { AccessoryColourId, Build, EyewearId, HatId, NeckwearId, NpcLook, Weights } from '../content/index.ts';
import { nextRandom, seedRng } from './rng.ts';

/** A pack's weights for anonymous looks: the build their voice suits, a hat, eyewear and neckwear, and their colour. */
export type LookWeights = {
  build: Weights<Build>;
  hat: Weights<HatId>;
  eyewear: Weights<EyewearId>;
  neckwear: Weights<NeckwearId>;
  colour: Weights<AccessoryColourId>;
};

/** One of the weighed parts, drawn from the RNG as often as its weight says. */
function drawWeighed<K extends string>(rngState: number, weights: Weights<K>): { value: K; rngState: number } {
  const entries = Object.entries(weights) as [K, number][];
  const roll = nextRandom(rngState);
  let left = roll.value * entries.reduce((total, [, weight]) => total + weight, 0);
  const drawn = entries.find(([, weight]) => (left -= weight) < 0) ?? entries.at(-1)!;
  return { value: drawn[0], rngState: roll.rngState };
}

/** An anonymous look, drawn from the RNG with a pack's weights: a build, then a hat, eyewear, neckwear and their colour. */
function drawLook(rngState: number, weights: LookWeights): { value: NpcLook; rngState: number } {
  const build = drawWeighed(rngState, weights.build);
  const hat = drawWeighed(build.rngState, weights.hat);
  const eyewear = drawWeighed(hat.rngState, weights.eyewear);
  const neckwear = drawWeighed(eyewear.rngState, weights.neckwear);
  const colour = drawWeighed(neckwear.rngState, weights.colour);
  return {
    value: { build: build.value, hat: hat.value, eyewear: eyewear.value, neckwear: neckwear.value, colour: colour.value },
    rngState: colour.rngState,
  };
}

/** The look of an anonymous someone who is always about (a passer-by): drawn from their own `seed`, not the save's RNG, so it never changes. */
export function lookFromSeed(seed: number, weights: LookWeights): NpcLook {
  return drawLook(seedRng(seed), weights).value;
}
