// Snapping colours to the town's one shared palette (`src/world/palette.ts`), for the asset builds. Nearest is judged
// in OKLab, where distance follows what the eye sees.
import { PALETTE, PALETTE_COLOURS, type PaletteColour } from '../src/world/palette.ts';

/** An sRGB colour, channels 0–1. */
export type Rgb = readonly [number, number, number];
export const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const fromLinear = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
export const hexRgb = (hex: string): Rgb => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as unknown as Rgb;

function oklab([r, g, b]: Rgb): Rgb {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

const PALETTE_LAB = PALETTE_COLOURS.map((name) => [name, oklab(hexRgb(PALETTE[name]))] as const);

/** The palette colour nearest an sRGB colour, from those allowed (by default, all of them). */
export function nearest(rgb: Rgb, allowed: readonly PaletteColour[] = PALETTE_COLOURS): PaletteColour {
  const [l, a, b] = oklab(rgb);
  let best: PaletteColour = allowed[0]!;
  let bestDistance = Infinity;
  for (const [name, [pl, pa, pb]] of PALETTE_LAB) {
    if (!allowed.includes(name)) continue;
    const distance = (l - pl) ** 2 + (a - pa) ** 2 + (b - pb) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [name, distance];
  }
  return best;
}
