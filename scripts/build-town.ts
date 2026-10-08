/**
 * Builds the town art, `public/town/town.glb`, from Kenney's CC0 kits: one node per piece the town asks for
 * (`TOWN_PIECES` in `src/world/townArt.ts`), in metres, standing on the ground and centred on its footprint, and one
 * per Culture Pack prop (`PROP_IDS`), put together in `scripts/town-props.ts`.
 *
 * Every colour is snapped to the one shared palette (`src/world/palette.ts`): a textured kit's colour map is read under
 * each triangle, a plain kit's material colour is taken as it is, and either becomes the nearest palette colour. Each
 * palette colour is one flat material named after it, with no textures. Window glass keeps a material of its own,
 * `window`, which the game lights while a place is open.
 *
 * The kits are free downloads (CC0), too big to keep in the repo. Download each from its page's "Download" link (or
 * `scripts/fetch-itch.ts` on kenney.itch.io), unzip each into a folder named for its page, all in one folder, and pass it:
 * - building-kit: https://kenney.nl/assets/building-kit
 * - modular-buildings: https://kenney.nl/assets/modular-buildings
 * - city-kit-roads: https://kenney.nl/assets/city-kit-roads
 * - train-kit: https://kenney.nl/assets/train-kit
 * - furniture-kit: https://kenney.nl/assets/furniture-kit
 * - nature-kit: https://kenney.nl/assets/nature-kit
 * - food-kit: https://kenney.nl/assets/food-kit
 * - fantasy-town-kit: https://kenney.nl/assets/fantasy-town-kit
 *
 * `npm run build:town -- <folder>`
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
import { KIT_FACADE, KIT_ROOF, TOWN_ART_URL, WINDOW_GLASS, type ArtPiece, type TownMaterial, type TownPiece } from '../src/world/townArt.ts';
import { PROP_PARTS } from './town-props.ts';

const source = process.argv[2];
if (!source) throw new Error('Pass the folder the Kenney kits were unzipped into.');

type Kit = 'building-kit' | 'modular-buildings' | 'city-kit-roads' | 'train-kit' | 'furniture-kit' | 'nature-kit' | 'food-kit' | 'fantasy-town-kit';
export type Vec3 = [number, number, number];

/**
 * One kit model in a piece. It is turned (`turns`, quarter turns about y, anticlockwise from above), then stood on the
 * ground and centred on its footprint, then sized (`scale`, or `fit` to an exact size in metres) and moved (`at`).
 * `flip` turns it upside down first. `glass` makes the model's glass the window glass. `repaint` swaps palette colours
 * after snapping; `paint` makes the whole model one palette colour instead.
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
};

/** Kenney's furniture and nature kits store their material colours as sRGB, where glTF expects linear. */
const SRGB_FACTORS = new Set<Kit>(['furniture-kit', 'nature-kit']);

/**
 * The building kit's colour map shades each face from a gradient, so a wall's two sides snap to different greys. These
 * settle each kind of piece on one colour per surface: walls on the façade colour outside (`KIT_FACADE`, which each
 * building repaints) and cream inside, with cream frames and stone trim; roofs on the roof colour (`KIT_ROOF`, likewise).
 */
const WALL_COLOURS = { slate: KIT_FACADE, stone: KIT_FACADE, charcoal: 'cream', sky: 'cream', linen: 'cream', denim: 'stone', plum: 'stone' } as const;
const ROOF_COLOURS = { ink: KIT_ROOF, charcoal: KIT_ROOF, slate: KIT_ROOF, peach: KIT_FACADE, lavender: 'stone' } as const;
const FLAT_ROOF_COLOURS = { slate: KIT_ROOF, stone: KIT_ROOF, lavender: KIT_ROOF, charcoal: KIT_ROOF, cream: KIT_ROOF } as const;
const METAL_COLOURS = { lavender: 'slate', stone: 'slate', charcoal: 'slate', sky: 'white', cream: 'white' } as const;
/** The nature kit's aqua leaves and grass, made leaf green; its bark, wood. */
const NATURE_COLOURS = { mint: 'leaf', teal: 'leaf', grass: 'leaf', peach: 'wood', terracotta: 'wood' } as const;

/** Kenney's furniture and nature kits are modelled small: this brings them to life size. */
const FURNITURE_SCALE = 2.3;
const NATURE_SCALE = 2.6;
/** Wall pieces are 0.1 m thick, their frames 0.2 m: thickened to sit in the town's 0.3 m walls without bulging out. */
const WALL_DEPTH = 2;

