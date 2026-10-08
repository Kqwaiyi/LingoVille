import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHARACTER_ART_URLS, CHARACTER_BONES, CHARACTER_CLIPS, partsByBuild } from '../src/world/characterArt.ts';

// Holds the built character art in `public/characters/` to what the game asks of it, so art left behind by a change to
// the names (a clip added without `npm run build:characters`, say) fails here rather than crashing the scene.

type Gltf = { scenes: { nodes: number[] }[]; nodes: { name?: string; children?: number[] }[]; animations?: { name?: string }[] };

/** The JSON chunk of a GLB: its first chunk, after the 12-byte header and the chunk's 8-byte header. */
function readGlb(url: string): Gltf {
  const bytes = readFileSync(`public${url}`);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
}

/** Every node under `node`, however deep. */
function descendants(gltf: Gltf, node: Gltf['nodes'][number]): Gltf['nodes'] {
  return (node.children ?? []).flatMap((index) => [gltf.nodes[index]!, ...descendants(gltf, gltf.nodes[index]!)]);
}

/** Everything the game needs that the art lacks, one line each. */
function characterArtProblems(characters: Gltf, animations: Gltf): string[] {
  const problems: string[] = [];
  const builds = new Map(characters.scenes[0]!.nodes.map((index) => [characters.nodes[index]!.name, characters.nodes[index]!]));
  for (const [build, parts] of partsByBuild()) {
    const node = builds.get(build);
    if (!node) {
      problems.push(`characters.glb has no ${build} build.`);
      continue;
    }
    const held = new Set((node.children ?? []).map((index) => characters.nodes[index]!.name));
    for (const part of parts) if (!held.has(part)) problems.push(`characters.glb's ${build} build has no ${part}.`);
    const bones = new Set(descendants(characters, node).map((descendant) => descendant.name));
    for (const bone of CHARACTER_BONES) if (!bones.has(bone)) problems.push(`characters.glb's ${build} build has no ${bone} bone.`);
  }
  const clips = new Set((animations.animations ?? []).map(({ name }) => name));
  for (const clip of CHARACTER_CLIPS) if (!clips.has(clip)) problems.push(`animations.glb has no ${clip} clip.`);
  return problems;
}

describe('the character art', () => {
  const characters = readGlb(CHARACTER_ART_URLS.characters);
  const animations = readGlb(CHARACTER_ART_URLS.animations);

  it('holds every build, part, bone and clip the game shows', () => {
    expect(characterArtProblems(characters, animations)).toEqual([]);
  });

  it('fails art built before a clip, a part, a bone or a build was added', () => {
    const stale = structuredClone(characters);
    const [masculine, feminine] = stale.scenes[0]!.nodes.map((index) => stale.nodes[index]!);
    feminine!.name = 'other';
    masculine!.children = masculine!.children!.filter((index) => stale.nodes[index]!.name !== 'beard');
    const noJog = { ...animations, animations: animations.animations!.filter(({ name }) => name !== 'jog') };
    for (const node of descendants(stale, masculine!)) if (node.name === 'pelvis') node.name = 'hips';

    expect(characterArtProblems(stale, noJog)).toEqual([
      "characters.glb's masculine build has no beard.",
      "characters.glb's masculine build has no pelvis bone.",
      'characters.glb has no feminine build.',
      'animations.glb has no jog clip.',
    ]);
  });
});
