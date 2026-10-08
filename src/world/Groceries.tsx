import { GROCERIES_SOLD, type GroceryId } from '../content/index.ts';
import { selectShelfMarker, useGame } from '../store/index.ts';
import { MarkerArrow } from './Marker.tsx';
import { SHELF_SPOTS } from './town.ts';

/** Greybox stand-ins for each grocery on its shelf, until the art pass (ticket 31). */
const COLOURS: Record<GroceryId, string> = {
  vegetables: '#7bb661',
  eggs: '#f3e9d2',
  noodles: '#e8c66a',
};

const DISPLAY = { size: [1.2, 0.35, 0.3] as const } as const;

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
      {/* A red arrow bobbing over the grocery the cashier pointed to. */}
      {marked && <MarkerArrow at={SHELF_SPOTS[marked]} />}
    </>
  );
}
