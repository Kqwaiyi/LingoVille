import { localShop } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import type { LanguageCode, PlaceId } from '../sim/index.ts';

/** A place's name: a shop by its name in the pack, anywhere else in the Native Language. */
export function usePlaceName() {
  const { t } = useTranslation();
  return (placeId: PlaceId, packId: LanguageCode) => localShop(placeId, packId)?.name ?? t(`places.${placeId}`);
}
