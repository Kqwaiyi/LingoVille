import { CULTURE_PACKS, GROCERIES_SOLD } from '../content/index.ts';
import { selectCulturePackId, useGame } from '../store/index.ts';
import { Piece } from './Kit.tsx';
import { SHELF_SPOTS } from './town.ts';

/** How far below a grocery's shelf spot (the middle of its display) the shelf it stands on is. */
const SHELF_BELOW = 0.17;

/** The groceries on the supermarket's shelves, as the Culture Pack sells them. */
export function Groceries() {
  const packId = useGame(selectCulturePackId);
  const { shelves } = CULTURE_PACKS[packId];
  return (
    <>
      {GROCERIES_SOLD.map((itemId) => {
        const [x, y, z] = SHELF_SPOTS[itemId];
        return <Piece key={itemId} piece={shelves[itemId]} position={[x, y - SHELF_BELOW, z]} />;
      })}
    </>
  );
}
