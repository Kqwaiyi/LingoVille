import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { selectLampsOn, selectTramRunning, useGame } from '../store/index.ts';
import { upstairsAndRoof, usePieceSizesForBuildings, wallRunPlacements, WALL_PIECE_LENGTH, type PieceSizes } from './Buildings.tsx';
import { Instances, laidAlong, paletteMaterial, Piece, Solid, usePieceSize, type Placement, type Repaint } from './Kit.tsx';
import {
  BACKDROP,
  BOATS,
  CAFE_TERRACE,
  CANAL,
  CATENARY_POLES,
  FENCES,
  FILLERS,
  GARDEN_PROPS,
  MARKET,
  MARKET_PROPS,
  OLD_TOWN_SQUARE,
  PENNANT_POST,
  PENNANTS,
  SQUARE_PROPS,
  STREET_PROPS,
  TOWN_ENDS,
  TRACKS,
  TRAMS,
  type Filler,
  type Prop,
} from './scenery.ts';
import { GROUND, STREET, TOWN_BOUNDS, TRAM_STOPS, WALL, type Vec2 } from './town.ts';
import { KIT_FACADE, type TownPiece } from './townArt.ts';

/** Wires over the tracks, carried on the poles' arms. */
const WIRE = { height: 5.22, thickness: 0.03 } as const;

/**
 * A building nobody goes into, as kit pieces: its ground floor walls with the door shut, windows (and awnings over a
 * shop's), and the floors above and the roof as the town's own buildings have them, lifting off (`lift`) when they
 * stand in the camera's way.
 */
function fillerPlacements(f: Filler, lift: number, sizes: PieceSizes): Placement[] {
  const { centre: [cx, cz], size: [w, d], facing, facade, awnings } = f;
  const { doorway, leaf } = sizes;
  const t = WALL.thickness;
  const turn = facing === 1 ? 0 : Math.PI;
  const walls: Repaint = { [KIT_FACADE]: facade };
  let lights = Math.round(Math.abs(cx * 5 + cz));
  const lit = () => lights++ % 2 === 0;
  const front = cz + facing * (d / 2 - t / 2);
  const back = cz - facing * (d / 2 - t / 2);
  const side = (w - doorway) / 2;
  const shop = awnings !== undefined;
  const placements: Placement[] = [
    // The ground floor: the door in the middle of the front, shut, with windows either side.
    ...[-1, 1].flatMap((s) => wallRunPlacements([cx + s * (w / 2 - side / 2), front], 0, side, turn, shop ? 'all' : 'middle', walls, lit)),
    ...wallRunPlacements([cx, back], 0, w, turn + Math.PI, 'middle', walls, lit),
    ...wallRunPlacements([cx - w / 2 + t / 2, cz], 0, d - 2 * t, -Math.PI / 2, 'none', walls, lit),
    ...wallRunPlacements([cx + w / 2 - t / 2, cz], 0, d - 2 * t, Math.PI / 2, 'none', walls, lit),
    { piece: 'wall-doorway', position: [cx, 0, front], rotation: turn, repaint: walls },
    ...[-1, 1].map((s): Placement => ({ piece: 'door', position: [cx + (s * leaf) / 2, 0, front], rotation: turn })),
    ...upstairsAndRoof(f, lift, sizes),
  ];
  if (shop) {
    for (const s of [-1, 1]) {
      for (const along of laidAlong(side, WALL_PIECE_LENGTH).centres) {
        placements.push({ piece: 'awning', position: [cx + s * (w / 2 - side / 2) + along, 1.73, cz + facing * (d / 2 + 0.52)], rotation: turn, size: [1.8, 0.62, null], repaint: { red: awnings } });
      }
    }
  }
  return placements;
}

/** The buildings nobody goes into: solid, their doors shut, their upper floors lifting off when they're in the camera's way. */
function Fillers() {
  const sizes = usePieceSizesForBuildings();
  const placements = useMemo(() => FILLERS.flatMap((f, i) => fillerPlacements(f, i, sizes)), [sizes]);
  return (
    <>
      <Instances placements={placements} lifts={FILLERS} />
      {FILLERS.map(({ centre: [x, z], size: [w, d] }) => (
        <Solid key={`${x},${z}`} position={[x, WALL.height / 2, z]} size={[w, WALL.height, d]} />
      ))}
    </>
  );
}

/** Props drawn together, each solid where it says so. */
function Props({ props }: { props: readonly Prop[] }) {
  const placements = useMemo(() => props.map(({ piece, at, rotation, size, repaint, lit }): Placement => ({ piece, position: at, rotation, size, repaint, lit })), [props]);
  return (
    <>
      <Instances placements={placements} />
      {props.map(({ at: [x, y, z], solid }, i) => solid && <Solid key={i} position={[x, y + solid[1] / 2, z]} size={solid} />)}
    </>
  );
}

