import { ECONOMY, weekdayOf, WEEKDAYS, type Basket, type LanguageCode, type OpeningHours, type RentStatement } from '../sim/index.ts';
import { CULTURE_PACKS, localPlaceFacts, localPlaceName } from './culturePacks.ts';
import { chargeInShifts, formatLocalMoney, menuPrice } from './currency.ts';
import type { Interaction } from './defineInteraction.ts';
import { DIETARY_NOTE_IDS, DIETARY_NOTES, dishContents, dishFits, isDish, ITEMS, type ItemId } from './items.ts';
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
export function basketFacts(basket: Basket, packId: LanguageCode): string[] {
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

/** The latest total `basketFacts` wrote into this text (a system instruction or a scene), as local money, or null. */
export function readBasketTotal(text: string): string | null {
  const totals = [...text.matchAll(/Total: (.+)\.$/gm)];
  return totals.at(-1)?.[1] ?? null;
}

/**
 * What the guest has eaten and not paid for yet, each at its price, anything they owe from a bill they walked out on
 * (in Shifts), and the total to pay for both.
 */
function billFacts(bill: Basket, owedInShifts: number, packId: LanguageCode): string[] {
  if (bill.length === 0 && owedInShifts === 0) return ['The customer has nothing on their bill.'];
  const { goods } = CULTURE_PACKS[packId];
  const money = (shifts: number) => formatLocalMoney(shifts, packId);
  const total = bill.reduce((sum, { itemId, quantity }) => sum + menuPrice(itemId, packId) * quantity, owedInShifts);
  return [
    ...(bill.length === 0
      ? ['The customer has nothing on their bill today.']
      : ["The customer's bill:", ...bill.map(({ itemId, quantity }) => `${quantity} × ${goods[itemId].name}, ${money(menuPrice(itemId, packId))} each`)]),
    ...(owedInShifts > 0 ? [`Owed from last time, when they left without paying: ${money(owedInShifts)}.`] : []),
    `Bill total: ${money(total)}.`,
  ];
}

/** The bill total `billFacts` wrote into this text, as local money, or null. */
export function readBillTotal(text: string): string | null {
  return /Bill total: (.+)\.$/m.exec(text)?.[1] ?? null;
}

/** "Dish (menu id "x") has meat and pork in it. It suits a diner who eats no fish or seafood." */
function dietaryFact(id: ItemId, packId: LanguageCode): string {
  const contents = dishContents(id);
  const has = contents ? `has ${contents} in it` : 'has no meat, fish or seafood in it';
  const suits = DIETARY_NOTE_IDS.filter((note) => dishFits(id, note)).map((note) => DIETARY_NOTES[note].means);
  const who = suits.length > 0 ? `It suits a diner who ${suits.join(', or who ')}.` : 'It suits none of the usual dietary needs.';
  return `${CULTURE_PACKS[packId].goods[id].name} (menu id "${id}") ${has}. ${who}`;
}

/** What the bathhouse desk sells, and how gym membership works. */
function bathhouseFacts(packId: LanguageCode): string[] {
  const { goods } = CULTURE_PACKS[packId];
  const price = (id: ItemId) => formatLocalMoney(menuPrice(id, packId), packId);
  return [
    `Bath entry: ${goods['bath-entry'].name}, ${price('bath-entry')}. A towel to borrow and the sauna or steam room come with it at no extra charge.`,
    `Gym membership: ${goods['gym-membership'].name}, ${price('gym-membership')}. It gives ${ECONOMY.gymMembershipDays} days at the gym, and members may work out once a day.`,
    'Membership is never renewed automatically. Once it runs out, the member renews it here, with you, and pays again.',
  ];
}

/** A day the rent is due, as the landlord would say it. */
function dueOn(day: number, today: number) {
  if (day === today) return 'today';
  const weekday = weekdayOf(day);
  return `${day - today < WEEKDAYS.length ? 'this' : 'next'} ${weekday[0]!.toUpperCase()}${weekday.slice(1)}`;
}

/** Local money as a plain number, as `accept_rent` takes it. */
const plainAmount = (shifts: number, packId: LanguageCode) => Math.round(shifts * CULTURE_PACKS[packId].currency.perShift * 100) / 100;

/** What the tenant owes the landlord: this week's rent, rent debt, and the total in local money and as `accept_rent`'s plain number. */
function rentFacts({ today, dueDay, owedThisWeekInShifts, debtInShifts, weeklyRentInShifts }: RentStatement, packId: LanguageCode): string[] {
  const money = (shifts: number) => formatLocalMoney(shifts, packId);
  const total = owedThisWeekInShifts + debtInShifts;
  return [
    owedThisWeekInShifts > 0
      ? `This week's rent still to pay: ${money(owedThisWeekInShifts)}, due by the end of ${dueOn(dueDay, today)}.`
      : `This week's rent is paid. Next week's rent is ${money(weeklyRentInShifts)}.`,
    ...(debtInShifts > 0 ? [`Unpaid rent from before, owed now: ${money(debtInShifts)}.`] : []),
    total > 0
      ? `Altogether the tenant owes ${money(total)} (for accept_rent: ${plainAmount(total, packId)}).`
      : 'The tenant owes nothing at the moment.',
    'Rent is paid to you, here. A payment goes to unpaid rent from before first, then to this week’s rent.',
  ];
}

/** The landlord's news: what each week's rent is now the Newcomer Discount is smaller. */
function newcomerDiscountFacts({ weeklyRentInShifts }: RentStatement, packId: LanguageCode): string[] {
  return [
    `From now on the tenant's weekly rent is ${formatLocalMoney(weeklyRentInShifts, packId)}.`,
    'Rent already owed stays as it was.',
    'Their discount was for newcomers who are still finding their feet. Now they are settling in, they get less of it.',
  ];
}

/** What `rentFacts` wrote into this text that the tenant owes altogether, as local money and as `accept_rent`'s plain number, or null. */
export function readRentOwed(text: string): { money: string; amount: number } | null {
  const owed = [...text.matchAll(/Altogether the tenant owes (.+) \(for accept_rent: ([\d.]+)\)\.$/gm)].at(-1);
  return owed ? { money: owed[1]!, amount: Number(owed[2]) } : null;
}

/** The new weekly rent `newcomerDiscountFacts` wrote into this text, as local money, or null. */
export function readNewWeeklyRent(text: string): string | null {
  return /From now on the tenant's weekly rent is (.+)\.$/m.exec(text)?.[1] ?? null;
}

/**
 * What the NPC is told about the moment: the shopping on the counter, for the landlord, the rent, and for the server,
 * the bill and any restaurant debt, in Shifts, from a bill walked out on.
 */
export type FactsContext = { basket?: Basket; rent?: RentStatement; bill?: Basket; restaurantDebt?: number };

/**
 * The facts an interaction's NPC knows, in English, pulled from the Culture
 * Pack, or for the ward, from what Fainting costs. At the till, the cashier
 * also knows what the customer has brought to the counter (`basket`), and the
 * landlord knows what the tenant owes (`rent`). The restaurant's server knows the guest's `bill`, and what they owe
 * from a bill they walked out on (`restaurantDebt`).
 */
export function interactionFacts(
  interaction: Interaction,
  packId: LanguageCode,
  { basket = [], rent, bill = [], restaurantDebt = 0 }: FactsContext = {},
): string[] {
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
      case 'dietary':
        return interaction.items.filter(isDish).map((id) => dietaryFact(id, packId));
      case 'stock':
        return interaction.items.map((id) => {
          const { about } = ITEMS[id];
          return `For sale: ${goods[id].name}, ${formatLocalMoney(menuPrice(id, packId), packId)} (menu id "${id}")${about ? `: ${about}` : ''}.`;
        });
      case 'shelves':
        return interaction.items.map(
          (id) => `On the shelves: ${goods[id].name} (shelf id "${id}"), ${formatLocalMoney(menuPrice(id, packId), packId)}.`,
        );
      case 'basket':
        return basketFacts(basket, packId);
      case 'bill':
        return billFacts(bill, restaurantDebt, packId);
      case 'placeFacts':
        return localPlaceFacts(placeId, packId);
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
      case 'bathhouse':
        return bathhouseFacts(packId);
      case 'rent':
        return rent ? rentFacts(rent, packId) : [];
      case 'newcomerDiscount':
        return rent ? newcomerDiscountFacts(rent, packId) : [];
    }
  });
}
