import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group } from 'three';
import { selectIsOpen, selectScreen, selectTitlePlaceId, useGame } from '../store/index.ts';
import { characterPosition } from './Character.tsx';
import { laidAlong, Piece, Solid, usePieceSize, type Repaint } from './Kit.tsx';
import { BUILDINGS, DECOR, FURNITURE, placeAt, WALL, type Building, type Vec2 } from './town.ts';
import { KIT_FACADE, KIT_ROOF } from './townArt.ts';

/** How near the doorway the Character can be before a closing door would shut on them. */
const DOORWAY_CLEARANCE = 1.5;
/** Wall pieces are this long in the kit; a run of them is stretched a little to fit its wall. */
const WALL_PIECE_LENGTH = 2;
/** How far a roof reaches past the walls, and how steep a gable roof is (its height over the building's depth). */
const ROOF = { overhang: 0.2, pitch: 0.28, gableEnd: 0.6 } as const;
/** How thick a building's floor is: just proud of the ground. */
const FLOOR_THICKNESS = 0.015;

/**
 * A straight run of wall pieces, centred on `centre` and `length` long, turned by `rotation`. With `windows`, the piece
 * in the middle of the run is a window, lit while the place is open.
 */
function WallRun({ centre: [x, z], length, rotation = 0, windows = false, lit = false, repaint }: { centre: Vec2; length: number; rotation?: number; windows?: boolean; lit?: boolean; repaint: Repaint }) {
  const { each, centres } = laidAlong(length, WALL_PIECE_LENGTH);
  return (
    <group position={[x, 0, z]} rotation-y={rotation}>
      {centres.map((along, i) => (
        <Piece
          key={i}
          piece={windows && i === Math.floor(centres.length / 2) ? 'wall-window' : 'wall'}
          position={[along, 0, 0]}
          size={[each, null, null]}
          repaint={repaint}
          lit={lit}
        />
      ))}
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
      <WallRun centre={[cx - w / 2 + run / 2, front]} length={run} rotation={turn} windows lit={open} repaint={repaint} />
      <WallRun centre={[cx + w / 2 - run / 2, front]} length={run} rotation={turn} windows lit={open} repaint={repaint} />
      <Piece piece="wall-doorway" position={[cx, 0, front]} rotation={turn} repaint={repaint} />

      <Solid position={[cx, WALL.height / 2, back]} size={[w, WALL.height, t]} />
      <Solid position={[cx - w / 2 + t / 2, WALL.height / 2, cz]} size={[t, WALL.height, d]} />
      <Solid position={[cx + w / 2 - t / 2, WALL.height / 2, cz]} size={[t, WALL.height, d]} />
      <Solid position={[cx - w / 2 + solidRun / 2, WALL.height / 2, front]} size={[solidRun, WALL.height, t]} />
      <Solid position={[cx + w / 2 - solidRun / 2, WALL.height / 2, front]} size={[solidRun, WALL.height, t]} />
      <ClosedDoor building={building} front={front} rotation={turn} />
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

/** A point seen from above, as three.js vectors give it. */
type Point = { x: number; z: number };

/**
 * Whether the line from `from` to `to`, seen from above, crosses a building's footprint (grown by `margin`): clipped
 * against the footprint's sides in turn, as Liang and Barsky do.
 */
function crossesFootprint(from: Point, to: Point, { centre: [cx, cz], size: [w, d] }: Building, margin: number) {
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
 * A building's roof: gabled, its ridge along the street, or flat behind a low parapet. It lifts off while it stands
 * between the camera and the Character (inside included), so they're always in view; on the title screen, off the
 * place the Character stands in.
 */
function Roof({ building }: { building: Building }) {
  const roof = useRef<Group>(null);
  const playing = useGame(selectScreen) === 'playing';
  const titlePlaceId = useGame(selectTitlePlaceId);
  const [, , edgeDepth] = usePieceSize('roof-edge');
  useFrame(({ camera }) => {
    if (!roof.current) return;
    const inTheWay = playing ? crossesFootprint(camera.position, characterPosition, building, ROOF.overhang) : titlePlaceId === building.placeId;
    roof.current.visible = !inTheWay;
  });

  const { centre: [cx, cz], size: [w, d], roof: { shape, colour } } = building;
  const [length, depth] = [w + 2 * ROOF.overhang, d + 2 * ROOF.overhang];
  const repaint: Repaint = { [KIT_ROOF]: colour, [KIT_FACADE]: building.facade };
  if (shape === 'flat') {
    return (
      <group ref={roof} position={[cx, WALL.height, cz]}>
        <Piece piece="roof-flat" size={[length, null, depth]} repaint={repaint} />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Piece piece="roof-edge" position={[0, 0, (side * (depth - edgeDepth)) / 2]} size={[length, null, null]} repaint={repaint} />
            <Piece piece="roof-edge" position={[(side * (length - edgeDepth)) / 2, 0, 0]} rotation={Math.PI / 2} size={[depth, null, null]} repaint={repaint} />
          </group>
        ))}
      </group>
    );
  }
  const height = d * ROOF.pitch;
  const middle = length - 2 * ROOF.gableEnd;
  return (
    <group ref={roof} position={[cx, WALL.height, cz]}>
      <Piece piece="roof-gable" size={[middle, height, depth]} repaint={repaint} />
      {[-1, 1].map((side) => (
        <Piece
          key={side}
          piece="roof-gable-end"
          position={[(side * (length - ROOF.gableEnd)) / 2, 0, 0]}
          rotation={side === 1 ? 0 : Math.PI}
          size={[ROOF.gableEnd, height, depth]}
          repaint={repaint}
        />
      ))}
    </group>
  );
}

/**
 * A piece of furniture filling its box: as many pieces side by side as fit along the box's length (across the way it
 * faces), each stretched a little to fill it. Solid to the Character.
 */
function Furniture({ position: [x, y, z], size, piece, rotation = 0, height }: (typeof FURNITURE)[number]) {
  const [pieceWidth] = usePieceSize(piece);
  const sideways = Math.abs(Math.sin(rotation)) > 0.5;
  const [length, depth] = sideways ? [size[2], size[0]] : [size[0], size[2]];
  const { each, centres } = laidAlong(length, pieceWidth);
  return (
    <>
      <group position={[x, y - size[1] / 2, z]} rotation-y={rotation}>
        {centres.map((along) => (
          <Piece key={along} piece={piece} position={[along, 0, 0]} size={[each, height ?? size[1], depth]} />
        ))}
      </group>
      <Solid position={[x, y, z]} size={size} />
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
          <Roof building={building} />
        </group>
      ))}
      {FURNITURE.map((furniture) => (
        <Furniture key={furniture.position.join()} {...furniture} />
      ))}
      {DECOR.map(({ position, piece, rotation }) => (
        <Piece key={position.join()} piece={piece} position={position} rotation={rotation} />
      ))}
    </>
  );
}
