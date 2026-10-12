import { useMemo } from 'react';
import { DataTexture, Path, Shape, ShapeGeometry, Vector2 } from 'three';
import { TRAM_LINE, type TramStopId } from '../content/index.ts';
import { selectLampsOn, useGame } from '../store/index.ts';
import { Instances, laidAlong, Piece, Solid, usePieceSize, type Placement } from './Kit.tsx';
import { townMaterial, WATER } from './materials.ts';
import { PALETTE, type PaletteColour } from './palette.ts';
import type { Surface } from './surfaces.ts';
import { CANAL } from './scenery.ts';
import {
  BANDSTAND,
  GROUND,
  PARK,
  PARK_PATHS,
  PARK_PLANTING,
  PARK_SIGN_POSTS,
  PLATFORM,
  POND,
  SIGNS,
  STREET,
  STREET_LIGHTS,
  TRAM_STOPS,
  TREES,
  type Vec2,
} from './town.ts';
import type { TownPiece } from './townArt.ts';

const RAIL_GAUGE = 1;
/** Old Town's stretch of the high street, west of here, is cobbled in stone; the rest is tarmac. */
const OLD_TOWN_ENDS = -30;
/** The kerbs along both sides of the carriageway: how wide and how high above the road. */
const KERB = { width: 0.25, height: 0.1 } as const;
/** The bed each track is laid in, darker than the road round it. */
const TRACK_BED = 1.7;
/** A zebra crossing to each platform from both pavements: its stripes, west of the pole. */
const ZEBRA = { offset: -2.8, stripe: [2.4, 0.5] as Vec2, every: 1 } as const;
/** A tram stop's shelter, west of its pole: its roof's size and height, and its posts along the platform's back edge, with a bench between. */
const SHELTER = { centreX: -2.2, size: [2.8, 0.2, 1.6] as const, height: 2.4, posts: [-3.5, -0.9], postZ: -0.8 } as const;
/** How far a street light's pole stands from the middle of its piece, which reaches out over the street. */
const LIGHT_POLE_OFFSET = 0.73;
/** How far out over the street a street light's bulb hangs from its pole, and the pool of light it casts below. */
const LIGHT_POOL = { reach: 1.14, radius: 2.6, opacity: 0.5 } as const;
/** The park's trees, in turn. */
const TREE_KINDS: readonly TownPiece[] = ['tree-round', 'tree-oak', 'tree-tall', 'tree-fat'];

