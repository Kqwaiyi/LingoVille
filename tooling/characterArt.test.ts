import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCESSORY_COLOURS } from '../src/content/index.ts';
import {
  ACCENT_MATERIAL,
  APRON_MATERIAL,
  CHARACTER_ART_URL,
  CHARACTER_BONES,
  CHARACTER_CLIPS,
  EYE_SHAPES,
  EYES,
  FIGURE,
  optionalParts,
} from '../src/world/characterArt.ts';
import { CLAWD_PALETTE, PALETTE } from '../src/world/palette.ts';

// Holds the built character art in `public/characters/` to what the game asks of it, so art left behind by a change to
// the names (a clip added without rebuilding `art/characters/clawd.py`, say) fails here rather than crashing the scene,
// and keeps it in the world's colours: each material a palette colour by name (`colour`, or `colour:finish`), or one
// the game tints.

type Gltf = {
  scenes: { nodes: number[] }[];
  nodes: { name?: string; mesh?: number; children?: number[] }[];
  meshes: { name?: string; extras?: { targetNames?: string[] } }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: object } }[];
  animations?: { name?: string }[];
  images?: object[];
};

/** The JSON chunk of a GLB: its first chunk, after the 12-byte header and the chunk's 8-byte header. */
function readGlb(url: string): Gltf {
  const bytes = readFileSync(`public${url}`);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
}

/** Every node under `node`, however deep. */
function descendants(gltf: Gltf, node: Gltf['nodes'][number]): Gltf['nodes'] {
  return (node.children ?? []).flatMap((index) => [gltf.nodes[index]!, ...descendants(gltf, gltf.nodes[index]!)]);
}

/** A palette colour as glTF stores a base colour: linear, not sRGB. */
function linear(hex: string) {
  return [1, 3, 5].map((at) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}

const COLOURS: Record<string, string> = { ...PALETTE, ...CLAWD_PALETTE };

/** Everything the game needs that the art lacks, and every colour it has that the palette doesn't, one line each. */
function characterArtProblems(art: Gltf): string[] {
  const problems: string[] = [];
  const figure = art.scenes[0]!.nodes.map((index) => art.nodes[index]!).find(({ name }) => name === FIGURE);
  if (!figure) return [`clawd.glb has no ${FIGURE}.`];
  const under = descendants(art, figure);
  const names = new Set(under.map(({ name }) => name));
  for (const part of optionalParts()) if (!names.has(part)) problems.push(`clawd.glb has no ${part}.`);
  for (const bone of CHARACTER_BONES) if (!names.has(bone)) problems.push(`clawd.glb has no ${bone} bone.`);
  const eyes = under.find(({ name }) => name === EYES);
  const shapes = new Set(eyes?.mesh === undefined ? [] : (art.meshes[eyes.mesh]!.extras?.targetNames ?? []));
  if (!eyes) problems.push(`clawd.glb has no ${EYES}.`);
  else for (const shape of EYE_SHAPES) if (!shapes.has(shape)) problems.push(`clawd.glb's ${EYES} have no ${shape} shape.`);
  const clips = new Set((art.animations ?? []).map(({ name }) => name));
  for (const clip of CHARACTER_CLIPS) if (!clips.has(clip)) problems.push(`clawd.glb has no ${clip} clip.`);
  for (const { name = '', pbrMetallicRoughness: pbr = {} } of art.materials ?? []) {
    if (pbr.baseColorTexture) problems.push(`clawd.glb's ${name} material has a texture.`);
    if (name === ACCENT_MATERIAL || name === APRON_MATERIAL) continue;
    const colour = COLOURS[name.split(':')[0]!];
    if (!colour) {
      problems.push(`clawd.glb's ${name} material is not a palette colour.`);
      continue;
    }
    const [r, g, b] = pbr.baseColorFactor ?? [1, 1, 1];
    if (linear(colour).some((c, i) => Math.abs(c - [r, g, b][i]!) > 0.002)) problems.push(`clawd.glb's ${name} material is not ${colour}.`);
  }
  if (art.images?.length) problems.push('clawd.glb has images.');
  return problems;
}

describe('the character art', () => {
  const art = readGlb(CHARACTER_ART_URL);

  it('holds Clawd with everything anyone wears, the bones, eye shapes and clips the game uses, in palette colours', () => {
    expect(characterArtProblems(art)).toEqual([]);
  });

  it('fails art built before a part, a bone, an eye shape or a clip was added, or with a colour off the palette', () => {
    const stale = structuredClone(art);
    const figure = stale.scenes[0]!.nodes.map((index) => stale.nodes[index]!).find(({ name }) => name === FIGURE)!;
    const under = descendants(stale, figure);
    under.find(({ name }) => name === 'hat-beret')!.name = 'hat-tam';
    under.find(({ name }) => name === 'body')!.name = 'torso';
    const eyes = under.find(({ name }) => name === EYES)!;
    stale.meshes[eyes.mesh!]!.extras!.targetNames = ['blink', 'puzzled'];
    stale.animations = stale.animations!.filter(({ name }) => name !== 'talk');
    stale.materials!.find(({ name }) => name === 'clawd')!.pbrMetallicRoughness!.baseColorFactor = [0.1, 0.2, 0.3, 1];
    stale.materials!.push({ name: 'gold' });

    expect(characterArtProblems(stale)).toEqual([
      'clawd.glb has no hat-beret.',
      'clawd.glb has no body bone.',
      "clawd.glb's eyes have no strained shape.",
      'clawd.glb has no talk clip.',
      `clawd.glb's clawd material is not ${CLAWD_PALETTE.clawd}.`,
      "clawd.glb's gold material is not a palette colour.",
    ]);
  });
});

describe('the colours what is worn comes in', () => {
  it('are palette colours', () => {
    for (const [name, hex] of Object.entries(ACCESSORY_COLOURS)) expect({ name, hex }).toEqual({ name, hex: (PALETTE as Record<string, string>)[name] });
  });
});
