/**
 * Builds the town's surface textures, `public/town/surfaces/<surface>.png`: one for each surface that has one
 * (`TEXTURED_SURFACES` in `src/world/surfaces.ts`), drawn here from noise and patterns, so there's no source to download.
 *
 * Each repeats seamlessly over the metres its surface says, and holds two things the game projects onto the town from
 * three sides: in red and green, which way the surface tilts (a normal map's x and y, built from the height of its
 * bricks, tiles, boards or grain), and in blue, how much lighter or darker it is than its palette colour (0.5 is the
 * colour itself, 0 black and 1 twice as bright). They're detail, not colour: each building still wears its palette
 * colours, and a surface is the same texture in every colour.
 *
 * `npm run build:surfaces`
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { SURFACE_LOOKS, TEXTURED_SURFACES, surfaceTextureUrl, type Surface } from '../src/world/surfaces.ts';

/** Texels along each side of a texture. */
const SIZE = 512;

/** A point on the texture, as fractions of it (0 to 1), and how to tell the surface's height (metres) and shade there. */
type Draw = (u: number, v: number) => { height: number; shade: number };

// Noise that repeats: everything below wraps round its period, so each texture tiles without a seam.

function hash(i: number, j: number, seed = 0) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
const fade = (t: number) => t * t * (3 - 2 * t);
const smoothstep = (a: number, b: number, x: number) => fade(Math.min(1, Math.max(0, (x - a) / (b - a))));
const fract = (x: number) => x - Math.floor(x);

/** Value noise from 0 to 1 over a lattice `cellsU` by `cellsV` across the texture. */
function noise(u: number, v: number, cellsU: number, cellsV = cellsU, seed = 0) {
  const [x, y] = [u * cellsU, v * cellsV];
  const [ix, iy] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [fade(x - ix), fade(y - iy)];
  const at = (i: number, j: number) => hash(mod(i, cellsU), mod(j, cellsV), seed);
  const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
  const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
  return top + (bottom - top) * fy;
}

/** Octaves of noise, each twice as fine and half as strong, from 0 to 1. */
function fbm(u: number, v: number, cellsU: number, octaves: number, cellsV = cellsU, seed = 0) {
  let [sum, amplitude, total] = [0, 1, 0];
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise(u, v, cellsU * 2 ** o, cellsV * 2 ** o, seed + o * 17);
    total += amplitude;
    amplitude *= 0.5;
  }
  return sum / total;
}

/** Cells round scattered points (`cells` by `cells`): the distance to the nearest point and the next, in cells, and which. */
function voronoi(u: number, v: number, cells: number, seed = 0) {
  const [x, y] = [u * cells, v * cells];
  const [ix, iy] = [Math.floor(x), Math.floor(y)];
  let [f1, f2, id] = [Infinity, Infinity, 0];
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const [ci, cj] = [mod(ix + i, cells), mod(iy + j, cells)];
      const px = ix + i + 0.15 + 0.7 * hash(ci, cj, seed);
      const py = iy + j + 0.15 + 0.7 * hash(ci, cj, seed + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) [f2, f1, id] = [f1, d, hash(ci, cj, seed + 13)];
      else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, id };
}

/**
 * Courses of blocks: `across` to a course, `courses` up the texture, every other course set over by half a block. The
 * block's own random number, and how far this point is from its nearest edge, in metres for a texture `metres` across.
 */
function bond(u: number, v: number, across: number, courses: number, metres: number, stagger = 0.5) {
  const course = Math.floor(v * courses);
  const along = u * across + (course % 2) * stagger;
  const block = mod(Math.floor(along), across);
  const [fu, fv] = [fract(along), fract(v * courses)];
  const edge = Math.min(Math.min(fu, 1 - fu) * (metres / across), Math.min(fv, 1 - fv) * (metres / courses));
  return { random: hash(block, course, 5), edge, fu, fv, block, course };
}

