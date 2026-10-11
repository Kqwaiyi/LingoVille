import { useFrame } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import { selectIsOpen, selectLampsOn, useGame } from '../store/index.ts';
import { characterPosition } from './Character.tsx';
import { Instances, laidAlong, Piece, Solid, usePieceSize, usePieceSizes, type Placement, type Repaint } from './Kit.tsx';
import { BUILDINGS, DECOR, FURNITURE, placeAt, SOLIDS, WALL, type Building, type Vec2, type Vec3 } from './town.ts';
import { KIT_FACADE, KIT_ROOF, type ArtPiece } from './townArt.ts';

/** How near the doorway the Character can be before a closing door would shut on them. */
const DOORWAY_CLEARANCE = 1.5;
/** Wall pieces are this long in the kit; a run of them is stretched a little to fit its wall. */
export const WALL_PIECE_LENGTH = 2;
/** How far a roof reaches past the walls, and how steep a gable roof is (its height over the building's depth). */
export const ROOF = { overhang: 0.2, pitch: 0.28, gableEnd: 0.6 } as const;
/** How thick a building's floor is: just proud of the ground. */
const FLOOR_THICKNESS = 0.015;
/** The band between storeys, standing just proud of the wall. */
const BAND = { height: 0.14, proud: 0.06 } as const;
/** An awning over a window, its top just under the name board, and how far it may reach towards the door before it would. */
const AWNING = { top: 2.35, height: 0.62, clearOfBoard: 2.75 } as const;
/** A lantern either side of the front door, over head height. */
export const DOOR_LAMP = { out: 1.25, height: 1.95 } as const;

/** Which pieces of a wall run are windows: none, the one in the middle, or every one. */
export type Windows = 'none' | 'middle' | 'all';

/** Where the middle piece of a run of wall pieces stands, along the run: the one that's a window. */
export function middleOfRun(length: number) {
  const { centres } = laidAlong(length, WALL_PIECE_LENGTH);
  return centres[Math.floor(centres.length / 2)]!;
}

/**
 * A straight run of wall pieces, centred on `centre` and `length` long, turned by `rotation`. Its windows are clear
 * while `open`, and lit too once the lamps are on.
 */
function WallRun({ centre: [x, z], y = 0, length, rotation = 0, windows = 'none', open = false, repaint }: { centre: Vec2; y?: number; length: number; rotation?: number; windows?: Windows; open?: boolean; repaint: Repaint }) {
  const lampsOn = useGame(selectLampsOn);
  const { each, centres } = laidAlong(length, WALL_PIECE_LENGTH);
  return (
    <group position={[x, y, z]} rotation-y={rotation}>
      {centres.map((along, i) => {
        const isWindow = windows === 'all' || (windows === 'middle' && i === Math.floor(centres.length / 2));
        return (
          <Piece
            key={i}
            piece={isWindow ? 'wall-window' : 'wall'}
            position={[along, 0, 0]}
            size={[each, null, null]}
            repaint={repaint}
            open={isWindow && open}
            lit={isWindow && lampsOn}
          />
        );
      })}
    </group>
  );
}

