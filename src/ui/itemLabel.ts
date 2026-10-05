import { CULTURE_PACKS, type ItemId } from '../content/index.ts';
import type { LanguageCode } from '../sim/index.ts';

/** An item by its local name, with its gloss in the Native Language after it: 卵 (Eggs). Just the name when they're the same language. */
export function itemLabel(itemId: ItemId, packId: LanguageCode, nativeLanguage: LanguageCode) {
  const { name, glosses } = CULTURE_PACKS[packId].goods[itemId];
  const gloss = glosses[nativeLanguage];
  return gloss ? `${name} (${gloss})` : name;
}
