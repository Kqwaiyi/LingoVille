import { CULTURE_PACKS, type DrinkOptionId, type Good, type ItemId } from '../content/index.ts';
import type { LanguageCode } from '../sim/index.ts';

/** An item by its local name, with its gloss in the Native Language after it: 卵 (Eggs). Just the name when they're the same language. */
export function itemLabel(itemId: ItemId, packId: LanguageCode, nativeLanguage: LanguageCode) {
  return glossed(CULTURE_PACKS[packId].goods[itemId], nativeLanguage);
}

/** A way a café drink is made (a size, hot or iced, an extra) by its local name, with its gloss in the Native Language after it. */
export function drinkOptionLabel(option: DrinkOptionId, packId: LanguageCode, nativeLanguage: LanguageCode) {
  return glossed(CULTURE_PACKS[packId].drinkOptions[option], nativeLanguage);
}

function glossed({ name, glosses }: Good, nativeLanguage: LanguageCode) {
  const gloss = glosses[nativeLanguage];
  return gloss ? `${name} (${gloss})` : name;
}
