import { CULTURE_PACKS } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import type { LanguageCode, PlaceId } from '../sim/index.ts';

/** A place's name: the café by its name in the pack, anywhere else in the Native Language. */
export function usePlaceName() {
  const { t } = useTranslation();
  return (placeId: PlaceId, packId: LanguageCode) => (placeId === 'cafe' ? CULTURE_PACKS[packId].cafe.name : t(`places.${placeId}`));
}
