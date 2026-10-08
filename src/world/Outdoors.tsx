import { TRAM_LINE, type TramStopId } from '../content/index.ts';
import { laidAlong, Piece, Solid, usePieceSize } from './Kit.tsx';
import { PALETTE } from './palette.ts';
import { GROUND_HALF_SIZE, PARK, PARK_PLANTING, PLATFORM, STREET, STREET_LIGHTS, TRAM_STOPS, TREES } from './town.ts';
import type { TownPiece } from './townArt.ts';

/** The kit's road and rail pieces are this long; the street is laid with them end to end. */
const ROAD_TILE = STREET.width;
const RAIL_GAUGE = 0.8;
/** A tram stop's shelter, west of its pole: its roof's size and height, and its posts along the platform's back edge. */
const SHELTER = { centreX: -2, size: [2.6, 0.2, 1.6] as const, height: 2.4, posts: [-3.1, -0.9], postZ: -0.6 } as const;
/** How far a street light's pole stands from the middle of its piece, which reaches out over the street. */
const LIGHT_POLE_OFFSET = 0.73;
/** The park's trees, in turn. */
const TREE_KINDS: readonly TownPiece[] = ['tree-round', 'tree-oak', 'tree-tall'];

/** The grass, and the street with its tram rails down the middle. */
function Ground() {
  const [, roadThickness] = usePieceSize('road');
  const [railLength] = usePieceSize('rail');
  const length = GROUND_HALF_SIZE * 2;
  const road = laidAlong(length, ROAD_TILE);
  const rails = laidAlong(length, railLength);
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[length, length]} />
        <meshStandardMaterial color={PALETTE.grass} />
      </mesh>
      <Solid position={[0, -0.5, 0]} size={[length, 1, length]} />
      {road.centres.map((x) => (
        <Piece key={x} piece="road" position={[x, 0, STREET.z]} size={[road.each, null, STREET.width]} />
      ))}
      {rails.centres.map((x) => (
        <Piece key={x} piece="rail" position={[x, roadThickness, STREET.z]} size={[rails.each, null, RAIL_GAUGE]} />
      ))}
    </>
  );
}

/** Street lights along both sides of the street, each reaching out over it. 31b lights them at dusk. */
function StreetLights() {
  return STREET_LIGHTS.map(([x, z]) => {
    // On the north side the light reaches south, over the street; on the south side, north.
    const north = z < STREET.z;
    return (
      <group key={`${x},${z}`}>
        <Piece piece="street-light" position={[x, 0, z + (north ? LIGHT_POLE_OFFSET : -LIGHT_POLE_OFFSET)]} rotation={north ? Math.PI : 0} />
        <Solid position={[x, 2, z]} size={[0.2, 4, 0.2]} />
      </group>
    );
  });
}

/** An island platform in the middle of the street, with a stop pole and a shelter. Walked onto, not stepped up. */
function TramStop({ stopId }: { stopId: TramStopId }) {
  const [x, z] = TRAM_STOPS[stopId].centre;
  const [length, width] = PLATFORM.size;
  return (
    <group position={[x, 0, z]}>
      <Piece piece="floor" size={[length, PLATFORM.height, width]} repaint={{ linen: 'sand' }} />
      <Piece piece="stop-pole" />
      <Solid position={[0, 1.3, 0]} size={[0.12, 2.6, 0.12]} />
      <Piece
        piece="shelter-roof"
        position={[SHELTER.centreX, SHELTER.height, 0]}
        size={SHELTER.size}
        repaint={{ charcoal: 'denim' }}
      />
      {SHELTER.posts.map((postX) => (
        <group key={postX}>
          <Piece piece="shelter-post" position={[postX, 0, SHELTER.postZ]} />
          <Solid position={[postX, SHELTER.height / 2, SHELTER.postZ]} size={[0.16, SHELTER.height, 0.16]} />
        </group>
      ))}
    </group>
  );
}

/** The park: a lawn with trees, and bushes and flowers around its edges. */
function Park() {
  return (
    <>
      <mesh position={[PARK.centre[0], 0.008, PARK.centre[1]]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[...PARK.size]} />
        <meshStandardMaterial color={PALETTE.leaf} />
      </mesh>
      {TREES.map(([x, z], i) => (
        <group key={`${x},${z}`}>
          <Piece piece={TREE_KINDS[i % TREE_KINDS.length]!} position={[x, 0, z]} rotation={i} />
          <Solid position={[x, 0.9, z]} size={[0.35, 1.8, 0.35]} />
        </group>
      ))}
      {PARK_PLANTING.map(({ at: [x, z], piece }, i) => (
        <Piece key={`${x},${z}`} piece={piece} position={[x, 0, z]} rotation={i * 1.3} />
      ))}
    </>
  );
}

/** Everything outdoors: the same in every Culture Pack. */
export function Outdoors() {
  return (
    <>
      <Ground />
      <StreetLights />
      {TRAM_LINE.map((stopId) => (
        <TramStop key={stopId} stopId={stopId} />
      ))}
      <Park />
    </>
  );
}
