/**
 * Builds the town art, `public/town/town.glb`, from Kenney's CC0 kits: one node per piece the town asks for
 * (`TOWN_PIECES` in `src/world/townArt.ts`), in metres, standing on the ground and centred on its footprint, and one
 * per Culture Pack prop (`PROP_IDS`), put together in `scripts/town-props.ts`.
 *
 * Every colour is snapped to the one shared palette (`src/world/palette.ts`): a textured kit's colour map is read under
 * each triangle, a plain kit's material colour is taken as it is, and either becomes the nearest palette colour. Each
 * material is a palette colour and a surface (`src/world/surfaces.ts`), named `colour:surface` (or just `colour`, matte),
 * with no textures: the game draws each surface's detail itself. The town's own Blender pieces name their surfaces;
 * the kits' pieces get theirs from `scripts/town-surfaces.ts`. Window glass keeps a material of its own, `window`, which
 * the game lights while a place is open. Faces meeting at a shallow angle are shaded as one curve, sharper ones as edges.
 *
 * The kits are free downloads (CC0), too big to keep in the repo. Download each from its page's "Download" link (or
 * `scripts/fetch-itch.ts` on kenney.itch.io), unzip each into a folder named for its page, all in one folder, and pass it.
 * Without the folder, or with a kit missing from it, a piece that needs a missing kit is carried over from the
 * `public/town/town.glb` already built, its surfaces and shading made afresh: so the town's own pieces can be rebuilt
 * without downloading the kits:
 * - building-kit: https://kenney.nl/assets/building-kit
 * - city-kit-roads: https://kenney.nl/assets/city-kit-roads
 * - train-kit: https://kenney.nl/assets/train-kit
 * - furniture-kit: https://kenney.nl/assets/furniture-kit
 * - nature-kit: https://kenney.nl/assets/nature-kit
 * - food-kit: https://kenney.nl/assets/food-kit
 * - fantasy-town-kit: https://kenney.nl/assets/fantasy-town-kit
 *
 * What no kit has is modelled for the town in Blender, and kept in the repo: `art/town/glb/`, exported from
 * `art/town/town.blend` by `art/town/pieces.py` (see `art/town/README.md`), read here as the `town-art` kit. Its
 * pieces and the rest of the scenery are put together in `scripts/town-scenery.ts`.
 *
 * `npm run build:town -- [folder]`
 */
import { Document, NodeIO, type Material, type Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld } from '@gltf-transform/functions';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { PALETTE, type PaletteColour } from '../src/world/palette.ts';
import { fromLinear, hexRgb, nearest, toLinear, type Rgb } from './palette.ts';
import { materialName, SURFACE_LOOKS, type Surface } from '../src/world/surfaces.ts';
import { TOWN_ART_URL, WINDOW_GLASS, type ArtPiece, type SceneryPiece, type TownMaterial, type TownPiece } from '../src/world/townArt.ts';
import { PROP_PARTS } from './town-props.ts';
import { SCENERY_PARTS } from './town-scenery.ts';
import { PIECE_SURFACES, SMOOTH_ANGLE, SMOOTHER } from './town-surfaces.ts';

/** The folder the Kenney kits were unzipped into, if any. */
const source = process.argv[2];

type Kit = 'building-kit' | 'city-kit-roads' | 'train-kit' | 'furniture-kit' | 'nature-kit' | 'food-kit' | 'fantasy-town-kit' | 'town-art';

/** The town's own pieces, made in Blender: kept in the repo, not downloaded. */
const TOWN_ART = join('art', 'town', 'glb');
export type Vec3 = [number, number, number];

/**
 * One kit model in a piece. It is turned (`turns`, quarter turns about y, anticlockwise from above), then stood on the
 * ground and centred on its footprint, then sized (`scale`, or `fit` to an exact size in metres) and moved (`at`).
 * `flip` turns it upside down first. `glass` makes the model's glass the window glass. `repaint` swaps palette colours
 * after snapping; `paint` makes the whole model one palette colour instead. `surface` makes it all one surface.
 */
export type Part = {
  kit: Kit;
  model: string;
  turns?: number;
  flip?: boolean;
  scale?: number | Vec3;
  fit?: Vec3;
  at?: Vec3;
  glass?: boolean;
  repaint?: Partial<Record<PaletteColour, PaletteColour>>;
  paint?: PaletteColour;
  surface?: Surface;
};

