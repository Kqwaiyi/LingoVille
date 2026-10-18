import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type Material, type Mesh, type Object3D } from 'three';
import { selectLampsOn, useGame } from '../store/index.ts';
import { characterPosition } from './Character.tsx';
import { GLASS, LAMP, litGlass, namedMaterial } from './materials.ts';
import { LAMP_BULBS, TOWN_ART_URL, WINDOW_GLASS, type ArtPiece, type Repaint, type Size } from './townArt.ts';

export type { Repaint, Size };
import type { Vec2, Vec3 } from './town.ts';

// The town's kit pieces, from `public/town/town.glb`: every building, street piece and stick of furniture is one of
// these, in palette colours and the surfaces they're made of (`materials.ts`).
useGLTF.preload(TOWN_ART_URL);

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

type TownArt = Map<string, { object: Object3D; size: Vec3 }>;
const measured = new WeakMap<Object3D, TownArt>();

/** The town art: each piece by name, and its size in metres, measured once for every piece drawn. */
function useTownArt(): TownArt {
  const { scene } = useGLTF(TOWN_ART_URL);
  if (!measured.has(scene)) {
    const pieces: TownArt = new Map();
    for (const object of scene.children) {
      const size = new Box3().setFromObject(object).getSize(new Vector3());
      pieces.set(object.name, { object, size: [size.x, size.y, size.z] });
    }
    measured.set(scene, pieces);
  }
  return measured.get(scene)!;
}

/** A piece's size in metres, as the art has it: width (x), height (y) and depth (z). */
export function usePieceSize(piece: ArtPiece): Vec3 {
  return useTownArt().get(piece)!.size;
}

/** Every piece's size in metres, for laying out many pieces at once. */
export function usePieceSizes(): (piece: ArtPiece) => Vec3 {
  const art = useTownArt();
  return useMemo(() => (piece: ArtPiece) => art.get(piece)!.size, [art]);
}

/** Where each of `length / pieceLength` pieces (at least one, each stretched a little) goes along a run centred on 0. */
export function laidAlong(length: number, pieceLength: number) {
  const count = Math.max(1, Math.round(length / pieceLength));
  const each = length / count;
  return { each, centres: Array.from({ length: count }, (_, i) => -length / 2 + (i + 0.5) * each) };
}

type PieceProps = {
  piece: ArtPiece;
  position?: Vec3;
  /** Turned about y, in radians: 0 faces +z. */
  rotation?: number;
  /** Fitted to this size in metres, before turning. Without it, the piece keeps the art's size. */
  size?: Size;
  repaint?: Repaint;
  /** For a piece with window glass: whether its place is open. Closed, the glass is dark. */
  open?: boolean;
  /** For a piece with a bulb or window glass: whether the lamps are on, which lights the bulb and an open place's glass. */
  lit?: boolean;
};

/** One kit piece, in palette colours. */
export function Piece({ piece, position = [0, 0, 0], rotation = 0, size, repaint, open = false, lit = false }: PieceProps) {
  const art = useTownArt().get(piece)!;
  const scale = size ? ([0, 1, 2] as const).map((axis) => (size[axis] ?? art.size[axis]) / art.size[axis]) : [1, 1, 1];
  const repaintKey = JSON.stringify(repaint ?? {});
  const object = useMemo(() => {
    const copy = art.object.clone(true);
    const swaps: Repaint = JSON.parse(repaintKey);
    copy.traverse((child) => {
      if (!isMesh(child)) return;
      const name = (child.material as Material).name;
      if (name === WINDOW_GLASS) child.material = !open ? GLASS.closed : lit ? litGlass(piece) : GLASS.open;
      else if (lit && name === LAMP_BULBS[piece]) child.material = LAMP;
      else child.material = namedMaterial(name, swaps);
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return copy;
  }, [art, piece, repaintKey, open, lit]);
  return <primitive object={object} position={position} rotation-y={rotation} scale={scale} />;
}

/** Something solid the Character collides with, as centre and size. What it looks like is drawn separately. */
export function Solid({ position, size }: { position: Vec3; size: Vec3 }) {
  return <CuboidCollider position={position} args={[size[0] / 2, size[1] / 2, size[2] / 2]} />;
}

/** A footprint seen from above: its centre and its width (x) and depth (z). */
export type Footprint = { centre: Vec2; size: Vec2 };
/** A point seen from above, as three.js vectors give it. */
type Point = { x: number; z: number };

/**
 * Whether the line from `from` to `to`, seen from above, crosses a footprint (grown by `margin`): clipped against the
 * footprint's sides in turn, as Liang and Barsky do. What does stands between the camera and the Character.
 */
export function crossesFootprint(from: Point, to: Point, { centre: [cx, cz], size: [w, d] }: Footprint, margin: number) {
  const [dx, dz] = [to.x - from.x, to.z - from.z];
  let [enter, leave] = [0, 1];
  const sides: [number, number][] = [
    [-dx, from.x - (cx - w / 2 - margin)],
    [dx, cx + w / 2 + margin - from.x],
    [-dz, from.z - (cz - d / 2 - margin)],
    [dz, cz + d / 2 + margin - from.z],
  ];
  for (const [p, q] of sides) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter > leave) return false;
  }
  return true;
}

/**
 * One kit piece among many drawn together (`Instances`): where it stands, how it's turned, sized and repainted, as a
 * `Piece` takes them. `lit` lights its window glass and bulb once the lamps are on; `lift` names the footprint (an
 * index into `lifts`) it lifts off with while that stands between the camera and the Character.
 */