const TOWN: Record<TownPiece, Part[]> = {
  wall: [{ kit: 'building-kit', model: 'wall', turns: 1, scale: [1, 1, WALL_DEPTH], repaint: WALL_COLOURS }],
  'wall-window': [{ kit: 'building-kit', model: 'wall-window-square', turns: 1, scale: [1, 1, WALL_DEPTH], glass: true, repaint: WALL_COLOURS }],
  // The wide doorway, narrowed so its opening is the town's 1.8 m door.
  'wall-doorway': [{ kit: 'building-kit', model: 'wall-doorway-wide-square', turns: 1, scale: [1.8 / 2.9, 1, WALL_DEPTH], repaint: WALL_COLOURS }],
  door: [{ kit: 'building-kit', model: 'door-rotate-square-a', turns: 1, fit: [0.9, 2.1, 0.1], repaint: { slate: 'walnut', stone: 'wood', lavender: 'wood', charcoal: 'ink' } }],
  floor: [{ kit: 'building-kit', model: 'floor', repaint: { slate: 'linen', stone: 'linen', cream: 'linen' } }],
  'roof-gable': [{ kit: 'modular-buildings', model: 'roof-gable', turns: 1, repaint: ROOF_COLOURS }],
  'roof-gable-end': [{ kit: 'modular-buildings', model: 'roof-gable-end', turns: 1, repaint: ROOF_COLOURS }],
  'roof-flat': [{ kit: 'building-kit', model: 'roof-flat-center', repaint: FLAT_ROOF_COLOURS }],
  'roof-edge': [{ kit: 'building-kit', model: 'border', turns: 1, repaint: { slate: KIT_FACADE, stone: KIT_FACADE, lavender: KIT_FACADE, charcoal: KIT_FACADE, cream: 'cream' } }],
  road: [{ kit: 'city-kit-roads', model: 'road-straight', repaint: { plum: 'slate', lavender: 'cream', slate: 'stone' } }],
  rail: [{ kit: 'train-kit', model: 'railroad-rail-straight', turns: 1, scale: 1.15, repaint: { lavender: 'stone' } }],
  'street-light': [{ kit: 'city-kit-roads', model: 'light-square', scale: 6, repaint: METAL_COLOURS }],
  'stop-pole': [{ kit: 'city-kit-roads', model: 'road-sign-empty', scale: 6, repaint: { lavender: 'denim', slate: 'denim' } }],
  'shelter-post': [{ kit: 'building-kit', model: 'column-thin', scale: [0.4, 1, 0.4], repaint: { ...METAL_COLOURS, lavender: 'white', charcoal: 'stone', slate: 'stone' } }],
  'shelter-roof': [{ kit: 'building-kit', model: 'roof-flat-center', repaint: FLAT_ROOF_COLOURS }],
  'tree-round': [{ kit: 'nature-kit', model: 'tree_default', scale: NATURE_SCALE, repaint: NATURE_COLOURS }],
  'tree-oak': [{ kit: 'nature-kit', model: 'tree_oak', scale: NATURE_SCALE * 1.2, repaint: NATURE_COLOURS }],
  'tree-tall': [{ kit: 'nature-kit', model: 'tree_tall', scale: NATURE_SCALE, repaint: NATURE_COLOURS }],
  bush: [{ kit: 'nature-kit', model: 'plant_bushDetailed', scale: NATURE_SCALE, repaint: NATURE_COLOURS }],
  'flowers-red': [{ kit: 'nature-kit', model: 'flower_redA', scale: NATURE_SCALE, repaint: NATURE_COLOURS }],
  'flowers-yellow': [{ kit: 'nature-kit', model: 'flower_yellowA', scale: NATURE_SCALE, repaint: NATURE_COLOURS }],
  'flowers-purple': [{ kit: 'nature-kit', model: 'flower_purpleA', scale: NATURE_SCALE, repaint: NATURE_COLOURS }],
  bench: [{ kit: 'furniture-kit', model: 'bench', scale: FURNITURE_SCALE }],
  counter: [{ kit: 'furniture-kit', model: 'kitchenCabinet', scale: FURNITURE_SCALE }],
  shelf: [{ kit: 'furniture-kit', model: 'bookcaseOpen', scale: FURNITURE_SCALE }],
  bookcase: [{ kit: 'furniture-kit', model: 'bookcaseClosed', scale: FURNITURE_SCALE }],
  table: [{ kit: 'furniture-kit', model: 'tableCrossCloth', scale: FURNITURE_SCALE }],
  bed: [{ kit: 'furniture-kit', model: 'bedSingle', scale: FURNITURE_SCALE }],
  sink: [{ kit: 'furniture-kit', model: 'kitchenSink', scale: FURNITURE_SCALE }],
  stove: [{ kit: 'furniture-kit', model: 'kitchenStove', scale: FURNITURE_SCALE }],
  fridge: [{ kit: 'furniture-kit', model: 'kitchenFridge', scale: FURNITURE_SCALE }],
  'cushioned-bench': [{ kit: 'furniture-kit', model: 'benchCushion', scale: FURNITURE_SCALE }],
  plant: [{ kit: 'furniture-kit', model: 'pottedPlant', scale: FURNITURE_SCALE }],
  rug: [{ kit: 'furniture-kit', model: 'rugRectangle', scale: FURNITURE_SCALE }],
  // No kit has a running machine: a belt on a low base, with a handrail and a console at its front (+z).
  treadmill: [
    { kit: 'city-kit-roads', model: 'tile-low', fit: [0.8, 0.12, 1.8] },
    { kit: 'building-kit', model: 'column-thin', fit: [0.08, 1.1, 0.08], at: [-0.36, 0, 0.8], repaint: METAL_COLOURS },
    { kit: 'building-kit', model: 'column-thin', fit: [0.08, 1.1, 0.08], at: [0.36, 0, 0.8], repaint: METAL_COLOURS },
    { kit: 'building-kit', model: 'column-thin', turns: 1, fit: [0.8, 0.08, 0.08], at: [0, 1.06, 0.8], repaint: METAL_COLOURS },
    { kit: 'furniture-kit', model: 'computerScreen', turns: 2, fit: [0.5, 0.3, 0.08], at: [0, 1.12, 0.84] },
  ],
};

