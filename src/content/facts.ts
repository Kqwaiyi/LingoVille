import type { LanguageCode } from '../sim/index.ts';
import { CULTURE_PACKS } from './culturePacks.ts';
import { formatLocalMoney, menuPrice } from './currency.ts';
import type { Interaction } from './defineInteraction.ts';
import { formatTime, placeHours } from './places.ts';

/**
 * The facts an interaction's NPC knows, in English, pulled from the Culture
 * Pack. The café is the only staffed place until ticket 13.
 */
export function interactionFacts(interaction: Interaction, packId: LanguageCode): string[] {
  const { cafe, goods, customs } = CULTURE_PACKS[packId];
  return interaction.facts.flatMap((source) => {
    switch (source) {
      case 'openingHours': {
        const hours = placeHours(interaction.placeId, packId);
        return hours ? [`${cafe.name} is open ${formatTime(hours.opensAt)}–${formatTime(hours.closesAt)}.`] : [];
      }
      case 'menu':
        return interaction.items.map(
          (id) => `On the menu: ${goods[id].name}, ${formatLocalMoney(menuPrice(id, packId), packId)} (menu id "${id}").`,
        );
      case 'placeFacts':
        return cafe.facts;
      case 'customs':
        return customs;
    }
  });
}