/** A building's walls, floor and front door. The front wall has the door in its middle and a window either side. */
function Walls({ building }: { building: Building }) {
  const open = useGame(selectIsOpen(building.placeId));
  const [doorway] = usePieceSize('wall-doorway');
  const { centre: [cx, cz], size: [w, d], facing } = building;
  const t = WALL.thickness;
  const front = cz + facing * (d / 2 - t / 2);
  const back = cz - facing * (d / 2 - t / 2);
  // Either side of the door: the wall pieces run up to the doorway piece's frame; what's solid, up to the opening.
  const run = (w - doorway) / 2;
  const solidRun = (w - WALL.doorWidth) / 2;
  const turn = facing === 1 ? 0 : Math.PI;
  const repaint: Repaint = { [KIT_FACADE]: building.facade };

  return (
    <>
      <Piece piece="floor" position={[cx, 0, cz]} size={[w, FLOOR_THICKNESS, d]} />
      <WallRun centre={[cx, back]} length={w} rotation={turn + Math.PI} repaint={repaint} />
      <WallRun centre={[cx - w / 2 + t / 2, cz]} length={d - 2 * t} rotation={-Math.PI / 2} repaint={repaint} />
      <WallRun centre={[cx + w / 2 - t / 2, cz]} length={d - 2 * t} rotation={Math.PI / 2} repaint={repaint} />
      <WallRun centre={[cx - w / 2 + run / 2, front]} length={run} rotation={turn} windows="middle" open={open} repaint={repaint} />
      <WallRun centre={[cx + w / 2 - run / 2, front]} length={run} rotation={turn} windows="middle" open={open} repaint={repaint} />
      <Piece piece="wall-doorway" position={[cx, 0, front]} rotation={turn} repaint={repaint} />

      <Solid position={[cx, WALL.height / 2, back]} size={[w, WALL.height, t]} />
      <Solid position={[cx - w / 2 + t / 2, WALL.height / 2, cz]} size={[t, WALL.height, d]} />
      <Solid position={[cx + w / 2 - t / 2, WALL.height / 2, cz]} size={[t, WALL.height, d]} />
      <Solid position={[cx - w / 2 + solidRun / 2, WALL.height / 2, front]} size={[solidRun, WALL.height, t]} />
      <Solid position={[cx + w / 2 - solidRun / 2, WALL.height / 2, front]} size={[solidRun, WALL.height, t]} />
      <ClosedDoor building={building} front={front} rotation={turn} />
      <Frontage building={building} run={run} front={cz + (facing * d) / 2} />
    </>
  );
}

/**
 * What dresses a building's front at street level: a lantern either side of the door, lit from dusk, and striped awnings
 * over the windows where it has them and they'd stand clear of the name board.
 */
function Frontage({ building, run, front }: { building: Building; run: number; front: number }) {
  const lampsOn = useGame(selectLampsOn);
  const { centre: [cx], size: [w], facing, awnings } = building;
  const turn = facing === 1 ? 0 : Math.PI;
  const windowX = w / 2 - run / 2 - middleOfRun(run);
  const awningFits = awnings && Math.abs(windowX) - 1 >= AWNING.clearOfBoard - 1.05;
  return (
    <>
      {[-1, 1].map((side) => (
        <Piece key={`lamp${side}`} piece="wall-lantern" position={[cx + side * DOOR_LAMP.out, DOOR_LAMP.height, front + facing * 0.05]} rotation={turn} lit={lampsOn} />
      ))}
      {awningFits &&
        [-1, 1].map((side) => (
          <Piece
            key={`awning${side}`}
            piece="awning"
            position={[cx + side * Math.abs(windowX), AWNING.top - AWNING.height, front + facing * 0.52]}
            rotation={turn}
            size={[1.9, AWNING.height, null]}
            repaint={{ red: awnings }}
          />
        ))}
    </>
  );
}

/**
 * The door of a closed place: two leaves, shut, so no one can walk in. It never shuts on the Character, though. Inside
 * at closing time (or in the doorway), they can still walk out, and only then does the door close behind them.
 */
function ClosedDoor({ building, front, rotation }: { building: Building; front: number; rotation: number }) {
  const open = useGame(selectIsOpen(building.placeId));
  const [clear, setClear] = useState(false);
  const [cx] = building.centre;
  const [leaf] = usePieceSize('door');

  useFrame(() => {
    const { x, z } = characterPosition;
    const nowClear = placeAt(x, z) !== building.placeId && Math.hypot(x - cx, z - front) > DOORWAY_CLEARANCE;
    if (nowClear !== clear) setClear(nowClear);
  });

  if (open || !clear) return null;
  return (
    <>
      {[-1, 1].map((side) => (
        <Piece key={side} piece="door" position={[cx + (side * leaf) / 2, 0, front]} rotation={rotation} />
      ))}
      <Solid position={[cx, WALL.height / 2, front]} size={[WALL.doorWidth, WALL.height, WALL.thickness / 2]} />
    </>
  );
}

/** What a building's walls and roof are laid out by: the doorway piece's width, a door leaf's, and the roof edge's depth. */
export type PieceSizes = { doorway: number; leaf: number; edgeDepth: number };
/** A building's shape and look, whether the Character can go in or not. */
export type BuildingShape = Pick<Building, 'centre' | 'size' | 'facing' | 'facade' | 'roof' | 'storeys' | 'windowBoxes'>;