/** Kenney's furniture and nature kits store their material colours as sRGB, where glTF expects linear. */
const SRGB_FACTORS = new Set<Kit>(['furniture-kit', 'nature-kit']);

const METAL_COLOURS = { lavender: 'slate', stone: 'slate', charcoal: 'slate', sky: 'white', cream: 'white' } as const;
/** The nature kit's aqua leaves and grass, made leaf green; its bark, wood. */
const NATURE_COLOURS = { mint: 'leaf', teal: 'leaf', grass: 'leaf', peach: 'wood', terracotta: 'wood' } as const;

/** Kenney's furniture and nature kits are modelled small: this brings them to life size. */
const FURNITURE_SCALE = 2.3;
const NATURE_SCALE = 2.6;
const art = (model: string, extra: Omit<Part, 'kit' | 'model'> = {}): Part => ({ kit: 'town-art', model, ...extra });

const TOWN: Record<Exclude<TownPiece, SceneryPiece>, Part[]> = {
  // The buildings, modelled in Blender (`art/town/architecture.py`).
  wall: [art('wall')],
  'wall-window': [art('wall-window', { glass: true })],
  'wall-doorway': [art('wall-doorway')],
  door: [art('door', { glass: true })],
  floor: [art('floor')],
  'roof-gable': [art('roof-gable')],
  'roof-gable-end': [art('roof-gable-end')],
  'roof-flat': [art('roof-flat')],
  'roof-edge': [art('roof-edge')],
  quoin: [art('quoin')],
  downpipe: [art('downpipe')],
  rail: [art('rail')],
  'street-light': [art('street-light')],
  'stop-pole': [art('stop-pole')],
  'shelter-post': [art('shelter-post')],
  'shelter-roof': [art('shelter-roof')],
  // Trees and shrubs, modelled in Blender (`art/town/nature.py`).
  'tree-round': [art('tree-round')],
  'tree-oak': [art('tree-oak')],
  'tree-tall': [art('tree-tall')],
  bush: [art('bush')],
  // Flowers at about knee height.
  'flowers-red': [{ kit: 'nature-kit', model: 'flower_redA', scale: NATURE_SCALE * 0.6, repaint: NATURE_COLOURS }],
  'flowers-yellow': [{ kit: 'nature-kit', model: 'flower_yellowA', scale: NATURE_SCALE * 0.6, repaint: NATURE_COLOURS }],
  'flowers-purple': [{ kit: 'nature-kit', model: 'flower_purpleA', scale: NATURE_SCALE * 0.6, repaint: NATURE_COLOURS }],
  bench: [art('bench')],
  // Furniture modelled in Blender (`art/town/furnishings.py`), and some still from the kit.
  counter: [art('counter')],
  shelf: [{ kit: 'furniture-kit', model: 'bookcaseOpen', scale: FURNITURE_SCALE }],
  bookcase: [{ kit: 'furniture-kit', model: 'bookcaseClosed', scale: FURNITURE_SCALE }],
  table: [art('table')],
  bed: [art('bed')],
  sink: [art('sink')],
  stove: [art('stove')],
  fridge: [art('fridge')],
  'cushioned-bench': [{ kit: 'furniture-kit', model: 'benchCushion', scale: FURNITURE_SCALE }],
  plant: [art('plant')],
  rug: [art('rug')],
  // No kit has a running machine: a belt on a low base, with a handrail and a console at its front (+z).
  treadmill: [
    { kit: 'city-kit-roads', model: 'tile-low', fit: [0.8, 0.12, 1.8] },
    { kit: 'building-kit', model: 'column-thin', fit: [0.08, 1.1, 0.08], at: [-0.36, 0, 0.8], repaint: METAL_COLOURS },
    { kit: 'building-kit', model: 'column-thin', fit: [0.08, 1.1, 0.08], at: [0.36, 0, 0.8], repaint: METAL_COLOURS },
    { kit: 'building-kit', model: 'column-thin', turns: 1, fit: [0.8, 0.08, 0.08], at: [0, 1.06, 0.8], repaint: METAL_COLOURS },
    { kit: 'furniture-kit', model: 'computerScreen', turns: 2, fit: [0.5, 0.3, 0.08], at: [0, 1.12, 0.84] },
  ],
};

