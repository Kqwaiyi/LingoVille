/**
 * Builds the shared character art in `public/characters/` from Quaternius's CC0 packs:
 *
 * - `characters.glb`: two builds, `masculine` and `feminine`, each a skeleton wearing its everyday outfit, with every
 *   head, eye, eyebrow and hair part bound to it. The game shows the parts an Appearance Preset names and hides the rest.
 * - `animations.glb`: the shared animation library, by our clip names, for any of those skeletons.
 *
 * The packs are free downloads, too big to keep in the repo. Unzip each into one folder and pass it:
 * - Universal Base Characters [Standard]: https://quaternius.itch.io/universal-base-characters
 * - Modular Character Outfits - Fantasy [Standard]: https://quaternius.itch.io/modular-character-outfits-fantasy
 * - Universal Animation Library [Standard]: https://quaternius.itch.io/universal-animation-library
 *
 * `npm run build:characters -- <folder>`
 */
import { Document, NodeIO, type Node, type Primitive, type Skin, type Texture } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, mergeDocuments, prune, unpartition } from '@gltf-transform/functions';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp, { type Sharp } from 'sharp';

const source = process.argv[2];
if (!source) throw new Error('Pass the folder the Quaternius packs were unzipped into.');
const OUT = 'public/characters';

const BASE = join(source, 'Universal Base Characters[Standard]');
const BODIES = join(BASE, 'Base Characters', 'Godot - UE');
const HAIR = join(BASE, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)');
const OUTFITS = join(source, 'Modular Character Outfits - Fantasy[Standard]', 'Exports', 'glTF (Godot-Unreal)', 'Outfits');
const ANIMATIONS = join(source, 'Universal Animation Library[Standard]', 'Unreal-Godot', 'UAL1_Standard.glb');

/** Each build: the outfit that dresses its skeleton. */
const BUILDS = { masculine: 'Male_Peasant.gltf', feminine: 'Female_Peasant.gltf' } as const;
/** The heads, each cut from a base body's neck up, with its eyes and eyebrows. */
const HEADS = { 'head-a': 'Superhero_Male_FullBody.gltf', 'head-b': 'Superhero_Female_FullBody.gltf' } as const;
/** Each base body's own head skin: the light one, whose underwear is out of sight anyway. */
const HEAD_SKIN = { 'head-a': 'T_Superhero_Male_Ligh.png', 'head-b': 'T_Superhero_Female_Light_BaseColor.png' } as const;
/** Hair, and a beard. A part ending in a head's letter is the one cut to fit that head. */
const HAIR_PARTS = {
  'hair-parted': 'Hair_SimpleParted.gltf',
  'hair-long': 'Hair_Long.gltf',
  'hair-buns': 'Hair_Buns.gltf',
  'hair-buzzed-a': 'Hair_Buzzed.gltf',
  'hair-buzzed-b': 'Hair_BuzzedFemale.gltf',
  beard: 'Hair_Beard.gltf',
} as const;
/** Skin and hair go grey, then brighten until the texel at this percentile of the lit ones is near white. */
const TINT = { darkest: 60, percentile: 0.6, white: 235 } as const;
/** The bones a head is cut along, and how much of a corner they must hold for it to stay: low enough to reach under a collar. */
const HEAD_BONES = new Set(['neck_01', 'Head']);
const HEAD_CUT = 0.2;
/** Texture sizes in pixels, square. */
const SIZES = { skin: 1024, hair: 512, eyes: 256, other: 1024 } as const;
/** Our clip names → the library's. */
const CLIPS = { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', talk: 'Idle_Talking_Loop', sit: 'Sitting_Idle_Loop', interact: 'Interact' } as const;
/** Clips keep moving these bones; every other bone keeps the length its own skeleton gives it. */
const MOVING_BONES = new Set(['root', 'pelvis']);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'sharp': sharp });

/**
 * Reads one of the packs' .gltf files. Some name a texture `<name>_png.png` that ships as `<name>.png`.
 */
async function readPack(path: string) {
  const json = JSON.parse(await readFile(path, 'utf8'));
  const dir = dirname(path);
  const resources: Record<string, Uint8Array<ArrayBuffer>> = {};
  for (const { uri } of [...(json.buffers ?? []), ...(json.images ?? [])] as { uri: string }[]) {
    const file = join(dir, decodeURIComponent(uri));
    resources[uri] = await readFile(existsSync(file) ? file : file.replace(/_png\.png$/, '.png'));
  }
  return io.readJSON({ json, resources });
}

