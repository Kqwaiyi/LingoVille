import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { Vector3, type Mesh } from 'three';
import type { FirstMorningStep, PlaceId } from '../sim/index.ts';
import { selectFirstMorningBanner, selectRouteMarker, useGame } from '../store/index.ts';
import { characterPosition } from './Character.tsx';
import { buildingOf, frontOf, HOME_TAP, NPC_SPOTS, placeAt, TRAM_STOPS, type Vec3 } from './town.ts';
import { PALETTE } from './palette.ts';

const ARROW = { height: 1, bob: 0.12, bobsPerSecond: 1.5, colour: PALETTE.red } as const;

/** A red arrow bobbing `ARROW.height` over `at`: what an NPC pointed the Character to. */
export function MarkerArrow({ at: [x, y, z], size = 1 }: { at: Vec3; size?: number }) {
  const arrow = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (arrow.current) arrow.current.position.y = y + ARROW.height + Math.sin(clock.elapsedTime * ARROW.bobsPerSecond * Math.PI * 2) * ARROW.bob;
  });
  return (
    <mesh ref={arrow} position={[x, y + ARROW.height, z]} rotation-x={Math.PI} scale={size}>
      <coneGeometry args={[0.18, 0.4, 12]} />
      <meshStandardMaterial color={ARROW.colour} emissive={ARROW.colour} emissiveIntensity={0.5} />
    </mesh>
  );
}

/** Over the sign of the tram stop a passer-by said to get off at, until the Character rides there. */
const ROUTE_MARKER = { overSign: 2.9, size: 2 } as const;

/** The route marker: an arrow over the stop a passer-by named, seen from down the street. */
export function RouteMarker() {
  const stopId = useGame(selectRouteMarker);
  if (!stopId) return null;
  const [x, z] = TRAM_STOPS[stopId].centre;
  return <MarkerArrow at={[x, ROUTE_MARKER.overSign, z]} size={ROUTE_MARKER.size} />;
}

/** Where the arrow over the barista starts: about head height, so it bobs just above them. */
const OVER_THE_BARISTA = 1.6;

/**
 * Where each First Morning step is done: at the tap, through the café's door, and at the café counter. A spot indoors
 * can't be seen through the roof, so from outside its place the marker hangs over the place's door instead.
 */
const FIRST_MORNING_SPOTS: Record<FirstMorningStep, { placeId: PlaceId; spot: Vec3 | 'door' }> = {
  drink: { placeId: 'home', spot: HOME_TAP },
  walkToCafe: { placeId: 'cafe', spot: 'door' },
  breakfast: { placeId: 'cafe', spot: [NPC_SPOTS.barista[0], OVER_THE_BARISTA, NPC_SPOTS.barista[2]] },
};

/** Over a door, out in front of the eaves, so it can be seen from down the street. */
const OVER_THE_DOOR = { height: 2.4, outFrom: 1.2, size: 1.5 } as const;
/** How finely the banner shows the way: to the metre, and the arrow in steps of this many degrees. */
const BEARING_STEP_DEGREES = 5;

function overTheDoor(placeId: PlaceId): Vec3 {
  const { x, z, facing } = frontOf(buildingOf(placeId)!);
  return [x, OVER_THE_DOOR.height, z + facing * OVER_THE_DOOR.outFrom];
}

/**
 * The First Morning's world marker: an arrow over where its next step is done. Each frame it measures how far that is
 * from the Character and which way on screen, for the banner's arrow and distance.
 */
export function FirstMorningMarker() {
  const step = useGame(selectFirstMorningBanner);
  const setGuide = useGame((s) => s.setFirstMorningGuide);
  // Whether the Character is in the step's place, so the marker moves from over its door to the spot itself.
  const [inside, setInside] = useState(false);
  const forward = useRef(new Vector3());

  const target = step && FIRST_MORNING_SPOTS[step];
  const at: Vec3 | null = target && (inside && target.spot !== 'door' ? target.spot : overTheDoor(target.placeId));

  useFrame(({ camera }) => {
    if (!target || !at) return;
    const here = placeAt(characterPosition.x, characterPosition.z) === target.placeId;
    if (here !== inside) setInside(here);
    // The way there, across the ground, against the way the camera looks: ahead of it is up the screen.
    const dx = at[0] - characterPosition.x;
    const dz = at[2] - characterPosition.z;
    const { x: fx, z: fz } = camera.getWorldDirection(forward.current);
    const degrees = (Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz) * 180) / Math.PI;
    const bearing = Math.round(degrees / BEARING_STEP_DEGREES) * BEARING_STEP_DEGREES;
    setGuide({ metres: Math.round(Math.hypot(dx, dz)), bearing: bearing === -180 ? 180 : bearing });
  });

  if (!target || !at) return null;
  return <MarkerArrow at={at} size={at === target.spot ? 1 : OVER_THE_DOOR.size} />;
}