const PIECES: Record<ArtPiece, Part[]> = { ...TOWN, ...SCENERY_PARTS, ...PROP_PARTS };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ sharp });

/** Whether a kit's models are here to build from: the town's own always are, Kenney's if they were unzipped. */
const hasKit = (kit: Kit) => kit === 'town-art' || (source !== undefined && existsSync(join(source, kit)));

/** A kit model's file: the GLB, wherever its kit keeps them. */
function modelPath(kit: Kit, model: string) {
  if (kit === 'town-art') return join(TOWN_ART, `${model}.glb`);
  for (const folder of ['GLB format', 'GLTF format']) {
    const path = join(source!, kit, 'Models', folder, `${model}.glb`);
    if (existsSync(path)) return path;
  }
  throw new Error(`No ${model}.glb in ${kit}.`);
}

/** Triangles by material, as flat lists of corner positions (x, y, z per corner). */
type Triangles = Map<TownMaterial, number[]>;

const decoded = new Map<Uint8Array, Promise<{ data: Buffer; width: number; height: number }>>();
/** A texture's pixels, as RGBA bytes, decoded once. */
function pixels(image: Uint8Array) {
  if (!decoded.has(image)) {
    decoded.set(image, sharp(Buffer.from(image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }).then(({ data, info }) => ({ data, width: info.width, height: info.height })));
  }
  return decoded.get(image)!;
}

/** How a material colours a triangle: by its colour map under the triangle's middle, or its own colour (`srgb` if the kit stored it so). */
async function colourOf(material: Material | null, srgb: boolean): Promise<(uv: [number, number]) => Rgb> {
  const factor = material?.getBaseColorFactor() ?? [1, 1, 1, 1];
  const tint = (srgb ? factor.slice(0, 3) : factor.slice(0, 3).map(fromLinear)) as unknown as Rgb;
  const image = material?.getBaseColorTexture()?.getImage();
  if (!image) return () => tint;
  const { data, width, height } = await pixels(image);
  return ([u, v]) => {
    const x = Math.min(width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * height)));
    const at = (y * width + x) * 4;
    return [(data[at]! / 255) * tint[0], (data[at + 1]! / 255) * tint[1], (data[at + 2]! / 255) * tint[2]];
  };
}

/** Applies a node's world matrix (column-major 4×4) to a point. */
function transform(m: readonly number[], [x, y, z]: number[]): Vec3 {
  return [m[0]! * x! + m[4]! * y! + m[8]! * z! + m[12]!, m[1]! * x! + m[5]! * y! + m[9]! * z! + m[13]!, m[2]! * x! + m[6]! * y! + m[10]! * z! + m[14]!];
}