const DRAW: Record<Surface, Draw | undefined> = {
  matte: undefined,
  paint: undefined,
  metal: undefined,
  brass: undefined,
  ceramic: undefined,

  // Lime render, trowelled by hand: broad mottling and a fine sandy grain.
  plaster: (u, v) => {
    const grain = fbm(u, v, 64, 3, 64, 1);
    const mottle = fbm(u, v, 4, 5, 4, 2);
    return { height: 0.0016 * grain + 0.0012 * fbm(u, v, 12, 3, 12, 3), shade: 1 + 0.12 * (mottle - 0.5) + 0.06 * (grain - 0.5) };
  },

  // Stretcher bond, 4 bricks to a metre and 14 courses, each brick its own shade, in pale lime mortar.
  brick: (u, v) => {
    const { random, edge } = bond(u, v, 4, 14, 1);
    const brick = smoothstep(0.004, 0.0075, edge);
    const speckle = noise(u, v, 128, 128, 4);
    const burnt = random > 0.88 ? 0.72 : 1;
    const face = (0.8 + 0.34 * random) * burnt + 0.1 * (speckle - 0.5);
    return { height: brick * (0.009 + 0.0015 * speckle), shade: brick * face + (1 - brick) * (1.45 + 0.1 * speckle) };
  },

  // Dressed stone blocks, half a metre by a quarter, in fine joints.
  stone: (u, v) => {
    const { random, edge } = bond(u, v, 4, 8, 2);
    const block = smoothstep(0.002, 0.005, edge);
    const tooled = fbm(u, v, 48, 3, 48, 6);
    return { height: block * (0.006 + 0.002 * tooled) - 0.002 * (1 - smoothstep(0.004, 0.02, edge)), shade: block * (0.9 + 0.16 * random + 0.12 * (tooled - 0.5)) + (1 - block) * 0.72 };
  },

  // Clay pantiles in rows down the slope: each a rounded channel, its own shade, darker between.
  tile: (u, v) => {
    const { random, fu, fv } = bond(u, v, 8, 8, 2);
    const curve = Math.sin(Math.PI * fu) ** 0.6;
    const lap = smoothstep(0, 0.06, fv) * 0.25 + 0.75;
    const weather = fbm(u, v, 6, 4, 6, 8);
    return { height: 0.022 * curve * lap, shade: (0.84 + 0.3 * random) * (0.7 + 0.3 * curve) * (0.9 + 0.2 * weather) };
  },

  // Roofing felt under fine gravel.
  roofing: (u, v) => {
    const pebbles = voronoi(u, v, 160, 9);
    return { height: 0.002 * (1 - Math.min(1, pebbles.f1 * 1.6)), shade: 0.85 + 0.25 * pebbles.id + 0.1 * (fbm(u, v, 4, 4, 4, 10) - 0.5) };
  },

  // Varnished timber: grain along its length, rings drawn out by a gentle warp.
  wood: (u, v) => {
    const warp = fbm(u, v, 2, 3, 6, 11);
    const rings = 0.5 + 0.5 * Math.sin(2 * Math.PI * (v * 24 + 2.5 * warp));
    const streaks = noise(u, v, 16, 256, 12);
    return { height: 0.00035 * rings, shade: 0.86 + 0.16 * rings + 0.08 * (streaks - 0.5) };
  },

  // Floorboards 15 cm wide, a metre long, ends staggered, each its own shade.
  planks: (u, v) => {
    const board = Math.floor(v * 13);
    const along = u * 2 + hash(board, 0, 14);
    const piece = Math.floor(along);
    const [fu, fv] = [fract(along), fract(v * 13)];
    const edge = Math.min(Math.min(fv, 1 - fv) * (2 / 13), Math.min(fu, 1 - fu));
    const gap = smoothstep(0.0012, 0.003, edge);
    const random = hash(mod(piece, 2), board, 15);
    const rings = 0.5 + 0.5 * Math.sin(2 * Math.PI * (v * 13 * 3 + 2 * fbm(u, v, 3, 3, 13, 16) + random * 5));
    return { height: 0.0015 * gap, shade: gap * (0.84 + 0.22 * random + 0.08 * rings) + (1 - gap) * 0.5 };
  },

  // A plain weave, with the slubs of the yarn.
  fabric: (u, v) => {
    const threads = 128;
    const warp = Math.sin(2 * Math.PI * u * threads);
    const weft = Math.sin(2 * Math.PI * v * threads);
    const slub = fbm(u, v, 16, 3, 16, 17);
    return { height: 0.00025 * (warp * weft + 1), shade: 1 + 0.05 * warp * weft + 0.08 * (slub - 0.5) };
  },

  // Leaves in clusters: small overlapping leaves, each its own green, on bigger clumps, with soft shadow between.
  foliage: (u, v) => {
    const leaves = voronoi(u, v, 34, 18);
    const fine = voronoi(u, v, 61, 32);
    const clumps = voronoi(u, v, 5, 19);
    const leaf = Math.max(0, 1 - leaves.f1 * 1.4);
    const clump = Math.max(0, 1 - clumps.f1 * 1.2);
    const between = smoothstep(0, 0.35, leaves.f2 - leaves.f1);
    const dapple = fbm(u, v, 8, 4, 8, 33);
    return {
      height: 0.006 * leaf + 0.003 * Math.max(0, 1 - fine.f1 * 1.4) + 0.04 * clump,
      shade: (0.82 + 0.26 * leaves.id + 0.12 * (fine.id - 0.5)) * (0.78 + 0.22 * between) * (0.82 + 0.28 * clump) * (0.85 + 0.3 * dapple),
    };
  },

  // Bark: ridges running up the trunk, split by fissures.
  bark: (u, v) => {
    const ridges = fbm(u, v, 24, 4, 2, 20);
    const fissure = smoothstep(0.3, 0.6, ridges);
    return { height: 0.01 * fissure, shade: 0.72 + 0.36 * fissure + 0.1 * (noise(u, v, 64, 64, 21) - 0.5) };
  },

  // A lawn seen from above: patches of lusher and drier grass, clover, and the speckle of blades.
  grass: (u, v) => {
    const patches = fbm(u, v, 3, 5, 3, 22);
    const blades = noise(u, v, 384, 96, 23);
    const crossed = noise(u, v, 96, 384, 34);
    const tufts = fbm(u, v, 40, 2, 40, 24);
    const dry = smoothstep(0.55, 0.75, fbm(u, v, 6, 3, 6, 35));
    return {
      height: 0.003 * blades + 0.003 * crossed + 0.004 * tufts,
      shade: (0.72 + 0.46 * patches + 0.16 * (blades - 0.5) + 0.16 * (crossed - 0.5) + 0.1 * (tufts - 0.5)) * (1 - 0.12 * dry),
    };
  },

  // Tarmac: fine aggregate, with patches where it's been mended and worn.
  asphalt: (u, v) => {
    const aggregate = noise(u, v, 320, 320, 25);
    const stones = voronoi(u, v, 90, 26);
    const patches = fbm(u, v, 3, 4, 3, 27);
    return { height: 0.0012 * aggregate + 0.001 * Math.max(0, 1 - stones.f1 * 2), shade: 0.9 + 0.22 * (aggregate - 0.5) + 0.12 * (patches - 0.5) + 0.12 * (stones.id - 0.5) * Math.max(0, 1 - stones.f1 * 2) };
  },

  // Granite setts, 20 cm by 14, in courses, worn round on top, set in dark joints.
  cobbles: (u, v) => {
    const { random, edge } = bond(u, v, 10, 14, 2);
    const dome = smoothstep(0.004, 0.03, edge);
    const grain = noise(u, v, 160, 160, 28);
    const sett = smoothstep(0.003, 0.006, edge);
    return { height: 0.014 * Math.sqrt(dome) + 0.001 * grain, shade: sett * (0.74 + 0.38 * random + 0.12 * (grain - 0.5)) + (1 - sett) * 0.42 };
  },

  // Paving slabs, 60 cm square, in fine joints.
  paving: (u, v) => {
    const { random, edge } = bond(u, v, 4, 4, 2.4, 0);
    const slab = smoothstep(0.003, 0.006, edge);
    const speckle = noise(u, v, 256, 256, 29);
    const wear = fbm(u, v, 5, 4, 5, 30);
    return { height: slab * 0.004 + 0.0005 * speckle, shade: slab * (0.9 + 0.14 * random + 0.1 * (speckle - 0.5) + 0.08 * (wear - 0.5)) + (1 - slab) * 0.62 };
  },

  // Gravel: pebbles of every shade, packed together.
  gravel: (u, v) => {
    const pebbles = voronoi(u, v, 48, 31);
    const pebble = Math.max(0, 1 - pebbles.f1 * 1.7);
    return { height: 0.006 * Math.sqrt(pebble), shade: (0.7 + 0.55 * pebbles.id) * (0.55 + 0.45 * smoothstep(0, 0.2, pebbles.f2 - pebbles.f1)) };
  },
};

