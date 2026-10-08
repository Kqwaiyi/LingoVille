import {
  ECONOMY,
  ILLNESS_IDS,
  weekdayOf,
  WEEKDAYS,
  type Basket,
  type HospitalStatement,
  type LanguageCode,
  type OpeningHours,
  type RentStatement,
} from '../sim/index.ts';
import { cafeAllergensIn, CULTURE_PACKS, localPlaceFacts, localPlaceName } from './culturePacks.ts';
import { chargeInShifts, formatLocalMoney, menuPrice } from './currency.ts';
import type { Interaction } from './defineInteraction.ts';
import {
  ALLERGENS,
  DIETARY_NOTE_IDS,
  DIETARY_NOTES,
  dishContents,
  dishFits,
  DRINK_EXTRAS,
  DRINK_SIZES,
  DRINK_TEMPERATURES,
  EXTRA_ALLERGENS,
  isDish,
  isMadeToOrder,
  ITEMS,
  MADE_TO_ORDER_EXTRAS,
  type DrinkOptionId,
  type ItemId,
} from './items.ts';
import { ILLNESSES, MEDICINE_IDS, type MedicineId } from './illnesses.ts';
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

/** What a visit and medicine cost at the clinic, and how a visit goes. */
function clinicFacts(packId: LanguageCode): string[] {
  const money = (shifts: number) => formatLocalMoney(shifts, packId);
  return [
    'Patients check in at reception, then wait in the waiting room until the doctor calls their name.',
    `A visit to the doctor costs ${money(chargeInShifts(ECONOMY.consultationFeeInShifts, packId))}. It is taken from the patient's money ` +
      'if they have enough; otherwise they owe it to the hospital, and settle it later at reception.',
    // Every medicine costs the same.
    `Medicine from the pharmacy here costs ${money(menuPrice(MEDICINE_IDS[0], packId))}, paid at the pharmacy. It is given only on the doctor's prescription.`,
  ];
}

/** An id as English words: "sore-throat" → "sore throat". */
const words = (id: string) => id.replaceAll('-', ' ');
const capitalised = (text: string) => `${text[0]!.toUpperCase()}${text.slice(1)}`;

/** The doctor's knowledge: each Illness by its symptoms, and the medicine that treats it. Never which one the patient has. */
function symptomsFacts(packId: LanguageCode): string[] {
  const { goods } = CULTURE_PACKS[packId];
  return [
    "You don't know which illness the patient has: only the symptoms they tell you can show it.",
    ...ILLNESS_IDS.map((id) => {
      const { symptoms, medicine } = ILLNESSES[id];
      return `${capitalised(words(id))} (illness id "${id}"): ${symptoms.map(words).join(', ')}. Treated with ${goods[medicine].name}.`;
    }),
    "For flu, the medicine only brings the fever down: the patient must rest, and the flu clears after a good night's sleep.",
  ];
}

const PRESCRIPTION = "The patient's prescription from the doctor:";

/** What the doctor prescribed the patient, for the pharmacist: the medicine and its price, or that there's none. */
function prescriptionFacts(prescription: MedicineId | null, packId: LanguageCode): string[] {
  if (!prescription) return ["The patient has no prescription. Medicine is given only on a prescription from the doctor here."];
  const { name } = CULTURE_PACKS[packId].goods[prescription];
  return [
    `${PRESCRIPTION} ${name}, ${formatLocalMoney(menuPrice(prescription, packId), packId)} (medicine id "${prescription}").`,
    ...(prescription === 'fever-reducer' ? ['It brings a fever down. The patient should rest: flu clears after a good night’s sleep.'] : []),
    'Medicine is given only as prescribed.',
  ];
}

/** The medicine id `prescriptionFacts` wrote into this text, or null. */
export function readPrescription(text: string): MedicineId | null {
  const id = new RegExp(`${PRESCRIPTION} .+ \\(medicine id "([a-z-]+)"\\)\\.$`, 'm').exec(text)?.[1];
  return MEDICINE_IDS.find((medicine) => medicine === id) ?? null;
}

const HOSPITAL_OWED = 'The patient owes the hospital';

/** What the patient owes the hospital, and how it can be paid: all now, or in weekly instalments taken on rent day. */
function hospitalBillFacts({ today, owedInShifts, instalmentInShifts, rentDueDay }: HospitalStatement, packId: LanguageCode): string[] {
  const money = (shifts: number) => formatLocalMoney(shifts, packId);
  if (owedInShifts === 0) return ['The patient owes the hospital nothing.'];
  const weeks = Array.from({ length: ECONOMY.maxPaymentPlanWeeks - 1 }, (_, i) => i + 2);
  return [
    `${HOSPITAL_OWED} ${money(owedInShifts)}.`,
    'They can pay it all now (for set_payment_plan: weeks 0), or in equal weekly instalments ' +
      `over 1 to ${ECONOMY.maxPaymentPlanWeeks} weeks: ${weeks.map((n) => `${n} weeks is ${money(owedInShifts / n)} a week`).join(', ')}.`,
    `Instalments are taken automatically on rent day, the first at the end of ${dueOn(rentDueDay, today)}. One they can't pay stays owed.`,
    ...(instalmentInShifts !== null ? [`They are already paying ${money(instalmentInShifts)} a week; whatever they choose now replaces that.`] : []),
  ];
}

/** What `hospitalBillFacts` wrote into this text that the patient owes, as local money, or null. */
export function readHospitalOwed(text: string): string | null {
  return new RegExp(`${HOSPITAL_OWED} (.+)\\.$`, 'm').exec(text)?.[1] ?? null;
}

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
 * the bill and any restaurant debt, in Shifts, from a bill walked out on, for the pharmacist, the patient's prescription, and
 * for reception, the hospital bill.
 */
export type FactsContext = {
  basket?: Basket;
  rent?: RentStatement;
  bill?: Basket;
  restaurantDebt?: number;
  prescription?: MedicineId | null;
  hospital?: HospitalStatement;
};

/**
 * The facts an interaction's NPC knows, in English, pulled from the Culture
 * Pack, or for the ward, from what Fainting costs. At the till, the cashier
 * also knows what the customer has brought to the counter (`basket`), and the
 * landlord knows what the tenant owes (`rent`). The restaurant's server knows the guest's `bill`, and what they owe
 * from a bill they walked out on (`restaurantDebt`). The pharmacist knows the `prescription`, and reception the `hospital` bill.
 */
export function interactionFacts(
  interaction: Interaction,
  packId: LanguageCode,
  { basket = [], rent, bill = [], restaurantDebt = 0, prescription = null, hospital }: FactsContext = {},
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
      case 'drinkOptions':
        return drinkOptionsFacts(interaction.items, packId);
      case 'allergens':
        return allergenFacts(interaction.items, packId);
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
      case 'clinic':
        return clinicFacts(packId);
      case 'symptoms':
        return symptomsFacts(packId);
      case 'prescription':
        return prescriptionFacts(prescription, packId);
      case 'hospitalBill':
        return hospital ? hospitalBillFacts(hospital, packId) : [];
    }
  });
}
