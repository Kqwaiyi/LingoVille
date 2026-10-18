import type { LanguageCode, OpeningHours } from '../sim/index.ts';
import { cafeAllergensIn, CULTURE_PACKS, localPlaceFacts, localPlaceName } from './culturePacks.ts';
import { formatLocalMoney, menuPrice } from './currency.ts';
import type { Interaction } from './defineInteraction.ts';
import {
  ALLERGENS,
  DRINK_EXTRAS,
  DRINK_SIZES,
  DRINK_TEMPERATURES,
  EXTRA_ALLERGENS,
  isMadeToOrder,
  MADE_TO_ORDER_EXTRAS,
  type DrinkOptionId,
  type ItemId,
} from './items.ts';
import { placeHours } from './openingHours.ts';
import { formatTime } from './places.ts';

/** "Somewhere is open 09:00–17:00, closed on Sundays.", or open 24 hours. */
function hoursFact(what: string, hours: OpeningHours): string[] {
  if (!hours) return [`${what} is open 24 hours.`];
  const closed = hours.closedOn.map((day) => `${day[0]!.toUpperCase()}${day.slice(1)}s`).join(' and ');
  const open = `${what} is open ${formatTime(hours.opensAt)}–${formatTime(hours.closesAt)}`;
  return [closed ? `${open}, closed on ${closed}.` : `${open}.`];
}

/** "A, B or C" (or "and"): a list as English says it. */
const listed = (words: readonly string[], joiner = 'or') =>
  words.length > 1 ? `${words.slice(0, -1).join(', ')} ${joiner} ${words.at(-1)}` : (words[0] ?? '');

/** How the café's drinks made to order can be made: a size, hot or iced, and the extras each takes, by local name and id. */
function drinkOptionsFacts(items: readonly ItemId[], packId: LanguageCode): string[] {
  const { goods, drinkOptions } = CULTURE_PACKS[packId];
  const said = (id: DrinkOptionId) => `${drinkOptions[id].name} (id "${id}")`;
  return [
    `A drink made to order comes in a size, ${listed(DRINK_SIZES.map(said))}, and ${listed(DRINK_TEMPERATURES.map(said))}. Options cost nothing extra.`,
    ...items.filter(isMadeToOrder).map((id) => `${goods[id].name} (menu id "${id}") is made to order. It can have added: ${MADE_TO_ORDER_EXTRAS[id]!.map(said).join(', ')}.`),
    'Everything else on the menu comes as it is, with no options.',
  ];
}

/** Which allergens each café item has in it, in this pack, and what an extra adds. */
function allergenFacts(items: readonly ItemId[], packId: LanguageCode): string[] {
  const { goods, allergens } = CULTURE_PACKS[packId];
  const named = ALLERGENS.map((id) => `${allergens[id].name} (allergen id "${id}")`);
  return [
    `The allergies you know about: ${listed(named, 'and')}. You can't say what else anything has in it.`,
    ...items.map((id) => {
      const has = cafeAllergensIn(id, [], packId);
      return `${goods[id].name} (menu id "${id}") ${has.length > 0 ? `has ${listed(has, 'and')} in it` : `has no ${listed(ALLERGENS)} in it`}.`;
    }),
    ...DRINK_EXTRAS.flatMap((extra) => {
      const adds = EXTRA_ALLERGENS[extra] ?? [];
      return adds.length > 0 ? [`Adding ${extra} to a drink adds ${listed(adds, 'and')} to it.`] : [];
    }),
  ];
}

/** The facts an interaction's NPC knows, in English, pulled from the Culture Pack. */
export function interactionFacts(interaction: Interaction, packId: LanguageCode): string[] {
  const { goods, customs } = CULTURE_PACKS[packId];
  const { placeId } = interaction;
  return interaction.facts.flatMap((source) => {
    switch (source) {
      case 'openingHours':
        return hoursFact(localPlaceName(placeId, packId), placeHours(placeId, packId));
      case 'menu':
        return interaction.items.map(
          (id) => `On the menu: ${goods[id].name}, ${formatLocalMoney(menuPrice(id, packId), packId)} (menu id "${id}").`,
        );
      case 'drinkOptions':
        return drinkOptionsFacts(interaction.items, packId);
      case 'allergens':
        return allergenFacts(interaction.items, packId);
      case 'placeFacts':
        return localPlaceFacts(placeId, packId);
      case 'customs':
        return customs;
    }
  });
}