/** A run of wall pieces, as `WallRun` lays them, to draw with `Instances`: centred on (x, z) at height y, turned by `rotation`. */
export function wallRunPlacements([x, z]: Vec2, y: number, length: number, rotation: number, windows: Windows, repaint: Repaint, lit: (i: number) => boolean, lift?: number): Placement[] {
  const { each, centres } = laidAlong(length, WALL_PIECE_LENGTH);
  return centres.map((along, i): Placement => {
    const isWindow = windows === 'all' || (windows === 'middle' && i === Math.floor(centres.length / 2));
    return {
      piece: isWindow ? 'wall-window' : 'wall',
      position: [x + along * Math.cos(rotation), y, z - along * Math.sin(rotation)],
      rotation,
      size: [each, null, null],
      repaint,
      lit: isWindow && lit(i),
      lift,
    };
  });
}

/**
 * The floors above a building's ground floor and its roof, to draw with `Instances`, lifting off together (`lift`) when
 * they're in the camera's way. Upstairs: windows all round, most lit at night (people live up there), flower boxes under
 * the front ones if the building has them, and a cream band under each storey. On top: a gable, its ridge along the
 * street, with a chimney; or a flat roof behind a parapet.
 */
export function upstairsAndRoof(building: BuildingShape, lift: number, { edgeDepth }: PieceSizes): Placement[] {
  const { centre: [cx, cz], size: [w, d], facing, storeys, facade, roof, windowBoxes } = building;
  const t = WALL.thickness;
  const turn = facing === 1 ? 0 : Math.PI;
  const walls: Repaint = { [KIT_FACADE]: facade };
  const front = cz + facing * (d / 2 - t / 2);
  const back = cz - facing * (d / 2 - t / 2);
  let lights = Math.round(Math.abs(cx * 7 + cz * 3));
  const lit = () => lights++ % 3 !== 0;
  const placements: Placement[] = [];
  for (let k = 1; k < storeys; k++) {
    const y = WALL.height * k;
    const band = (length: number) => [length + 2 * BAND.proud, BAND.height, edgeDepth] as const;
    for (const s of [-1, 1]) {
      placements.push({ piece: 'roof-edge', position: [cx, y - BAND.height / 2, cz + s * (d / 2 + BAND.proud - edgeDepth / 2)], size: band(w), repaint: { [KIT_FACADE]: 'cream' }, lift });
      placements.push({ piece: 'roof-edge', position: [cx + s * (w / 2 + BAND.proud - edgeDepth / 2), y - BAND.height / 2, cz], rotation: Math.PI / 2, size: band(d), repaint: { [KIT_FACADE]: 'cream' }, lift });
    }
    placements.push(
      ...wallRunPlacements([cx, front], y, w, turn, 'all', walls, lit, lift),
      ...wallRunPlacements([cx, back], y, w, turn + Math.PI, 'all', walls, lit, lift),
      ...wallRunPlacements([cx - w / 2 + t / 2, cz], y, d - 2 * t, -Math.PI / 2, 'middle', walls, lit, lift),
      ...wallRunPlacements([cx + w / 2 - t / 2, cz], y, d - 2 * t, Math.PI / 2, 'middle', walls, lit, lift),
    );
    if (windowBoxes) {
      for (const along of laidAlong(w, WALL_PIECE_LENGTH).centres) {
        placements.push({ piece: 'window-box', position: [cx + facing * along, y + 0.62, cz + facing * (d / 2 + 0.14)], rotation: turn, size: [1.1, null, null], lift });
      }
    }
  }
  const top = WALL.height * storeys;
  const [length, depth] = [w + 2 * ROOF.overhang, d + 2 * ROOF.overhang];
  const roofs: Repaint = { [KIT_ROOF]: roof.colour, [KIT_FACADE]: facade };
  if (roof.shape === 'flat') {
    placements.push({ piece: 'roof-flat', position: [cx, top, cz], size: [length, null, depth], repaint: roofs, lift });
    for (const s of [-1, 1]) {
      placements.push({ piece: 'roof-edge', position: [cx, top, cz + (s * (depth - edgeDepth)) / 2], size: [length, null, null], repaint: roofs, lift });
      placements.push({ piece: 'roof-edge', position: [cx + (s * (length - edgeDepth)) / 2, top, cz], rotation: Math.PI / 2, size: [depth, null, null], repaint: roofs, lift });
    }
  } else {
    const height = d * ROOF.pitch;
    placements.push({ piece: 'roof-gable', position: [cx, top, cz], size: [length - 2 * ROOF.gableEnd, height, depth], repaint: roofs, lift });
    for (const s of [-1, 1]) {
      placements.push({ piece: 'roof-gable-end', position: [cx + (s * (length - ROOF.gableEnd)) / 2, top, cz], rotation: s === 1 ? 0 : Math.PI, size: [ROOF.gableEnd, height, depth], repaint: roofs, lift });
    }
    placements.push({ piece: 'chimney', position: [cx + w * 0.3, top + height * 0.55, cz - facing * d * 0.1], size: [0.3, height * 0.6, 0.5], lift });
  }
  return placements;
}