/** A run of pieces laid end to end from one point to another, and solid along it. */
function runOf(piece: TownPiece, [x0, z0]: Vec2, [x1, z1]: Vec2, pieceLength: number, repaint?: Repaint): Placement[] {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const rotation = Math.atan2(-(z1 - z0), x1 - x0);
  const { each, centres } = laidAlong(length, pieceLength);
  return centres.map((along) => ({
    piece,
    position: [(x0 + x1) / 2 + (along * (x1 - x0)) / length, 0, (z0 + z1) / 2 + (along * (z1 - z0)) / length],
    rotation,
    size: [each, null, null],
    repaint,
  }));
}

/**
 * The town's edges: the white fence behind the back gardens, the railing along the canal, and hedges across each end
 * of town, with the tracks left open for the trams (though not for the Character).
 */
function Edges() {
  const [fenceLength] = usePieceSize('fence');
  const [hedgeLength] = usePieceSize('hedge');
  const kerbs = [STREET.z - STREET.width / 2, STREET.z + STREET.width / 2];
  const placements = useMemo(
    () => [
      ...FENCES.flatMap(({ from, to, piece, repaint }) => runOf(piece, from, to, fenceLength, repaint)),
      ...TOWN_ENDS.flatMap((x) => [runOf('hedge', [x, TOWN_BOUNDS.z[0]], [x, kerbs[0]!], hedgeLength), runOf('hedge', [x, kerbs[1]!], [x, TOWN_BOUNDS.z[1]], hedgeLength)].flat()),
    ],
    [fenceLength, hedgeLength],
  );
  const [x0, x1] = TOWN_BOUNDS.x;
  const [z0, z1] = TOWN_BOUNDS.z;
  return (
    <>
      <Instances placements={placements} />
      <Solid position={[(x0 + x1) / 2, 1, z0]} size={[x1 - x0, 2, 0.3]} />
      <Solid position={[(x0 + x1) / 2, 1, z1]} size={[x1 - x0, 2, 0.3]} />
      {TOWN_ENDS.map((x) => (
        <Solid key={x} position={[x, 1, (z0 + z1) / 2]} size={[0.6, 2, z1 - z0]} />
      ))}
    </>
  );
}

/** Pennants strung from post to post over Old Town's square and the market. */
function Pennants() {
  const [, height] = usePieceSize('pennants');
  const posts = useMemo(() => [...new Map(PENNANTS.flat().map((post) => [post.join(), post])).values()], []);
  const placements = useMemo(
    (): Placement[] => [
      ...PENNANTS.map(([[x0, z0], [x1, z1]]): Placement => ({
        piece: 'pennants',
        position: [(x0 + x1) / 2, PENNANT_POST - 0.15 - height, (z0 + z1) / 2],
        rotation: Math.atan2(-(z1 - z0), x1 - x0),
        size: [Math.hypot(x1 - x0, z1 - z0), null, null],
      })),
      ...posts.map(([x, z]): Placement => ({ piece: 'shelter-post', position: [x, 0, z], size: [null, PENNANT_POST, null], repaint: { white: 'pine', stone: 'pine' } })),
    ],
    [height, posts],
  );
  return (
    <>
      <Instances placements={placements} />
      {posts.map(([x, z]) => (
        <Solid key={`${x},${z}`} position={[x, PENNANT_POST / 2, z]} size={[0.16, PENNANT_POST, 0.16]} />
      ))}
    </>
  );
}

/** The café's terrace: a parasol over each table, with two chairs. */
function CafeTerrace() {
  const placements = useMemo(
    () =>
      CAFE_TERRACE.flatMap(([x, z]): Placement[] => [
        { piece: 'parasol', position: [x, 0, z], repaint: { red: 'teal' } },
        { piece: 'table-round', position: [x, 0, z], size: [1, 0.78, 1] },
        { piece: 'chair', position: [x - 0.9, 0, z], rotation: Math.PI / 2, repaint: { red: 'teal' } },
        { piece: 'chair', position: [x + 0.9, 0, z], rotation: -Math.PI / 2, repaint: { red: 'teal' } },
      ]),
    [],
  );
  return (
    <>
      <Instances placements={placements} />
      {CAFE_TERRACE.map(([x, z]) => (
        <Solid key={x} position={[x, 0.45, z]} size={[2.4, 0.9, 1]} />
      ))}
    </>
  );
}

