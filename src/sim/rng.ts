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