/** A texture ready to tint: grey, brightened so that its typical lit texel is near white, and small. */
async function tintable(texture: Texture, size: number) {
  const image = sharp(Buffer.from(texture.getImage()!)).greyscale();
  // Typical of the skin or hair itself, not of the dark gaps and underwear around it.
  const lit = [...(await image.clone().raw().toBuffer())].filter((value) => value > TINT.darkest).sort((a, b) => a - b);
  const typical = lit[Math.floor(lit.length * TINT.percentile)]!;
  await save(texture, image.linear(TINT.white / typical, 0), size);
}

/** A texture kept as it is, only smaller. */
async function shrink(texture: Texture, size: number) {
  await save(texture, sharp(Buffer.from(texture.getImage()!)), size);
}

/** Writes an image back into its texture: resized, as WebP. */
async function save(texture: Texture, image: Sharp, size: number) {
  const data = await image.resize(size, size).webp({ quality: 85 }).toBuffer();
  texture.setImage(new Uint8Array(data)).setMimeType('image/webp');
}

/** Keeps only the triangles all of whose corners the head bones hold enough (`HEAD_CUT`). */
function cutHead(primitive: Primitive, skin: Skin) {
  const headJoints = new Set(skin.listJoints().flatMap((joint, i) => (HEAD_BONES.has(joint.getName()) ? [i] : [])));
  const joints = primitive.getAttribute('JOINTS_0')!;
  const weights = primitive.getAttribute('WEIGHTS_0')!;
  const indices = primitive.getIndices()!;
  const held = (vertex: number) => {
    const j = joints.getElement(vertex, []);
    const w = weights.getElement(vertex, []);
    return j.reduce((sum, joint, k) => sum + (headJoints.has(joint) ? w[k]! : 0), 0) >= HEAD_CUT;
  };
  const kept: number[] = [];
  for (let i = 0; i < indices.getCount(); i += 3) {
    const triangle = [indices.getScalar(i), indices.getScalar(i + 1), indices.getScalar(i + 2)];
    if (triangle.every(held)) kept.push(...triangle);
  }
  indices.setArray(new Uint32Array(kept));
  compactPrimitive(primitive);
}

/** Every skinned mesh node in a document. */
function meshNodes(document: Document) {
  return document.getRoot().listNodes().filter((node) => node.getMesh() && node.getSkin());
}