/** The tram line's poles between the tracks, and the wires over each track, running the length of the street and beyond. */
function Catenary() {
  const placements = useMemo(() => CATENARY_POLES.map((x): Placement => ({ piece: 'catenary-pole', position: [x, 0, STREET.z] })), []);
  const length = GROUND.x[1] - GROUND.x[0];
  return (
    <>
      <Instances placements={placements} />
      {CATENARY_POLES.map((x) => (
        <Solid key={x} position={[x, 2.9, STREET.z]} size={[0.25, 5.8, 0.25]} />
      ))}
      {[TRACKS.westbound, TRACKS.eastbound].map((z) => (
        <mesh key={z} position={[0, WIRE.height, z]} material={paletteMaterial('charcoal')}>
          <boxGeometry args={[length, WIRE.thickness, WIRE.thickness]} />
        </mesh>
      ))}
    </>
  );
}

/** Paving: a flat slab just proud of the ground. */
function Paving({ centre: [x, z], size: [w, d], colour, y = 0.012 }: { centre: Vec2; size: Vec2; colour: 'sand' | 'stone' | 'linen'; y?: number }) {
  return (
    <mesh position={[x, y, z]} rotation-x={-Math.PI / 2} receiveShadow material={paletteMaterial(colour)}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

/** The canal: its water below the banks, the stone walls along both sides, the promenade on the town's side, and boats moored along it. */
function Canal() {
  const [z0, z1] = CANAL.z;
  const [p0, p1] = CANAL.promenade;
  const length = GROUND.x[1] - GROUND.x[0];
  return (
    <>
      <Paving centre={[0, (p0 + p1) / 2]} size={[length, p1 - p0]} colour="stone" />
      <mesh position={[0, -CANAL.waterBelow, (z0 + z1) / 2]} rotation-x={-Math.PI / 2} receiveShadow material={paletteMaterial('teal')}>
        <planeGeometry args={[length, z1 - z0]} />
      </mesh>
      {/* The grass stops at the banks: their walls drop to the water. */}
      {[z0, z1].map((z, i) => (
        <mesh key={z} position={[0, -CANAL.waterBelow / 2 + 0.06, z + (i === 0 ? -0.2 : 0.2)]} material={paletteMaterial('stone')} receiveShadow castShadow>
          <boxGeometry args={[length, CANAL.waterBelow + 0.12, 0.4]} />
        </mesh>
      ))}
      <Props props={BOATS} />
    </>
  );
}

/** Where a tram is along its run, `t` seconds into its cycle: east from the far west end, waiting at each platform, then gone a while. */
function tramAt(t: number, stops: readonly number[]) {
  const { speed, dwell, reach } = TRAMS;
  let x = -reach;
  let left = t;
  for (const stop of [...stops, reach]) {
    const drive = (stop - x) / speed;
    if (left < drive) return x + left * speed;
    left -= drive;
    x = stop;
    if (stop === reach) return null;
    if (left < dwell) return x;
    left -= dwell;
  }
  return null;
}

/**
 * The trams, while they run: one eastbound on the south track and one westbound on the north, each stopping at the
 * platforms on its way. They're only scenery, and pass through anyone on the track.
 */
function Trams() {
  const running = useGame(selectTramRunning);
  const lampsOn = useGame(selectLampsOn);
  const east = useRef<Group>(null);
  const west = useRef<Group>(null);
  const stops = useMemo(() => Object.values(TRAM_STOPS).map(({ centre: [x] }) => x).sort((a, b) => a - b), []);
  const cycle = (2 * TRAMS.reach) / TRAMS.speed + stops.length * TRAMS.dwell + TRAMS.gap;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const place = (group: Group | null, at: number | null, z: number, direction: 1 | -1) => {
      if (!group) return;
      group.visible = at !== null;
      if (at !== null) group.position.set(direction * at, 0, z);
    };
    place(east.current, tramAt(t % cycle, stops), TRACKS.eastbound, 1);
    place(west.current, tramAt((t + cycle / 2) % cycle, stops.map((x) => -x).sort((a, b) => a - b)), TRACKS.westbound, -1);
  });
  if (!running) return null;
  return (
    <>
      <group ref={east}>
        <Piece piece="tram" lit={lampsOn} />
      </group>
      <group ref={west}>
        <Piece piece="tram" rotation={Math.PI} repaint={{ butter: 'mint' }} lit={lampsOn} />
      </group>
    </>
  );
}

/** Everything that only dresses the town: the same in every Culture Pack. */
export function Scenery() {
  return (
    <>
      <Fillers />
      <Paving centre={OLD_TOWN_SQUARE.centre} size={OLD_TOWN_SQUARE.size} colour="sand" />
      <Paving centre={MARKET.centre} size={MARKET.size} colour="sand" />
      <Props props={STREET_PROPS} />
      <Props props={SQUARE_PROPS} />
      <Props props={MARKET_PROPS} />
      <Props props={GARDEN_PROPS} />
      <Props props={BACKDROP} />
      <Pennants />
      <CafeTerrace />
      <Catenary />
      <Edges />
      <Canal />
      <Trams />
    </>
  );
}