const PIECES: Record<ArtPiece, Part[]> = { ...TOWN, ...PROP_PARTS };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ sharp });

/** A kit model's file: the GLB, wherever its kit keeps them. */
function modelPath(kit: Kit, model: string) {
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
      const colourAt = await colourOf(material, SRGB_FACTORS.has(part.kit));
      const position = primitive.getAttribute('POSITION')!;
      const uvs = primitive.getAttribute('TEXCOORD_0');
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : position.getCount();
      for (let i = 0; i < count; i += 3) {
        const corners = [0, 1, 2].map((k) => (indices ? indices.getScalar(i + k) : i + k));
        const uv = [0, 1].map((axis) => (uvs ? corners.reduce((sum, corner) => sum + uvs.getElement(corner, [])[axis]!, 0) / 3 : 0)) as [number, number];
        const snapped = nearest(colourAt(uv));
        const name: TownMaterial = isGlass ? WINDOW_GLASS : (part.paint ?? part.repaint?.[snapped] ?? snapped);
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

/** Each triangle's own normal at its three corners, so the faces read flat. */
function flatNormals(positions: number[]) {
  const normals: number[] = [];
  for (let i = 0; i < positions.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(i, i + 9) as number[];
    const [ux, uy, uz, vx, vy, vz] = [bx! - ax!, by! - ay!, bz! - az!, cx! - ax!, cy! - ay!, cz! - az!];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const length = Math.hypot(...n) || 1;
    for (let k = 0; k < 3; k++) normals.push(n[0]! / length, n[1]! / length, n[2]! / length);
  }
  return normals;
}

async function buildTown() {
  const out = new Document();
  const buffer = out.createBuffer();
  const scene = out.createScene('town');
  out.getRoot().setDefaultScene(scene);
  const materials = new Map<TownMaterial, Material>();
  const materialFor = (name: TownMaterial) => {
    if (!materials.has(name)) {
      const [r, g, b] = hexRgb(PALETTE[name === WINDOW_GLASS ? 'sky' : name]).map(toLinear);
      materials.set(name, out.createMaterial(name).setBaseColorFactor([r!, g!, b!, 1]).setMetallicFactor(0).setRoughnessFactor(0.9));
    }
    return materials.get(name)!;
  };

  for (const [piece, parts] of Object.entries(PIECES) as [ArtPiece, Part[]][]) {
    const triangles: Triangles = new Map();
    for (const part of parts) {
      for (const [name, list] of await bakePart(part)) (triangles.get(name) ?? triangles.set(name, []).get(name)!).push(...list);
    }
    const mesh = out.createMesh(piece);
    for (const [name, positions] of triangles) {
      const accessor = (array: number[]) => out.createAccessor().setType('VEC3').setArray(new Float32Array(array)).setBuffer(buffer);
      mesh.addPrimitive(out.createPrimitive().setAttribute('POSITION', accessor(positions)).setAttribute('NORMAL', accessor(flatNormals(positions))).setMaterial(materialFor(name)));
    }
    scene.addChild(out.createNode(piece).setMesh(mesh));
    const [min, max] = bounds([...triangles.values()]);
    console.log(piece.padEnd(16), [0, 1, 2].map((axis) => (max[axis]! - min[axis]!).toFixed(2)).join(' × '), [...triangles.keys()].join(' '));
  }
  await out.transform(weld());
  await mkdir(join('public', TOWN_ART_URL, '..'), { recursive: true });
  await io.write(join('public', TOWN_ART_URL), out);
}

await buildTown();