/** A flat slab of one colour and surface, just proud of the ground. */
function Slab({ centre: [x, z], size: [w, d], colour, surface = 'matte', y }: { centre: Vec2; size: Vec2; colour: PaletteColour; surface?: Surface; y: number }) {
  return (
    <mesh position={[x, y, z]} rotation-x={-Math.PI / 2} receiveShadow material={townMaterial(colour, surface)}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

/**
 * How far the land runs on round the ground, out to: past the camera's far plane (1000 m), by when the haze has hidden
 * it entirely, so the ground never shows an edge.
 */
const LAND_BEYOND = 1200;

/** The grass beyond the ground, all round it out to the horizon: a disc with the ground's square cut out of it. */
function landBeyond() {
  const [x0, x1] = GROUND.x;
  const [z0, z1] = GROUND.z;
  const land = new Shape().absarc(0, 0, LAND_BEYOND, 0, Math.PI * 2, false);
  land.holes.push(new Path([new Vector2(x0, z0), new Vector2(x1, z0), new Vector2(x1, z1), new Vector2(x0, z1)]));
  return new ShapeGeometry(land, 64);
}

/** The grass, either side of the canal and on beyond the ground to the horizon, and solid ground under the whole town. */
function Ground() {
  const [x0, x1] = GROUND.x;
  const [z0, z1] = GROUND.z;
  const [c0, c1] = CANAL.z;
  const beyond = useMemo(landBeyond, []);
  return (
    <>
      <Slab centre={[(x0 + x1) / 2, (z0 + c0) / 2]} size={[x1 - x0, c0 - z0]} colour="grass" surface="grass" y={0} />
      <Slab centre={[(x0 + x1) / 2, (c1 + z1) / 2]} size={[x1 - x0, z1 - c1]} colour="grass" surface="grass" y={0} />
      <mesh geometry={beyond} rotation-x={-Math.PI / 2} material={townMaterial('grass', 'grass')} receiveShadow />
      <Solid position={[0, -0.5, 0]} size={[x1 - x0, 1, z1 - z0]} />
    </>
  );
}

/**
 * The high street: tarmac (cobbles in Old Town) from kerb to kerb, the two tracks in their beds, kerbs, the pavements
 * either side up to the buildings' fronts, and a zebra crossing to each platform.
 */
function Street() {
  const [railLength] = usePieceSize('rail');
  const [x0, x1] = GROUND.x;
  const kerbs = [STREET.z - STREET.width / 2, STREET.z + STREET.width / 2] as const;
  const rails = useMemo(() => {
    const { each, centres } = laidAlong(x1 - x0, railLength);
    return [STREET.z - STREET.track, STREET.z + STREET.track].flatMap((z) => centres.map((x): Placement => ({ piece: 'rail', position: [x, 0.03, z], size: [each, null, RAIL_GAUGE] })));
  }, [railLength, x0, x1]);
  const zebras = useMemo(
    () =>
      TRAM_LINE.flatMap((stopId) => {
        const [x, z] = TRAM_STOPS[stopId].centre;
        const halfPlatform = PLATFORM.size[1] / 2;
        return [-1, 1].flatMap((side) => {
          const from = z + side * halfPlatform;
          const to = side === -1 ? kerbs[0] : kerbs[1];
          const count = Math.floor(Math.abs(to - from) / ZEBRA.every);
          return Array.from({ length: count }, (_, i): Vec2 => [x + ZEBRA.offset, from + side * (i + 0.5) * ZEBRA.every]);
        });
      }),
    [kerbs],
  );
  const roadWidth = STREET.width;
  return (
    <>
      <Slab centre={[(OLD_TOWN_ENDS + x1) / 2, STREET.z]} size={[x1 - OLD_TOWN_ENDS, roadWidth]} colour="slate" surface="asphalt" y={0.01} />
      <Slab centre={[(x0 + OLD_TOWN_ENDS) / 2, STREET.z]} size={[OLD_TOWN_ENDS - x0, roadWidth]} colour="stone" surface="cobbles" y={0.01} />
      {[-1, 1].map((side) => (
        <Slab key={side} centre={[(x0 + x1) / 2, STREET.z + side * STREET.track]} size={[x1 - x0, TRACK_BED]} colour="charcoal" surface="gravel" y={0.015} />
      ))}
      <Instances placements={rails} />
      {kerbs.map((z, i) => (
        <group key={z}>
          <mesh position={[(x0 + x1) / 2, KERB.height / 2, z + (i === 0 ? -KERB.width / 2 : KERB.width / 2)]} material={townMaterial('stone', 'stone')} receiveShadow>
            <boxGeometry args={[x1 - x0, KERB.height, KERB.width]} />
          </mesh>
          <Slab centre={[(x0 + x1) / 2, z + (i === 0 ? -1 : 1) * (STREET.pavement / 2 + KERB.width / 2)]} size={[x1 - x0, STREET.pavement - KERB.width]} colour="linen" surface="paving" y={0.02} />
        </group>
      ))}
      {zebras.map(([x, z]) => (
        <Slab key={`${x},${z}`} centre={[x, z]} size={[ZEBRA.stripe[0], ZEBRA.stripe[1]]} colour="white" surface="paint" y={0.021} />
      ))}
    </>
  );
}

/** A soft round falloff, bright in the middle and gone at the edge, for the pools of light under street lights. */
const POOL_FALLOFF = (() => {
  const size = 64;
  // RGBA, all four alike: an alpha map is read from its green channel.
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fromMiddle = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      data.fill(Math.round(255 * Math.max(0, 1 - fromMiddle) ** 2), (y * size + x) * 4, (y * size + x + 1) * 4);
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
})();

/** Street lights along both sides of the street, each reaching out over it, lit from dusk with a pool of light below. */
function StreetLights() {
  const lit = useGame(selectLampsOn);
  // On the north side a light reaches south, over the street; on the south side, north.
  const towardsStreet = (z: number) => (z < STREET.z ? 1 : -1);
  const placements = useMemo(
    () => STREET_LIGHTS.map(([x, z]): Placement => ({ piece: 'street-light', position: [x, 0, z + towardsStreet(z) * LIGHT_POLE_OFFSET], rotation: z < STREET.z ? Math.PI : 0, lit: true })),
    [],
  );
  return (
    <>
      <Instances placements={placements} />
      {STREET_LIGHTS.map(([x, z]) => (
        <group key={`${x},${z}`}>
          <Solid position={[x, 2, z]} size={[0.2, 4, 0.2]} />
          {lit && (
            <mesh position={[x, 0.05, z + towardsStreet(z) * LIGHT_POOL.reach]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[LIGHT_POOL.radius, 24]} />
              <meshBasicMaterial color={PALETTE.lamplight} alphaMap={POOL_FALLOFF} transparent opacity={LIGHT_POOL.opacity} depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

/**
 * An island platform between the tracks, with a stop pole, a shelter with a bench and a lamp under it (lighting the
 * platform from dusk), and white lines along its edges. Walked onto, not stepped up.
 */
function TramStop({ stopId }: { stopId: TramStopId }) {
  const lit = useGame(selectLampsOn);
  const [x, z] = TRAM_STOPS[stopId].centre;
  const [length, width] = PLATFORM.size;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, PLATFORM.height / 2, 0]} material={townMaterial('sand', 'paving')} receiveShadow castShadow>
        <boxGeometry args={[length, PLATFORM.height, width]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, PLATFORM.height + 0.005, side * (width / 2 - 0.12)]} rotation-x={-Math.PI / 2} material={townMaterial('white', 'paint')}>
          <planeGeometry args={[length, 0.12]} />
        </mesh>
      ))}
      <Piece piece="stop-pole" />
      <Solid position={[0, 1.3, 0]} size={[0.12, 2.6, 0.12]} />
      <Piece piece="shelter-roof" position={[SHELTER.centreX, SHELTER.height, 0]} size={SHELTER.size} repaint={{ charcoal: 'denim' }} />
      {SHELTER.posts.map((postX) => (
        <group key={postX}>
          <Piece piece="shelter-post" position={[postX, 0, SHELTER.postZ]} />
          <Solid position={[postX, SHELTER.height / 2, SHELTER.postZ]} size={[0.16, SHELTER.height, 0.16]} />
        </group>
      ))}
      <Piece piece="bench" position={[SHELTER.centreX, PLATFORM.height, SHELTER.postZ + 0.1]} size={[1.6, null, 0.55]} />
      <Piece piece="ceiling-lamp" position={[SHELTER.centreX, SHELTER.height - 0.5, 0]} lit={lit} />
      {lit && (
        <mesh position={[SHELTER.centreX, PLATFORM.height + 0.02, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[LIGHT_POOL.radius * 1.4, 24]} />
          <meshBasicMaterial color={PALETTE.lamplight} alphaMap={POOL_FALLOFF} transparent opacity={LIGHT_POOL.opacity} depthWrite={false} />
        </mesh>
      )}
      <Solid position={[SHELTER.centreX, 0.5, SHELTER.postZ + 0.1]} size={[1.6, 1, 0.5]} />
    </group>
  );
}

/**
 * The park: a lawn with gravel paths, the bandstand and the pond, trees, hedges along the street either side of the way
 * in, bushes and flowers, and its name board's posts at the way in.
 */
function Park() {
  const hedges = PARK_PLANTING.filter(({ piece }) => piece === 'hedge');
  const planting = useMemo(
    () => [
      ...PARK_PLANTING.map(({ at: [x, z], piece, rotation }): Placement => ({ piece, position: [x, 0, z], rotation })),
      ...TREES.map(([x, z], i): Placement => ({ piece: TREE_KINDS[i % TREE_KINDS.length]!, position: [x, 0, z], rotation: i })),
    ],
    [],
  );
  const [hedgeLength, , hedgeDepth] = usePieceSize('hedge');
  const [px, pz] = POND.centre;
  return (
    <>
      <Slab centre={PARK.centre} size={PARK.size} colour="leaf" surface="grass" y={0.008} />
      {PARK_PATHS.map(({ centre, size }) => (
        <Slab key={centre.join()} centre={centre} size={size} colour="sand" surface="gravel" y={0.014} />
      ))}
      {TREES.map(([x, z]) => (
        <Solid key={`${x},${z}`} position={[x, 0.9, z]} size={[0.35, 1.8, 0.35]} />
      ))}
      <Instances placements={planting} />
      {hedges.map(({ at: [x, z] }) => (
        <Solid key={`${x},${z}`} position={[x, 0.6, z]} size={[hedgeLength, 1.2, hedgeDepth]} />
      ))}
      <Piece piece="gazebo" position={[BANDSTAND[0], 0, BANDSTAND[1]]} rotation={Math.PI} />
      <mesh position={[px, 0.12, pz]} material={townMaterial('stone', 'stone')} castShadow receiveShadow>
        <cylinderGeometry args={[POND.radius + 0.3, POND.radius + 0.35, 0.24, 20]} />
      </mesh>
      <mesh position={[px, 0.245, pz]} rotation-x={-Math.PI / 2} material={WATER}>
        <circleGeometry args={[POND.radius, 20]} />
      </mesh>
      {[
        [-1.1, 0.6],
        [0.9, -0.8],
        [0.3, 1.3],
      ].map(([dx, dz], i) => (
        <Piece key={i} piece="lily" position={[px + dx!, 0.24, pz + dz!]} rotation={i * 2} />
      ))}
      {PARK_SIGN_POSTS.map(([x, z]) => (
        <Piece key={`${x},${z}`} piece="shelter-post" position={[x, 0, z]} size={[null, SIGNS['park-name'].position[1] + SIGNS['park-name'].size[1] / 2, null]} />
      ))}
    </>
  );
}

/** Everything outdoors that the town's places stand in: the same in every Culture Pack. */
export function Outdoors() {
  return (
    <>
      <Ground />
      <Street />
      <StreetLights />
      {TRAM_LINE.map((stopId) => (
        <TramStop key={stopId} stopId={stopId} />
      ))}
      <Park />
    </>
  );
}
