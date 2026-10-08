import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CHARACTER_ART_URLS } from '../src/world/characterArt.ts';
import { PALETTE, type PaletteColour } from '../src/world/palette.ts';
import { LAMP_BULBS, TOWN_ART_URL, TOWN_PIECES, WINDOW_GLASS } from '../src/world/townArt.ts';

// Holds the built town art in `public/town/` to what the game asks of it: every piece the town is built from, a bulb in
// each piece that lights up, and nothing but flat colours from the one shared palette. World code draws from the same palette, by name, and the
// character art's outfit (`npm run build:characters`) is painted in it too.

type Gltf = {
  scenes: { nodes: number[] }[];
  nodes: { name?: string; mesh?: number; children?: number[] }[];
  meshes?: { primitives: { material?: number }[] }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: object } }[];
  textures?: object[];
  images?: object[];
};

/** The JSON chunk of a GLB: its first chunk, after the 12-byte header and the chunk's 8-byte header. */
function readGlb(url: string): Gltf {
  const bytes = readFileSync(`public${url}`);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
}

/** A palette colour as glTF stores a base colour: linear, not sRGB. */
function linear(hex: string) {
  return [1, 3, 5].map((at) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}

/** The names of the materials a node and everything under it are drawn in. */
function materialsUnder(gltf: Gltf, index: number): string[] {
  const node = gltf.nodes[index]!;
  const own = node.mesh === undefined ? [] : gltf.meshes![node.mesh]!.primitives.map(({ material }) => gltf.materials?.[material ?? -1]?.name ?? '');
  return [...own, ...(node.children ?? []).flatMap((child) => materialsUnder(gltf, child))];
}

const isPaletteColour = (name: string): name is PaletteColour => name in PALETTE;

/** Everything the game needs that the art lacks, and every colour it has that the palette doesn't, one line each. */
function townArtProblems(town: Gltf): string[] {
  const problems: string[] = [];
  const pieces = new Set(town.scenes[0]!.nodes.map((index) => town.nodes[index]!.name));
  for (const piece of TOWN_PIECES) if (!pieces.has(piece)) problems.push(`town.glb has no ${piece}.`);
  for (const { name = '', pbrMetallicRoughness: pbr = {} } of town.materials ?? []) {
    if (pbr.baseColorTexture) problems.push(`town.glb's ${name} material has a texture.`);
    if (name === WINDOW_GLASS) continue;
    if (!isPaletteColour(name)) {
      problems.push(`town.glb's ${name} material is not a palette colour.`);
      continue;
    }
    const [r, g, b] = pbr.baseColorFactor ?? [1, 1, 1];
    const off = linear(PALETTE[name]).some((c, i) => Math.abs(c - [r, g, b][i]!) > 0.002);
    if (off) problems.push(`town.glb's ${name} material is not ${PALETTE[name]}.`);
  }
  if (town.images?.length) problems.push('town.glb has images.');
  for (const [piece, bulb] of Object.entries(LAMP_BULBS)) {
    const index = town.scenes[0]!.nodes.find((at) => town.nodes[at]!.name === piece);
    if (index !== undefined && !materialsUnder(town, index).includes(bulb)) problems.push(`town.glb's ${piece} has no ${bulb} bulb.`);
  }
  return problems;
}

/** Colour literals in world code outside the palette, as `file: literal`. */
function strayColours(files: Record<string, string>): string[] {
  return Object.entries(files).flatMap(([file, source]) =>
    file === 'palette.ts' ? [] : [...source.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)].map(([literal]) => `${file}: ${literal}`),
  );
}

/** The outfit texture's pixels in the character art, as RGB bytes: the image its `outfit` material's colour map names. */
async function outfitPixels(url: string) {
  const bytes = readFileSync(`public${url}`);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const binary = bytes.subarray(28 + jsonLength);
  const material = gltf.materials.find(({ name }: { name: string }) => name === 'outfit');
  const texture = gltf.textures[material.pbrMetallicRoughness.baseColorTexture.index];
  const image = gltf.images[texture.extensions?.EXT_texture_webp?.source ?? texture.source];
  const view = gltf.bufferViews[image.bufferView];
  return sharp(binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)).removeAlpha().raw().toBuffer();
}

/** Every colour in RGB pixels that isn't a palette colour, as hex. */
function offPalette(pixels: Buffer): string[] {
  const palette = new Set<string>(Object.values(PALETTE));
  const off = new Set<string>();
  for (let at = 0; at < pixels.length; at += 3) {
    const hex = `#${[0, 1, 2].map((k) => pixels[at + k]!.toString(16).padStart(2, '0')).join('')}`;
    if (!palette.has(hex)) off.add(hex);
  }
  return [...off];
}

const worldSources = () =>
  Object.fromEntries(
    readdirSync('src/world')
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => [file, readFileSync(join('src/world', file), 'utf8')]),
  );

describe('the town art', () => {
  const town = readGlb(TOWN_ART_URL);

  it('holds every piece the town is built from, in flat palette colours', () => {
    expect(townArtProblems(town)).toEqual([]);
  });

  it('fails art built before a piece was added, or with colours off the palette, or without a bulb to light', () => {
    const stale = structuredClone(town);
    for (const index of stale.scenes[0]!.nodes) if (stale.nodes[index]!.name === 'bench') stale.nodes[index]!.name = 'seat';
    stale.materials = [
      { name: 'leaf', pbrMetallicRoughness: { baseColorFactor: [0, 0, 1, 1] } },
      { name: 'colormap', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], baseColorTexture: { index: 0 } } },
    ];
    stale.images = [{}];

    expect(townArtProblems(stale)).toEqual([
      'town.glb has no bench.',
      `town.glb's leaf material is not ${PALETTE.leaf}.`,
      "town.glb's colormap material has a texture.",
      "town.glb's colormap material is not a palette colour.",
      'town.glb has images.',
      "town.glb's street-light has no white bulb.",
    ]);
  });
});

describe('the world’s colours', () => {
  it('all come from the palette', () => {
    expect(strayColours(worldSources())).toEqual([]);
  });

  it('catches a colour written out in world code', () => {
    expect(strayColours({ 'Town.tsx': "<meshStandardMaterial color=\"#6b5b4d\" />", 'palette.ts': "ink: '#2f2a24'" })).toEqual(['Town.tsx: #6b5b4d']);
  });
});

describe('the character outfits', () => {
  it('are painted in palette colours', async () => {
    expect(offPalette(await outfitPixels(CHARACTER_ART_URLS.characters))).toEqual([]);
  });

  it('catch a pixel off the palette', () => {
    expect(offPalette(Buffer.from([0xfb, 0xf8, 0xf2, 0x12, 0x34, 0x56]))).toEqual(['#123456']);
  });
});