/** The roof's pieces' sizes, as `upstairsAndRoof` and the fillers lay them out. */
export function usePieceSizesForBuildings(): PieceSizes {
  const [doorway] = usePieceSize('wall-doorway');
  const [leaf] = usePieceSize('door');
  const [, , edgeDepth] = usePieceSize('roof-edge');
  return useMemo(() => ({ doorway, leaf, edgeDepth }), [doorway, leaf, edgeDepth]);
}

/**
 * Every building's floors above the ground floor, and its roof. Each lifts off while it stands between the camera and
 * the Character (inside included), so they're always in view; on the title screen, off the place the save was left at.
 */
function UpstairsAndRoofs() {
  const sizes = usePieceSizesForBuildings();
  const placements = useMemo(() => BUILDINGS.flatMap((building, i) => upstairsAndRoof(building, i, sizes)), [sizes]);
  return <Instances placements={placements} lifts={BUILDINGS} liftMargin={ROOF.overhang} />;
}

/**
 * A piece of furniture filling its box: as many pieces side by side as fit along the box's length (across the way it
 * faces), each stretched a little to fill it. What's solid is the box, drawn separately.
 */
function furniturePlacements({ position: [x, y, z], size, piece, rotation = 0, height, repaint }: (typeof FURNITURE)[number], sizeOf: (piece: ArtPiece) => Vec3): Placement[] {
  const [pieceWidth] = sizeOf(piece);
  const sideways = Math.abs(Math.sin(rotation)) > 0.5;
  const [length, depth] = sideways ? [size[2], size[0]] : [size[0], size[2]];
  const { each, centres } = laidAlong(length, pieceWidth);
  return centres.map((along) => ({
    piece,
    position: [x + along * Math.cos(rotation), y - size[1] / 2, z - along * Math.sin(rotation)],
    rotation,
    size: [each, height ?? size[1], depth],
    repaint,
    lit: true,
  }));
}

/** All the furniture and set dressing, drawn together; the furniture solid to the Character. Lamps light up at night. */
function Furnishings() {
  const sizeOf = usePieceSizes();
  const placements = useMemo(
    () => [
      ...FURNITURE.flatMap((furniture) => furniturePlacements(furniture, sizeOf)),
      ...DECOR.map(({ position, piece, rotation, size, repaint }): Placement => ({ piece, position, rotation, size, repaint, lit: true })),
    ],
    [sizeOf],
  );
  return (
    <>
      <Instances placements={placements} />
      {[...FURNITURE, ...SOLIDS].map(({ position, size }) => (
        <Solid key={position.join()} position={position} size={size} />
      ))}
    </>
  );
}

/** Every building, with its furniture and set dressing: the same in every Culture Pack. */
export function Buildings() {
  return (
    <>
      {BUILDINGS.map((building) => (
        <group key={building.placeId}>
          <Walls building={building} />
        </group>
      ))}
      <UpstairsAndRoofs />
      <Furnishings />
    </>
  );
}