/** One part's triangles, coloured from the palette, turned, stood on the ground, sized and moved. */
async function bakePart(part: Part): Promise<Triangles> {
  const document = await io.read(modelPath(part.kit, part.model));
  const triangles: Triangles = new Map();
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0]!;
  const nodes: Node[] = [];
  scene.traverse((node) => void nodes.push(node));
  for (const node of nodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const matrix = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial();
      const isGlass = part.glass && material?.getName() === 'glass';
      // The town's own pieces name their surface after their colour: `colour:surface`.
      const named = material?.getName().split(':')[1];
      const surface = part.surface ?? (named && named in SURFACE_LOOKS ? (named as Surface) : undefined);
      const colourAt = await colourOf(material, SRGB_FACTORS.has(part.kit));
      const position = primitive.getAttribute('POSITION')!;
      const uvs = primitive.getAttribute('TEXCOORD_0');
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : position.getCount();
      for (let i = 0; i < count; i += 3) {
        const corners = [0, 1, 2].map((k) => (indices ? indices.getScalar(i + k) : i + k));
        const uv = [0, 1].map((axis) => (uvs ? corners.reduce((sum, corner) => sum + uvs.getElement(corner, [])[axis]!, 0) / 3 : 0)) as [number, number];
        const snapped = nearest(colourAt(uv));
        const colour = part.paint ?? part.repaint?.[snapped] ?? snapped;
        const name: TownMaterial = isGlass ? WINDOW_GLASS : surface ? materialName(colour, surface) : colour;
        const list = triangles.get(name) ?? triangles.set(name, []).get(name)!;
        for (const corner of corners) list.push(...transform(matrix, position.getElement(corner, [])));
      }
    }
  }

  // Upside down: mirrored top to bottom, each triangle's corners reversed so it still faces out.
  if (part.flip) {
    for (const list of triangles.values()) {
      for (let i = 0; i < list.length; i += 9) {
        for (let k = 1; k < 9; k += 3) list[i + k] = -list[i + k]!;
        for (let k = 0; k < 3; k++) [list[i + 3 + k], list[i + 6 + k]] = [list[i + 6 + k]!, list[i + 3 + k]!];
      }
    }
  }

  const turn = ((part.turns ?? 0) * Math.PI) / 2;
  const [cos, sin] = [Math.round(Math.cos(turn)), Math.round(Math.sin(turn))];
  const all = [...triangles.values()];
  // Turned anticlockwise seen from above: +x goes to -z.
  for (const list of all) {
    for (let i = 0; i < list.length; i += 3) [list[i], list[i + 2]] = [cos * list[i]! + sin * list[i + 2]!, -sin * list[i]! + cos * list[i + 2]!];
  }
  const [min, max] = bounds(all);
  const size = [0, 1, 2].map((axis) => max[axis]! - min[axis]!);
  const scale = part.fit ? part.fit.map((wanted, axis) => wanted / size[axis]!) : typeof part.scale === 'number' ? [part.scale, part.scale, part.scale] : (part.scale ?? [1, 1, 1]);
  const centre = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  const at = part.at ?? [0, 0, 0];
  for (const list of all) {
    for (let i = 0; i < list.length; i++) list[i] = (list[i]! - centre[i % 3]!) * scale[i % 3]! + at[i % 3]!;
  }
  return triangles;
}

function bounds(lists: number[][]): [Vec3, Vec3] {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const list of lists) {
    for (let i = 0; i < list.length; i++) {
      min[i % 3] = Math.min(min[i % 3]!, list[i]!);
      max[i % 3] = Math.max(max[i % 3]!, list[i]!);
    }
  }
  return [min, max];
}

/**
 * The normal at each triangle's corners: where faces meet at less than `angle` degrees, their normals are averaged
 * there (weighted by size), so they shade as one curve; at a sharper angle each keeps its own, and the edge shows.
 */
