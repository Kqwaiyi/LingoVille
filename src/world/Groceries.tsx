import { CULTURE_PACKS, GROCERIES_SOLD } from '../content/index.ts';
import { selectCulturePackId, selectShelfMarker, useGame } from '../store/index.ts';
import { Piece } from './Kit.tsx';
import { MarkerArrow } from './Marker.tsx';
import { SHELF_SPOTS } from './town.ts';

/** How far below a grocery's shelf spot (the middle of its display) the shelf it stands on is. */
const SHELF_BELOW = 0.17;

/** The groceries on the supermarket's shelves, as the Culture Pack sells them, and the marker on the one the cashier pointed to. */
export function Groceries() {
  const marked = useGame(selectShelfMarker);
  const packId = useGame(selectCulturePackId);
  const { shelves } = CULTURE_PACKS[packId];
  return (
    <>
      {GROCERIES_SOLD.map((itemId) => {
        const [x, y, z] = SHELF_SPOTS[itemId];
        return <Piece key={itemId} piece={shelves[itemId]} position={[x, y - SHELF_BELOW, z]} />;
      })}
      {/* A red arrow bobbing over the grocery the cashier pointed to. */}
      {marked && <MarkerArrow at={SHELF_SPOTS[marked]} />}
    </>
  );
}
