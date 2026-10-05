import { ECONOMY, type Basket, type LanguageCode, type OpeningHours } from '../sim/index.ts';
import { CULTURE_PACKS, localPlaceName, localShop } from './culturePacks.ts';
import { chargeInShifts, formatLocalMoney, menuPrice } from './currency.ts';
import type { Interaction } from './defineInteraction.ts';
import { placeHours } from './openingHours.ts';
import { formatTime } from './places.ts';

/** "Somewhere is open 09:00–17:00, closed on Sundays.", or open 24 hours. */
function hoursFact(what: string, hours: OpeningHours): string[] {
  if (!hours) return [`${what} is open 24 hours.`];
  const closed = hours.closedOn.map((day) => `${day[0]!.toUpperCase()}${day.slice(1)}s`).join(' and ');
  const open = `${what} is open ${formatTime(hours.opensAt)}–${formatTime(hours.closesAt)}`;
  return [closed ? `${open}, closed on ${closed}.` : `${open}.`];
}

/** What the customer has put on the counter, each at its price, and the total. Nothing, before anyone brings shopping. */
function basketFacts(basket: Basket, packId: LanguageCode): string[] {
  if (basket.length === 0) return [];
  const { goods } = CULTURE_PACKS[packId];
  const money = (shifts: number) => formatLocalMoney(shifts, packId);
  const total = basket.reduce((sum, { itemId, quantity }) => sum + menuPrice(itemId, packId) * quantity, 0);
  return [
    'The customer has put their shopping on the counter:',
    ...basket.map(({ itemId, quantity }) => `${quantity} × ${goods[itemId].name}, ${money(menuPrice(itemId, packId))} each`),
    `Total: ${money(total)}.`,
  ];
}

/**
 * The facts an interaction's NPC knows, in English, pulled from the Culture
 * Pack, or for the ward, from what Fainting costs. At the till, the cashier
 * also knows what the customer has brought to the counter (`basket`).
 */
export function interactionFacts(interaction: Interaction, packId: LanguageCode, basket: Basket = []): string[] {
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
      case 'shelves':
        return interaction.items.map(
          (id) => `On the shelves: ${goods[id].name} (shelf id "${id}"), ${formatLocalMoney(menuPrice(id, packId), packId)}.`,
        );
      case 'basket':
        return basketFacts(basket, packId);
      case 'placeFacts':
        return localShop(placeId, packId)?.facts ?? [];
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
