import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import { GROCERIES_SOLD, type GroceryId } from '../content/index.ts';
import { selectShelfMarker, useGame } from '../store/index.ts';
import { SHELF_SPOTS } from './town.ts';

/** Greybox stand-ins for each grocery on its shelf, until the art pass (ticket 31). */
const COLOURS: Record<GroceryId, string> = {
  vegetables: '#7bb661',
  eggs: '#f3e9d2',
  noodles: '#e8c66a',
};

const DISPLAY = { size: [1.2, 0.35, 0.3] as const } as const;
const MARKER = { height: 1, bob: 0.12, bobsPerSecond: 1.5, colour: '#e0483b' } as const;

/** A red arrow bobbing over the grocery the cashier pointed to. */
function ShelfMarker({ itemId }: { itemId: GroceryId }) {
  const arrow = useRef<Mesh>(null);
  const [x, y, z] = SHELF_SPOTS[itemId];
  useFrame(({ clock }) => {
    if (arrow.current) arrow.current.position.y = y + MARKER.height + Math.sin(clock.elapsedTime * MARKER.bobsPerSecond * Math.PI * 2) * MARKER.bob;
  });
  return (
    <mesh ref={arrow} position={[x, y + MARKER.height, z]} rotation-x={Math.PI}>
      <coneGeometry args={[0.18, 0.4, 12]} />
      <meshStandardMaterial color={MARKER.colour} emissive={MARKER.colour} emissiveIntensity={0.5} />
    </mesh>
  );
}

/** The groceries on the supermarket's shelves, and the marker on the one the cashier pointed to. */
export function Groceries() {
  const marked = useGame(selectShelfMarker);
  return (
    <>
      {GROCERIES_SOLD.map((itemId) => (
        <mesh key={itemId} position={SHELF_SPOTS[itemId]} castShadow>
          <boxGeometry args={DISPLAY.size} />
          <meshStandardMaterial color={COLOURS[itemId]} flatShading />
        </mesh>
      ))}
      {marked && <ShelfMarker itemId={marked} />}
    </>
  );
}