async function buildCharacters() {
  const out = new Document();
  out.createBuffer();
  const builds = new Map<keyof typeof BUILDS, { armature: Node; bones: Map<string, Node> }>();
  const scene = out.createScene('characters');
  out.getRoot().setDefaultScene(scene);

  /** Brings a document's contents into `out`, returning the copies of its skinned mesh nodes. */
  const bring = async (path: string) => {
    const document = await readPack(path);
    const nodes = meshNodes(document);
    const map = mergeDocuments(out, document);
    // Merged scenes go: only the nodes taken from them are kept.
    return nodes.map((node) => map.get(node) as Node);
  };

  for (const [build, file] of Object.entries(BUILDS) as [keyof typeof BUILDS, string][]) {
    const outfit = await bring(join(OUTFITS, file));
    const skin = outfit[0]!.getSkin()!;
    const rootBone = skin.listJoints().find((joint) => joint.getName() === 'root')!;
    const armature = rootBone.getParentNode()!.setName(build);
    scene.addChild(armature);
    builds.set(build, { armature, bones: new Map(skin.listJoints().map((joint) => [joint.getName(), joint])) });
    // One outfit mesh, so the game shows or tints it as one part.
    for (const node of outfit) node.setName(node.getName().endsWith('_Arms') ? 'outfit-arms' : `outfit-${node.getName().split('_').pop()!.toLowerCase()}`);
  }

  /** Binds a part, taken from any skeleton of the same bones, to every build. */
  const attach = (part: Node, name: string) => {
    const from = part.getSkin()!;
    for (const { armature, bones } of builds.values()) {
      const skin = out.createSkin(name).setInverseBindMatrices(from.getInverseBindMatrices());
      for (const joint of from.listJoints()) skin.addJoint(bones.get(joint.getName())!);
      skin.setSkeleton(bones.get('root')!);
      armature.addChild(out.createNode(name).setMesh(part.getMesh()).setSkin(skin));
    }
    part.dispose();
  };

  for (const [head, file] of Object.entries(HEADS) as [keyof typeof HEADS, string][]) {
    const [brows, eyes, body] = await bring(join(BODIES, file));
    const skin = body!.getSkin()!;
    for (const primitive of body!.getMesh()!.listPrimitives()) cutHead(primitive, skin);
    const material = body!.getMesh()!.listPrimitives()[0]!.getMaterial()!;
    // The texture the body came with may not be the light one: swap in the head's own skin.
    const skinTexture = out.createTexture(HEAD_SKIN[head]).setImage(await readFile(join(BASE, 'Base Characters', 'Textures', HEAD_SKIN[head]))).setMimeType('image/png');
    material.setBaseColorTexture(skinTexture).setName(`skin-${head}`);
    brows!.getMesh()!.listPrimitives()[0]!.getMaterial()!.setName(`hair-brows-${head}`);
    eyes!.getMesh()!.listPrimitives()[0]!.getMaterial()!.setName('eyes');
    attach(body!, head);
    attach(brows!, `brows-${head.slice(-1)}`);
    attach(eyes!, `eyes-${head.slice(-1)}`);
  }

  for (const [hair, file] of Object.entries(HAIR_PARTS)) {
    const [part] = await bring(join(HAIR, file));
    part!.getMesh()!.listPrimitives()[0]!.getMaterial()!.setName(`hair-${hair}`);
    attach(part!, hair);
  }

  // Drop whatever the merges brought along besides the two builds.
  for (const extra of out.getRoot().listScenes()) if (extra !== scene) extra.dispose();
  for (const node of out.getRoot().listNodes()) {
    if (!node.getParentNode() && !scene.listChildren().includes(node)) node.dispose();
  }

  // Flat, tintable materials: no normal or roughness maps, skin and hair grey so a colour sets them.
  for (const material of out.getRoot().listMaterials()) {
    material.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setMetallicFactor(0).setRoughnessFactor(0.85);
    const name = material.getName();
    if (name.startsWith('MI_Regular')) material.setName('skin-arms');
    else if (name.startsWith('MI_Peasant')) material.setName('outfit');
  }
  await out.transform(dedup(), prune({ keepAttributes: false }));
  for (const material of out.getRoot().listMaterials()) {
    const texture = material.getBaseColorTexture();
    if (!texture) continue;
    const name = material.getName();
    if (name.startsWith('skin') || name.startsWith('hair')) await tintable(texture, name.startsWith('skin') ? SIZES.skin : SIZES.hair);
    else await shrink(texture, name === 'eyes' ? SIZES.eyes : SIZES.other);
  }
  out.createExtension(EXTTextureWebP).setRequired(true);
  await out.transform(dedup(), prune(), unpartition());
  await io.write(join(OUT, 'characters.glb'), out);
}

async function buildAnimations() {
  const document = await io.read(ANIMATIONS);
  const root = document.getRoot();
  const wanted = new Map<string, string>(Object.entries(CLIPS).map(([ours, theirs]) => [theirs, ours]));
  for (const animation of root.listAnimations()) {
    const ours = wanted.get(animation.getName());
    if (!ours) {
      for (const sampler of animation.listSamplers()) sampler.dispose();
      animation.dispose();
      continue;
    }
    animation.setName(ours);
    for (const channel of animation.listChannels()) {
      const path = channel.getTargetPath();
      if (path === 'scale' || (path === 'translation' && !MOVING_BONES.has(channel.getTargetNode()!.getName()))) {
        channel.getSampler()?.dispose();
        channel.dispose();
      }
    }
  }
  // The library's mannequin goes; its bones stay for the clips to name.
  for (const node of root.listNodes()) {
    node.setMesh(null).setSkin(null);
  }
  for (const mesh of root.listMeshes()) mesh.dispose();
  await document.transform(prune({ keepLeaves: true }), dedup());
  await io.write(join(OUT, 'animations.glb'), document);
}

await mkdir(OUT, { recursive: true });
await buildCharacters();
await buildAnimations();
