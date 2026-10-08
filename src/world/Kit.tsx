import { useGLTF } from '@react-three/drei';
import { CuboidCollider } from '@react-three/rapier';
import { useMemo } from 'react';
import { Box3, MeshStandardMaterial, Vector3, type Mesh, type Object3D } from 'three';
import { PALETTE, type PaletteColour } from './palette.ts';
import { LAMP_BULBS, TOWN_ART_URL, WINDOW_GLASS, type ArtPiece } from './townArt.ts';
import type { Vec3 } from './town.ts';

// The town's kit pieces, built by `npm run build:town`: every building, street piece and stick of furniture is one of
// these, flat shaded in palette colours.
useGLTF.preload(TOWN_ART_URL);

/** Swaps one palette colour of a piece for another: how each building wears its own façade and roof. */
export type Repaint = Partial<Record<PaletteColour, PaletteColour>>;

/** A size in metres to fit a piece to, along x, y and z; `null` keeps the piece's own size along that axis. */
export type Size = readonly [x: number | null, y: number | null, z: number | null];

/** Window glass while its place is open, and while it's closed. Once the lamps are on, an open place's glass is lit. */
const GLASS = { open: 'sky', closed: 'charcoal' } as const satisfies Record<string, PaletteColour>;

/** How every material in the town is drawn: flat shaded and matte. */
const FLAT = { roughness: 0.9, flatShading: true } as const;

const materials = new Map<PaletteColour, MeshStandardMaterial>();
/** One shared material per palette colour, made once. */
function paletteMaterial(colour: PaletteColour) {
  if (!materials.has(colour)) materials.set(colour, new MeshStandardMaterial({ color: PALETTE[colour], ...FLAT }));
  return materials.get(colour)!;
}

/** Lit window glass and lit street-light bulbs: lamplight that glows, brighter as night falls. */
const LAMP = new MeshStandardMaterial({ color: PALETTE.lamplight, emissive: PALETTE.lamplight, ...FLAT });

/** How brightly lit windows and street lights glow, set by the time of day. */
export function setLampGlow(glow: number) {
  LAMP.emissiveIntensity = glow;
}

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
      const name = (child.material as MeshStandardMaterial).name;
      if (name === WINDOW_GLASS) child.material = !open ? paletteMaterial(GLASS.closed) : lit ? LAMP : paletteMaterial(GLASS.open);
      else if (lit && name === LAMP_BULBS[piece]) child.material = LAMP;
      else child.material = paletteMaterial(swaps[name as PaletteColour] ?? (name as PaletteColour));
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
