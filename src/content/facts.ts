import { ECONOMY, type LanguageCode, type OpeningHours } from '../sim/index.ts';
import { CULTURE_PACKS } from './culturePacks.ts';
import { chargeInShifts, formatLocalMoney, menuPrice } from './currency.ts';
import type { Interaction } from './defineInteraction.ts';
import { placeHours } from './openingHours.ts';
import { formatTime } from './places.ts';

/** "Somewhere is open 09:00–17:00, closed on Sundays." Always-open places have nothing to say. */
function hoursFact(what: string, hours: OpeningHours): string[] {
  if (!hours) return [];
  const closed = hours.closedOn.map((day) => `${day[0]!.toUpperCase()}${day.slice(1)}s`).join(' and ');
  const open = `${what} is open ${formatTime(hours.opensAt)}–${formatTime(hours.closesAt)}`;
  return [closed ? `${open}, closed on ${closed}.` : `${open}.`];
}

/**
 * The facts an interaction's NPC knows, in English, pulled from the Culture
 * Pack, or for the ward, from what Fainting costs.
 */
export function interactionFacts(interaction: Interaction, packId: LanguageCode): string[] {
  const { cafe, goods, customs } = CULTURE_PACKS[packId];
  return interaction.facts.flatMap((source) => {
    switch (source) {
      case 'openingHours':
        return hoursFact(cafe.name, placeHours(interaction.placeId, packId));
      case 'menu':
        return interaction.items.map(
          (id) => `On the menu: ${goods[id].name}, ${formatLocalMoney(menuPrice(id, packId), packId)} (menu id "${id}").`,
        );
      case 'placeFacts':
        return cafe.facts;
      case 'customs':
        return customs;
      case 'ward': {
        const bill = formatLocalMoney(chargeInShifts(ECONOMY.faintingBillInShifts, packId), packId);
        return [
          `A night on the ward after fainting costs ${bill}. It is taken from the patient's money if they have enough; otherwise they owe it.`,
          'Anything owed is settled later at reception, never on the ward.',
          ...hoursFact('Reception', placeHours('clinic', packId)),
          'Patients who faint have usually gone too long without eating or drinking.',
        ];
      }
    }
  });
}
