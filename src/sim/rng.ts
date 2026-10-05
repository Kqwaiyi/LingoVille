/**
 * Turns a setup seed into the RNG state kept in the save. The state is one
 * 32-bit integer, scrambled so that nearby seeds start far apart.
 */
export function seedRng(seed: number): number {
  let z = (seed + 0x9e3779b9) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

/**
 * The next number from the save's RNG, from 0 (inclusive) to 1 (exclusive),
 * and the RNG state to keep for the draw after it (mulberry32).
 */
export function nextRandom(rngState: number): { value: number; rngState: number } {
  const next = (rngState + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 2 ** 32, rngState: next };
}

/** A whole number from `min` to `max`, both included, from the save's RNG. */
export function randomInt(rngState: number, min: number, max: number): { value: number; rngState: number } {
  const draw = nextRandom(rngState);
  return { value: min + Math.floor(draw.value * (max - min + 1)), rngState: draw.rngState };
}
