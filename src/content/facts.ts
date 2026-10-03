import type { LanguageCode } from '../sim/index.ts';
import { CAFE_ITEM_IDS, CAFE_ITEMS } from './cafe.ts';
import { CULTURE_PACKS } from './culturePacks.ts';
import { formatLocalMoney } from './currency.ts';
import type { Interaction } from './defineInteraction.ts';
import { PLACE_HOURS } from './places.ts';

function formatTime(minuteOfDay: number) {
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;
}

/**
 * The facts an interaction's NPC knows, in English, pulled from the Culture
 * Pack. The café is the only staffed place until ticket 13.
 */
export function interactionFacts(interaction: Interaction, packId: LanguageCode): string[] {
  const { cafe } = CULTURE_PACKS[packId];
  return interaction.facts.flatMap((source) => {
    switch (source) {
      case 'openingHours': {
        const hours = PLACE_HOURS[interaction.placeId];
        return hours ? [`${cafe.name} is open ${formatTime(hours.opensAt)}–${formatTime(hours.closesAt)}.`] : [];
      }
      case 'menu':
        return CAFE_ITEM_IDS.map(
          (id) => `On the menu: ${cafe.menu[id]}, ${formatLocalMoney(CAFE_ITEMS[id].priceInShifts, packId)} (menu id "${id}").`,
        );
      case 'placeFacts':
        return cafe.facts;
    }
  });
}