function smoothNormals(positions: number[], angle: number) {
  const faces: Vec3[] = [];
  for (let i = 0; i < positions.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(i, i + 9) as number[];
    const [ux, uy, uz, vx, vy, vz] = [bx! - ax!, by! - ay!, bz! - az!, cx! - ax!, cy! - ay!, cz! - az!];
    faces.push([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
  }
  const unit = faces.map((n): Vec3 => {
    const length = Math.hypot(...n) || 1;
    return [n[0] / length, n[1] / length, n[2] / length];
  });
  // The triangles at each corner position.
  const key = (at: number) => [0, 1, 2].map((k) => Math.round(positions[at + k]! * 1e4)).join();
  const touching = new Map<string, number[]>();
  for (let corner = 0; corner < positions.length / 3; corner++) {
    const at = key(corner * 3);
    (touching.get(at) ?? touching.set(at, []).get(at)!).push(Math.floor(corner / 3));
  }
  const within = Math.cos((angle * Math.PI) / 180);
  const normals: number[] = [];
  for (let corner = 0; corner < positions.length / 3; corner++) {
    const face = Math.floor(corner / 3);
    const [fx, fy, fz] = unit[face]!;
    const sum = [0, 0, 0];
    for (const other of new Set(touching.get(key(corner * 3)))) {
      const [ox, oy, oz] = unit[other]!;
      if (fx * ox + fy * oy + fz * oz < within) continue;
      for (let k = 0; k < 3; k++) sum[k]! += faces[other]![k]!;
    }
    // A sliver of a triangle, with no direction of its own, takes its neighbours' (or faces up): never no normal at all.
    if (Math.hypot(...sum) < 1e-12) for (const other of new Set(touching.get(key(corner * 3)))) for (let k = 0; k < 3; k++) sum[k]! += faces[other]![k]!;
    if (Math.hypot(...sum) < 1e-12) sum[1] = 1;
    const length = Math.hypot(...sum);
    normals.push(sum[0]! / length, sum[1]! / length, sum[2]! / length);
  }
  return normals;
}

/** A piece's triangles as the town art already built has them, to carry over a piece whose kit isn't here. */
async function builtBefore(): Promise<Map<string, Triangles>> {
  const pieces = new Map<string, Triangles>();
  const path = join('public', TOWN_ART_URL);
  if (!existsSync(path)) return pieces;
  const built = await io.read(path);
  for (const node of built.getRoot().getDefaultScene()?.listChildren() ?? []) {
    const triangles: Triangles = new Map();
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const position = primitive.getAttribute('POSITION')!;
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : position.getCount();
      const name = primitive.getMaterial()!.getName() as TownMaterial;
      const list = triangles.get(name) ?? triangles.set(name, []).get(name)!;
      for (let i = 0; i < count; i++) list.push(...position.getElement(indices ? indices.getScalar(i) : i, []));
    }
    pieces.set(node.getName(), triangles);
  }
  return pieces;
}

/** A piece's kit materials, given the surfaces `town-surfaces.ts` says they are. Materials with a surface already keep it. */
function withSurfaces(piece: ArtPiece, triangles: Triangles): Triangles {
  const surfaces = PIECE_SURFACES[piece] ?? {};
  const named: Triangles = new Map();
  for (const [name, list] of triangles) {
    const surface = name in PALETTE ? surfaces[name as PaletteColour] : undefined;
    const renamed = surface ? materialName(name as PaletteColour, surface) : name;
    (named.get(renamed) ?? named.set(renamed, []).get(renamed)!).push(...list);
  }
  return named;
}

async function buildTown() {
  const out = new Document();
  const buffer = out.createBuffer();
  const scene = out.createScene('town');
  out.getRoot().setDefaultScene(scene);
  const materials = new Map<TownMaterial, Material>();
  const materialFor = (name: TownMaterial) => {
    if (!materials.has(name)) {
      const [colour, surface = 'matte'] = (name === WINDOW_GLASS ? 'sky' : name).split(':') as [PaletteColour, Surface?];
      const { roughness, metalness } = SURFACE_LOOKS[surface];
      const [r, g, b] = hexRgb(PALETTE[colour]).map(toLinear);
      materials.set(name, out.createMaterial(name).setBaseColorFactor([r!, g!, b!, 1]).setMetallicFactor(metalness).setRoughnessFactor(roughness));
    }
    return materials.get(name)!;
  };

  const before = await builtBefore();
  for (const [piece, parts] of Object.entries(PIECES) as [ArtPiece, Part[]][]) {
    let triangles: Triangles = new Map();
    const carried = !parts.every((part) => hasKit(part.kit));
    if (carried) {
      if (!before.has(piece)) throw new Error(`${piece} needs ${parts.map((part) => part.kit).filter((kit) => !hasKit(kit)).join(', ')}, which isn't here, and there's no town.glb to carry it over from.`);
      triangles = before.get(piece)!;
    } else {
      for (const part of parts) {
        for (const [name, list] of await bakePart(part)) (triangles.get(name) ?? triangles.set(name, []).get(name)!).push(...list);
      }
    }
    triangles = withSurfaces(piece, triangles);
    const mesh = out.createMesh(piece);
    for (const [name, positions] of triangles) {
      const accessor = (array: number[]) => out.createAccessor().setType('VEC3').setArray(new Float32Array(array)).setBuffer(buffer);
      const normals = smoothNormals(positions, SMOOTHER[piece] ?? SMOOTH_ANGLE);
      mesh.addPrimitive(out.createPrimitive().setAttribute('POSITION', accessor(positions)).setAttribute('NORMAL', accessor(normals)).setMaterial(materialFor(name)));
    }
    scene.addChild(out.createNode(piece).setMesh(mesh));
    const [min, max] = bounds([...triangles.values()]);
    console.log(piece.padEnd(16), carried ? 'carried' : 'built  ', [0, 1, 2].map((axis) => (max[axis]! - min[axis]!).toFixed(2)).join(' × '), [...triangles.keys()].join(' '));
  }
  await out.transform(weld());
  await mkdir(join('public', TOWN_ART_URL, '..'), { recursive: true });
  await io.write(join('public', TOWN_ART_URL), out);
}

await buildTown();