export type Placement = { piece: ArtPiece; position: Vec3; rotation?: number; size?: Size; repaint?: Repaint; lit?: boolean; lift?: number };

const HIDDEN = new Matrix4().makeScale(0, 0, 0);
/**
 * How far round a lifting footprint the camera's line still lifts it: past everything upstairs that stands proud of the
 * walls (the roof's overhang, the parapets, the window boxes), and under the 0.37 m the Character keeps from a wall, so
 * walking along a building's front doesn't lift its floors off and on.
 */
const LIFT_MARGIN = 0.3;
/** Once lifted, a footprint stays lifted until the camera's line is this much further clear of it, so a line that runs
 * along its edge doesn't pop it off and on from frame to frame. */
const LIFT_HYSTERESIS = 0.15;

const parts = new WeakMap<Object3D, { geometry: BufferGeometry; local: Matrix4; name: string }[]>();
/** A piece's size, and its meshes: each one's geometry, where it stands in the piece, and its material's name. */
function partsOf(art: TownArt, piece: ArtPiece) {
  const { object, size } = art.get(piece)!;
  if (!parts.has(object)) {
    object.updateWorldMatrix(true, true);
    const root = object.matrixWorld.clone().invert();
    const meshes: { geometry: BufferGeometry; local: Matrix4; name: string }[] = [];
    object.traverse((child) => {
      if (isMesh(child)) meshes.push({ geometry: child.geometry, local: root.clone().multiply(child.matrixWorld), name: (child.material as Material).name });
    });
    parts.set(object, meshes);
  }
  return { size, meshes: parts.get(object)! };
}

type Batch = { mesh: InstancedMesh; matrices: Matrix4[]; lifts: (number | undefined)[]; glass: boolean; bulb: boolean; lit: boolean; material: Material; piece: ArtPiece };

/**
 * Many kit pieces drawn as one instanced mesh per piece and colour: the town's scenery, its houses, trees and street
 * furniture, in a handful of draw calls. Nothing here is solid; colliders are the caller's.
 */
export function Instances({ placements, lifts = [], liftMargin = LIFT_MARGIN }: { placements: readonly Placement[]; lifts?: readonly Footprint[]; liftMargin?: number }) {
  const art = useTownArt();
  const lampsOn = useGame(selectLampsOn);
  const batches = useMemo(() => {
    // Batched by mesh, not by piece: a piece's parts that aren't repainted (its trim, its frames) are drawn together
    // across every repaint of it, and only glass and bulbs care whether they light up.
    const byKey = new Map<string, { geometry: BufferGeometry; material: Material; piece: ArtPiece; glass: boolean; bulb: boolean; lit: boolean; matrices: Matrix4[]; lifts: (number | undefined)[] }>();
    const turn = new Quaternion();
    const up = new Vector3(0, 1, 0);
    for (const { piece, position, rotation = 0, size: fit, repaint = {}, lit = false, lift } of placements) {
      const { size, meshes } = partsOf(art, piece);
      const scale = fit ? ([0, 1, 2] as const).map((axis) => (fit[axis] ?? size[axis]) / size[axis]) : [1, 1, 1];
      const placed = new Matrix4().compose(new Vector3(...position), turn.setFromAxisAngle(up, rotation), new Vector3(...scale));
      meshes.forEach(({ geometry, local, name }, i) => {
        const glass = name === WINDOW_GLASS;
        const bulb = LAMP_BULBS[piece] === name;
        const material = glass ? GLASS.open : namedMaterial(name, repaint);
        const key = `${piece}|${i}|${material.name}|${(glass || bulb) && lit}`;
        const batch = byKey.get(key) ?? byKey.set(key, { geometry, material, piece, glass, bulb, lit: (glass || bulb) && lit, matrices: [], lifts: [] }).get(key)!;
        batch.matrices.push(placed.clone().multiply(local));
        batch.lifts.push(lift);
      });
    }
    return [...byKey.values()].map(({ geometry, material, piece, glass, bulb, lit, matrices, lifts }): Batch => {
      const mesh = new InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return { mesh, matrices, lifts, glass, bulb, lit, material, piece };
    });
  }, [art, placements]);
  useEffect(() => () => batches.forEach(({ mesh }) => mesh.dispose()), [batches]);

  // Window glass is clear by day and dark at night, unless it's lit; bulbs that light up glow once the lamps are on.
  useEffect(() => {
    for (const { mesh, glass, bulb, lit, material, piece } of batches) {
      if (glass) mesh.material = lit && lampsOn ? litGlass(piece) : lampsOn ? GLASS.closed : GLASS.open;
      else if (bulb) mesh.material = lit && lampsOn ? LAMP : material;
    }
  }, [batches, lampsOn]);

  // What stands in the camera's way lifts off, as a roof does.
  const lifted = useRef('');
  useFrame(({ camera }) => {
    if (lifts.length === 0) return;
    const target = characterPosition;
    const inTheWay = lifts.map((footprint, i) => crossesFootprint(camera.position, target, footprint, liftMargin + (lifted.current[i] === '1' ? LIFT_HYSTERESIS : 0)));
    const key = inTheWay.map(Number).join('');
    if (key === lifted.current) return;
    lifted.current = key;
    for (const { mesh, matrices, lifts: liftOf } of batches) {
      if (liftOf.every((lift) => lift === undefined)) continue;
      matrices.forEach((matrix, i) => {
        const lift = liftOf[i];
        mesh.setMatrixAt(i, lift !== undefined && inTheWay[lift] ? HIDDEN : matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return batches.map(({ mesh }, i) => <primitive key={i} object={mesh} />);
}
