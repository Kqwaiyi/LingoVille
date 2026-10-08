import { GROCERIES_SOLD, type GroceryId } from '../content/index.ts';
import { selectShelfMarker, useGame } from '../store/index.ts';
import { MarkerArrow } from './Marker.tsx';
import { SHELF_SPOTS } from './town.ts';
import { PALETTE } from './palette.ts';

/** Stand-ins, in palette colours, for each grocery on its shelf, until the pack art (ticket 31c). */
const COLOURS: Record<GroceryId, string> = {
  vegetables: PALETTE.leaf,
  eggs: PALETTE.cream,
  noodles: PALETTE.butter,
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
