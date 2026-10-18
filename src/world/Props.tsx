import { CULTURE_PACKS } from '../content/index.ts';
import { PLACE_IDS } from '../sim/index.ts';
import { selectCulturePackId, useGame } from '../store/index.ts';
import { Piece } from './Kit.tsx';
import { setOut } from './setDressing.ts';

/** The Culture Pack's set dressing at all 11 places: its money, door hangings, food and goods, and small local touches. */
export function Props() {
  const packId = useGame(selectCulturePackId);
  const { props } = CULTURE_PACKS[packId];
  return PLACE_IDS.flatMap((placeId) =>
    setOut(placeId, props[placeId]).placed.map(({ propId, spot: { at, rotation } }, i) => (
      <Piece key={`${placeId}-${i}-${propId}`} piece={propId} position={at} rotation={rotation} />
    )),
  );
}