/** A surface's texture: its height and shade drawn over the grid, the tilt read off the height between neighbours. */
function texture(surface: Surface, draw: Draw) {
  const metres = SURFACE_LOOKS[surface].texture!.metres;
  const heights = new Float32Array(SIZE * SIZE);
  const shades = new Float32Array(SIZE * SIZE);
  // Row 0 is v = 0 here; the image is written top row last, as WebGL flips an image to read it.
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const { height, shade } = draw((i + 0.5) / SIZE, (j + 0.5) / SIZE);
      heights[j * SIZE + i] = height;
      shades[j * SIZE + i] = shade;
    }
  }
  const texel = metres / SIZE;
  const at = (i: number, j: number) => heights[mod(j, SIZE) * SIZE + mod(i, SIZE)]!;
  const pixels = Buffer.alloc(SIZE * SIZE * 3);
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * texel);
      const dy = (at(i, j + 1) - at(i, j - 1)) / (2 * texel);
      const length = Math.hypot(dx, dy, 1);
      const out = ((SIZE - 1 - j) * SIZE + i) * 3;
      pixels[out] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
      pixels[out + 1] = Math.round(((-dy / length) * 0.5 + 0.5) * 255);
      pixels[out + 2] = Math.round(Math.min(1, Math.max(0, shades[j * SIZE + i]! / 2)) * 255);
    }
  }
  return pixels;
}

await mkdir(join('public', 'town', 'surfaces'), { recursive: true });
for (const surface of TEXTURED_SURFACES) {
  const draw = DRAW[surface];
  if (!draw) throw new Error(`No texture is drawn for ${surface}, which SURFACE_LOOKS gives one.`);
  const file = join('public', surfaceTextureUrl(surface));
  await sharp(texture(surface, draw), { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(surface.padEnd(10), file);
}
