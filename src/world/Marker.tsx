import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import { selectRouteMarker, useGame } from '../store/index.ts';
import { TRAM_STOPS, type Vec3 } from './town.ts';
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
