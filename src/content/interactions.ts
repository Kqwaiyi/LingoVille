import { z } from 'zod';
import { ECONOMY, ILLNESS_IDS } from '../sim/index.ts';
import { defineInteraction, PASSER_BY, SHIPPING_SPEEDS, type Interaction } from './defineInteraction.ts';
import { MEDICINE_IDS } from './illnesses.ts';
import {
  ALLERGENS,
  BATH_OPTIONS,
  BILL_METHODS,
  CAFE_COUNTER,
  CONVENIENCE_MENU,
  DIETARY_NOTE_IDS,
  DRINK_EXTRAS,
  DRINK_SIZES,
  DRINK_TEMPERATURES,
  GIFTS_SOLD,
  GROCERIES_SOLD,
  MADE_TO_ORDER_EXTRAS,
  READING_SOLD,
  RESTAURANT_MENU,
  SEATING,
  type ItemId,
} from './items.ts';
import { TRAM_LINE } from './townNpcs.ts';

/** The lines of an order or a sale from a menu: each item by its menu id, and how many. */
const orderItems = (menu: readonly [ItemId, ...ItemId[]]) =>
  z
    .array(
      z.object({
        item: z.enum(menu).describe('The menu id given in FACTS.'),
        quantity: z.int().min(1).max(ECONOMY.maxQuantityPerOrderLine),
      }),
    )
    .min(1);

/** `serve_order(items[])` over a menu: the café, convenience store and restaurant orders share it. */
const serveOrder = (menu: readonly [ItemId, ...ItemId[]]) => ({
  name: 'serve_order',
  description:
    'Serve the customer exactly the order they confirmed after your read-back. ' +
    'Answers "served", "cannot_afford" (they cannot pay for it) or "invalid_arguments".',
  args: z.object({ items: orderItems(menu) }),
});

/** Why this café order line's options don't fit how its item is made, for the NPC, or null if they do. */
function optionsProblem({ item, size, temperature, extras = [] }: z.infer<typeof cafeLineFields>): string | null {
  const takes = MADE_TO_ORDER_EXTRAS[item];
  if (!takes) {
    return size || temperature || extras.length > 0 ? `"${item}" is not made to order: leave out its size, hot or iced, and extras.` : null;
  }
  if (!size || !temperature) return `"${item}" is made to order: ask the customer what size they would like and whether hot or iced, and give both.`;
  const refused = extras.find((extra) => !takes.includes(extra));
  return refused ? `"${item}" can't have "${refused}" added: it takes only ${takes.map((extra) => `"${extra}"`).join(', ')}.` : null;
}

/** One line of a café order with options: a drink made to order comes in a size, hot or iced, with any extras it takes. */
const cafeLineFields = z.object({
  item: z.enum(CAFE_COUNTER).describe('The menu id given in FACTS.'),
  quantity: z.int().min(1).max(ECONOMY.maxQuantityPerOrderLine),
  size: z.enum(DRINK_SIZES).optional().describe('Only for a drink made to order (see FACTS): its size id. Leave it out for anything else.'),
  temperature: z.enum(DRINK_TEMPERATURES).optional().describe('Only for a drink made to order: "hot" or "iced". Leave it out for anything else.'),
  extras: z
    .array(z.enum(DRINK_EXTRAS))
    .optional()
    .describe('Only for a drink made to order: the ids of the extras added to it, from those FACTS say it takes. Empty for none.'),
});

/** `serve_order(items[])` at the café, with how each drink made to order is made (#2, #3). */
const serveCafeOrder = {
  ...serveOrder(CAFE_COUNTER),
  args: z.object({
    items: z
      .array(
        cafeLineFields.superRefine((line, context) => {
          const problem = optionsProblem(line);
          if (problem) context.addIssue({ code: 'custom', message: problem });
        }),
      )
      .min(1),
  }),
};

/** `complete_purchase(items[])` at the bookshop: selling something to read, asked for by name (#18) or recommended (#20). */
const sellReading = {
  name: 'complete_purchase',
  description:
    'Sell the customer exactly what they confirmed after your read-back, and take payment. ' +
    'Answers "served", "cannot_afford" (they cannot pay for it) or "invalid_arguments".',
  args: z.object({ items: orderItems(READING_SOLD) }),
};

/** `serve_order(items[])` at a restaurant table: the meal goes on the bill, which the guest pays when they ask for it. */
const serveMeal = {
  name: 'serve_order',
  description:
    'Serve the guest exactly the meal they confirmed after your read-back. It goes on their bill, which they pay later. ' +
    'Answers "served", "cannot_afford" (they could not pay for it) or "invalid_arguments".',
  args: z.object({ items: orderItems(RESTAURANT_MENU) }),
};

/** `register_member()` at the bathhouse desk: joining the gym, or renewing a membership that has run out (#22). */
const registerMember = {
  name: 'register_member',
  description:
    `Register the customer as a gym member for ${ECONOMY.gymMembershipDays} days and take payment, once they have confirmed your ` +
    'read-back of the membership and its price. Answers "done", "cannot_afford" (they cannot pay for it) or "invalid_arguments".',
  args: z.object({
    kind: z.enum(['join', 'renew']).describe('Whether they are joining for the first time, or renewing a membership that has run out.'),
  }),
};

/** When a hired applicant says they can start. Shifts have no schedule, so it is only what was agreed. */
export const START_WHEN = ['today', 'tomorrow', 'this_week', 'next_week'] as const;

/** `hire_applicant(name, start)`: the hiring Goal Interactions (#26–28) share it. The sim checks the name. */
const hireApplicant = {
  name: 'hire_applicant',
  description:
    'Hire the applicant, once they have told you their name and when they can start and confirmed your read-back. ' +
    'Answers "done", or "wrong_name" (that is not their name: you misheard it).',
  args: z.object({
    name: z
      .string()
      .min(1)
      .describe('Their name exactly as they said it. If they spelled it out, use that spelling; write a foreign name in Latin letters.'),
    start: z.enum(START_WHEN).describe('When they said they can start.'),
  }),
};

/** `accept_rent(amount)`: paying the landlord, whether the Player came to pay or the landlord caught them. */
const acceptRent = {
  name: 'accept_rent',
  description:
    'Take rent from the tenant: the amount they confirmed after your read-back, in local money as a plain number ' +
    '(for example 6000 for ¥6,000, or 72.5 for €72.50). Answers "done", "cannot_afford" (they do not have that much) ' +
    'or "invalid_arguments" (more than they owe).',
  args: z.object({ amount: z.number().positive().describe('The amount handed over, in local money.') }),
};

export const INTERACTIONS = {
  orderDrink: defineInteraction({
    id: 'order-drink',
    placeId: 'cafe',
    npcId: 'barista',
    goal: "Take the customer's order.",
    facts: ['openingHours', 'menu', 'placeFacts', 'customs'],
    items: CAFE_COUNTER,
    completion: serveOrder(CAFE_COUNTER),
    band: 'B',
    effect: { kind: 'serveOrder' },
  }),
  // #2. A drink made to order and something to eat. E at the barista in the Intermediate band.
  orderWithOptions: defineInteraction({
    id: 'order-with-options',
    placeId: 'cafe',
    npcId: 'barista',
    goal:
      "Take the customer's order: something to drink, and something to eat if they would like it. For a drink made to order, " +
      'ask what size they would like, whether hot or iced, and whether they would like anything added, using the drink options in FACTS.',
    facts: ['openingHours', 'menu', 'drinkOptions', 'placeFacts', 'customs'],
    items: CAFE_COUNTER,
    completion: serveCafeOrder,
    band: 'I',
    effect: { kind: 'serveOrder' },
  }),
  // #3. An order avoiding an allergen. E at the barista in the Advanced band. The sim rejects anything with the allergen in it.
  orderAvoidingAllergen: defineInteraction({
    id: 'order-avoiding-allergen',
    placeId: 'cafe',
    npcId: 'barista',
    goal:
      "Take the customer's order: something to drink, and something to eat if they would like it. Before they order, ask whether " +
      'they have any food allergies. If they do, use the allergy facts to help them choose only things with none of it in, and ' +
      'say so when something they ask for has it. For a drink made to order, ask what size, whether hot or iced, and whether ' +
      'they would like anything added, using the drink options in FACTS.',
    facts: ['openingHours', 'menu', 'drinkOptions', 'allergens', 'placeFacts', 'customs'],
    items: CAFE_COUNTER,
    completion: {
      ...serveCafeOrder,
      args: serveCafeOrder.args.extend({
        allergen: z
          .enum([...ALLERGENS, 'none'])
          .describe('What the customer told you they are allergic to, which nothing in the order may have in it, or "none" if they have no allergy.'),
      }),
    },
    band: 'A',
    effect: { kind: 'serveOrder' },
  }),
  // #26. Asking the barista for work. Until the Character is hired, F at the barista asks.
  askBaristaForWork: defineInteraction({
    id: 'ask-barista-for-work',
    placeId: 'cafe',
    npcId: 'barista',
    goal:
      'This person has come to the counter to ask for work as a barista, and the café is hiring. ' +
      'Greet them as you would anyone and let them ask. Then interview them briefly: ask their name and when they can start. ' +
      'There is no rota: once hired, they come in by the staff door any day the café is open and work a shift.',
    facts: ['openingHours', 'placeFacts'],
    items: [],
    completion: hireApplicant,
    band: 'B',
    effect: { kind: 'hire', jobId: 'barista' },
  }),
  // #27. Asking the cashier for work. Until the Character is hired, F at the cashier asks (when not paying for shopping).
  askCashierForWork: defineInteraction({
    id: 'ask-cashier-for-work',
    placeId: 'supermarket',
    npcId: 'cashier',
    goal:
      'This person has come to the till to ask for work as a cashier, and the supermarket is hiring. ' +
      'Greet them as you would anyone and let them ask. Then interview them briefly: ask their name and when they can start. ' +
      'There is no rota: once hired, they come in by the staff door any day the supermarket is open and work a shift on the till.',
    facts: ['openingHours', 'placeFacts'],
    items: [],
    completion: hireApplicant,
    band: 'B',
    effect: { kind: 'hire', jobId: 'cashier' },
  }),
  // #28. Asking the server for work. Until the Character is hired, F at the server asks.
  askServerForWork: defineInteraction({
    id: 'ask-server-for-work',
    placeId: 'restaurant',
    npcId: 'server',
    goal:
      'This person has come in to ask for work as a server, and the restaurant is hiring. ' +
      'Greet them as you would anyone and let them ask. Then interview them briefly: ask their name and when they can start. ' +
      'There is no rota: once hired, they come in by the staff door any day the restaurant is open and work a shift waiting tables.',
    facts: ['openingHours', 'placeFacts'],
    items: [],
    completion: hireApplicant,
    band: 'B',
    effect: { kind: 'hire', jobId: 'server' },
  }),
  // #4. The cashier rings up whatever the Character brought to the till.
  payForGroceries: defineInteraction({
    id: 'pay-for-groceries',
    placeId: 'supermarket',
    npcId: 'cashier',
    goal: "Ring up the customer's shopping and take payment. Ask whether they need a bag and whether they have a points card.",
    facts: ['openingHours', 'basket', 'placeFacts', 'customs'],
    items: GROCERIES_SOLD,
    completion: {
      name: 'complete_purchase',
      description:
        'Take payment for the shopping on the counter, once the customer has confirmed your read-back of the total and their choices. ' +
        'Answers "served", "cannot_afford" (they cannot pay for it) or "invalid_arguments".',
      args: z.object({
        bag: z.boolean().describe('The customer wants a bag.'),
        card: z.boolean().describe('The customer has a points card and showed it.'),
      }),
    },
    band: 'B',
    effect: { kind: 'purchase' },
  }),
  // #5. With nothing to pay for yet, the cashier helps the Character find something on the shelves.
  findAnItem: defineInteraction({
    id: 'find-an-item',
    placeId: 'supermarket',
    npcId: 'cashier',
    goal: 'The customer is looking for something on the shelves. Find out what, and show them where it is.',
    facts: ['openingHours', 'shelves', 'placeFacts'],
    items: GROCERIES_SOLD,
    completion: {
      name: 'point_to',
      description:
        'Point the customer to where an item is on the shelves, once they have confirmed which item they mean. ' +
        'Answers "done" or "invalid_arguments".',
      args: z.object({ item: z.enum(GROCERIES_SOLD).describe('The shelf id given in FACTS.') }),
    },
    band: 'B',
    effect: { kind: 'pointTo' },
  }),
  // #6. Bringing back something faulty bought at the supermarket. R at the cashier, with nothing to pay for, while the
  // Character has groceries from there. The sim checks they have it, and that it hasn't gone off.
  returnAnItem: defineInteraction({
    id: 'return-an-item',
    placeId: 'supermarket',
    npcId: 'cashier',
    goal:
      'The customer has brought back something they bought here, because something is wrong with it. Find out which item it is ' +
      'and what is wrong with it, and refund it.',
    facts: ['openingHours', 'shelves', 'returns', 'placeFacts'],
    items: GROCERIES_SOLD,
    completion: {
      name: 'refund',
      description:
        'Take the item back and pay the customer its shelf price, once they have confirmed your read-back of the item, what is wrong ' +
        'with it and the refund. Answers "done", or "invalid_arguments" (they have no such item with them, or it is past its date).',
      args: z.object({
        item: z.enum(GROCERIES_SOLD).describe('The shelf id given in FACTS of the item brought back.'),
        reason: z.string().min(1).describe('What is wrong with it, in a few words of English (for example "the eggs were cracked").'),
      }),
    },
    band: 'A',
    effect: { kind: 'refund' },
  }),
  // #7. A hot snack or a bento over the convenience store counter.
  buyCounterFood: defineInteraction({
    id: 'buy-counter-food',
    placeId: 'convenience-store',
    npcId: 'convenience-clerk',
    goal: "Sell the customer a hot snack or a bento from the counter. If they buy a bento, ask whether they'd like it heated.",
    facts: ['openingHours', 'menu', 'placeFacts', 'customs'],
    items: CONVENIENCE_MENU,
    completion: serveOrder(CONVENIENCE_MENU),
    band: 'B',
    effect: { kind: 'serveOrder' },
  }),
  // #18. Buying a book or a magazine at the bookshop: a Comfort Purchase.
  buyABook: defineInteraction({
    id: 'buy-a-book',
    placeId: 'bookshop',
    npcId: 'shopkeeper',
    goal: 'Sell the customer a book or a magazine. Find out which one they would like.',
    facts: ['openingHours', 'stock'],
    items: READING_SOLD,
    completion: sellReading,
    band: 'B',
    effect: { kind: 'serveOrder' },
  }),
  // #19. Buying a gift at the bookshop, wrapped or not. It goes into the inventory, ready to give.
  buyAGift: defineInteraction({
    id: 'buy-a-gift',
    placeId: 'bookshop',
    npcId: 'shopkeeper',
    goal:
      'The customer wants to buy a gift for someone. Help them choose one, and ask whether they would like it gift-wrapped: ' +
      'wrapping is free. Read back the gift, its price and whether to wrap it.',
    facts: ['openingHours', 'stock'],
    items: GIFTS_SOLD,
    completion: {
      name: 'complete_purchase',
      description:
        'Sell the customer the gift they confirmed after your read-back, wrapped if they asked, and take payment. ' +
        'Answers "served", "cannot_afford" (they cannot pay for it) or "invalid_arguments".',
      args: z.object({
        items: orderItems(GIFTS_SOLD),
        wrap: z.boolean().describe('The customer wants it gift-wrapped.'),
      }),
    },
    band: 'I',
    effect: { kind: 'serveOrder' },
  }),
  // #20. Asking the shopkeeper to recommend something by taste. From the Advanced band, E at the shopkeeper starts it instead of #18.
  recommendABook: defineInteraction({
    id: 'recommend-a-book',
    placeId: 'bookshop',
    npcId: 'shopkeeper',
    goal:
      'The customer would like you to recommend something to read. Ask what they like (what they enjoy reading, or doing), ' +
      'then recommend the book or magazine in FACTS that suits their taste best, and say why. ' +
      'If they would rather have something else in FACTS, sell them that.',
    facts: ['openingHours', 'stock'],
    items: READING_SOLD,
    completion: sellReading,
    band: 'A',
    effect: { kind: 'serveOrder' },
  }),
  // #8. Getting a table at the restaurant. E at the server, until the Character has one.
  getATable: defineInteraction({
    id: 'get-a-table',
    placeId: 'restaurant',
    npcId: 'server',
    goal:
      'A guest has just come into the restaurant. Welcome them, ask how many they are and where they would like to sit ' +
      '(at a table, at the counter or by the window), and seat them.',
    facts: ['openingHours', 'placeFacts'],
    items: [],
    completion: {
      name: 'seat_guest',
      description: 'Seat the guest, once they have confirmed your read-back of how many they are and where they will sit. Answers "done".',
      args: z.object({
        party: z.int().min(1).max(ECONOMY.maxRestaurantParty).describe('How many people are in the party.'),
        seating: z.enum(SEATING).describe('Where they asked to sit.'),
      }),
    },
    band: 'B',
    effect: { kind: 'seatGuest' },
  }),
  // #9. Ordering a meal at the table: a Comfort Purchase. E at the server once seated. It goes on the bill.
  // No restaurant interaction gets the café's `customs`: they say there's no table service.
  orderAMeal: defineInteraction({
    id: 'order-a-meal',
    placeId: 'restaurant',
    npcId: 'server',
    goal: 'Take the order of the guest at your table: a main dish and a drink make a meal. Answer any questions about the menu.',
    facts: ['openingHours', 'menu', 'placeFacts'],
    items: RESTAURANT_MENU,
    completion: serveMeal,
    band: 'I',
    effect: { kind: 'orderMeal' },
  }),
  // #10. A recommendation within a dietary restriction. F at the server once seated. The sim rejects a dish that breaks it.
  recommendAMeal: defineInteraction({
    id: 'recommend-a-meal',
    placeId: 'restaurant',
    npcId: 'server',
    goal:
      'The guest at your table would like you to recommend a dish. Ask whether there is anything they do not eat, ' +
      'then recommend a dish from the menu that keeps to it, using the dietary facts, and say why. Take their order of that, and a drink. ' +
      'If there is nothing they do not eat, tell them everything on the menu is fine and they can order whatever they like.',
    facts: ['openingHours', 'menu', 'dietary', 'placeFacts'],
    items: RESTAURANT_MENU,
    completion: {
      ...serveMeal,
      args: serveMeal.args.extend({
        restriction: z.enum(DIETARY_NOTE_IDS).describe('The dietary need the guest told you, which every dish must keep to.'),
      }),
    },
    band: 'A',
    effect: { kind: 'orderMeal' },
  }),
  // #11. Paying the bill. E at the server while anything is on it, or while a bill walked out on is owed as debt.
  payTheBill: defineInteraction({
    id: 'pay-the-bill',
    placeId: 'restaurant',
    npcId: 'server',
    goal: 'The guest would like to pay. Tell them their bill total, ask how they would like to pay, and take payment.',
    facts: ['bill', 'placeFacts'],
    items: [],
    completion: {
      name: 'settle_bill',
      description:
        'Take payment for the whole bill, once the guest has confirmed your read-back of the total and how they pay. ' +
        'Answers "done", "cannot_afford" (they cannot pay it) or "invalid_arguments".',
      args: z.object({ method: z.enum(BILL_METHODS).describe('How the guest pays.') }),
    },
    band: 'B',
    effect: { kind: 'settleBill' },
  }),
  // #21. A bath at the bathhouse: a Comfort Purchase, and the biggest Mood lift. E at the attendant.
  buyBathEntry: defineInteraction({
    id: 'buy-bath-entry',
    placeId: 'bathhouse',
    npcId: 'attendant',
    goal:
      'Sell the customer entry to the bath. Ask whether they would like to borrow a towel, and answer anything they ask about ' +
      'the bath and how to use it.',
    facts: ['openingHours', 'bathhouse', 'placeFacts'],
    items: ['bath-entry'],
    completion: {
      name: 'admit',
      description:
        'Let the customer into the bath and take payment, once they have confirmed your read-back of the entry and its price. ' +
        'Answers "done", "cannot_afford" (they cannot pay for it) or "invalid_arguments".',
      args: z.object({
        options: z
          .array(z.enum(BATH_OPTIONS))
          .describe('What they asked for: "towel" to borrow a towel, "sauna" for the sauna or steam room. Both come with entry. Empty if neither.'),
      }),
    },
    band: 'B',
    effect: { kind: 'admit' },
  }),
  // #22. Joining the gym at the bathhouse desk, and asking about the rules. F at the attendant, until the Character is a member.
  joinTheGym: defineInteraction({
    id: 'join-the-gym',
    placeId: 'bathhouse',
    npcId: 'attendant',
    goal:
      'The customer is asking about the gym. Explain how membership works and any gym rules they ask about, and sign them up ' +
      'if they want to join.',
    facts: ['openingHours', 'bathhouse', 'placeFacts'],
    items: ['gym-membership'],
    completion: registerMember,
    band: 'I',
    effect: { kind: 'registerMember' },
  }),
  // #22's short renewal path. F at the attendant once the Character's membership has run out: it is never renewed automatically.
  renewGymMembership: defineInteraction({
    id: 'renew-gym-membership',
    placeId: 'bathhouse',
    npcId: 'attendant',
    goal:
      "This customer is a gym member whose membership has run out, and the gym won't let them in until it is renewed. " +
      `They have come to the desk about it. Offer to renew it for another ${ECONOMY.gymMembershipDays} days, tell them the price, and renew it if they agree.`,
    facts: ['openingHours', 'bathhouse', 'placeFacts'],
    items: ['gym-membership'],
    completion: registerMember,
    band: 'I',
    effect: { kind: 'registerMember' },
  }),
  // #12. Checking in at the clinic's reception: E at the receptionist. The doctor then calls the Character's name.
  checkIn: defineInteraction({
    id: 'check-in',
    placeId: 'clinic',
    npcId: 'receptionist',
    goal:
      'A patient has come to reception. Find out why they have come, and check them in to see the doctor. ' +
      'Tell them to take a seat in the waiting room: the doctor will call their name.',
    facts: ['openingHours', 'clinic', 'placeFacts'],
    items: [],
    completion: {
      name: 'register_patient',
      description:
        'Check the patient in to see the doctor, once they have confirmed your read-back of why they have come. Answers "done".',
      args: z.object({ reason: z.string().min(1).describe('Why they have come, in a few words of English (for example "a cough and a sore throat").') }),
    },
    band: 'I',
    effect: { kind: 'registerPatient' },
  }),
  // #13. Describing symptoms to the doctor. Not one the Player starts: the doctor calls the Character's name after check-in.
  // The doctor never knows the Illness, only what the Player describes, so the diagnosis is right only if they got it across.
  seeTheDoctor: defineInteraction({
    id: 'see-the-doctor',
    placeId: 'clinic',
    npcId: 'doctor',
    goal:
      'You have called this patient in from the waiting room. Ask what the trouble is, and listen to their symptoms. ' +
      'Work out from the symptoms they describe which illness in FACTS they have: go only by what they tell you, and ask about ' +
      'their symptoms until they fit one illness. Tell them what it is, and that the pharmacist will give them the medicine.',
    facts: ['symptoms', 'clinic'],
    items: [],
    completion: {
      name: 'diagnose',
      description:
        'Record your diagnosis and the prescription that goes with it, once you have told the patient what they have and they have ' +
        'understood. Answers "done".',
      args: z.object({ illness: z.enum(ILLNESS_IDS).describe('The illness id in FACTS whose symptoms the patient described.') }),
    },
    band: 'I',
    effect: { kind: 'diagnose' },
  }),
  // #14. Collecting medicine at the pharmacy: E at the pharmacist while the Character holds a prescription.
  getMedicine: defineInteraction({
    id: 'get-medicine',
    placeId: 'clinic',
    npcId: 'pharmacist',
    goal:
      "Give the patient the medicine on the doctor's prescription in FACTS, and take payment. Tell them how to take it " +
      'if they ask.',
    facts: ['prescription'],
    items: MEDICINE_IDS,
    completion: {
      name: 'dispense',
      description:
        'Hand over the medicine and take payment, once the patient has confirmed your read-back of the medicine and its price. ' +
        'Answers "served", "cannot_afford" (they cannot pay for it) or "invalid_arguments" (that is not what was prescribed).',
      args: z.object({ medicine: z.enum(MEDICINE_IDS).describe('The medicine id given in FACTS.') }),
    },
    band: 'B',
    effect: { kind: 'dispense' },
  }),
  // #15. Settling the hospital bill at reception, in full or in weekly instalments: F at the receptionist while it is owed.
  settleHospitalBill: defineInteraction({
    id: 'settle-hospital-bill',
    placeId: 'clinic',
    npcId: 'receptionist',
    goal:
      'The patient has come to settle what they owe the hospital. Tell them how much it is, and ask whether they will pay it all ' +
      `now or in weekly instalments (up to ${ECONOMY.maxPaymentPlanWeeks} weeks), and settle it the way they choose.`,
    facts: ['hospitalBill', 'placeFacts'],
    items: [],
    completion: {
      name: 'set_payment_plan',
      description:
        'Settle the hospital bill the way the patient confirmed after your read-back: paid in full now, or in weekly instalments. ' +
        'Answers "done", "cannot_afford" (they cannot pay it all now) or "invalid_arguments".',
      args: z.object({
        weeks: z
          .int()
          .min(0)
          .max(ECONOMY.maxPaymentPlanWeeks)
          .describe('How many weekly instalments to pay it in, or 0 to pay it all now.'),
      }),
    },
    band: 'A',
    effect: { kind: 'setPaymentPlan' },
  }),
  // #23. Registering the Character's address at the town office. F at the clerk, until it is registered. Flavour only:
  // it is recorded in the save, once the sim has checked the name.
  registerAddress: defineInteraction({
    id: 'register-address',
    placeId: 'town-office',
    npcId: 'office-clerk',
    goal:
      'A newcomer has come to register their address. Fill in the resident registration form with them: ask their full name, ' +
      'their address in town and their nationality, and register them.',
    facts: ['openingHours', 'registration', 'placeFacts'],
    items: [],
    completion: {
      name: 'register_resident',
      description:
        'Register the resident, once they have confirmed your read-back of the form. Answers "done", "wrong_name" (that is not ' +
        'their name: you misheard it) or "invalid_arguments".',
      args: z.object({
        fields: z.object({
          name: z
            .string()
            .min(1)
            .describe('Their full name exactly as they said it. If they spelled it out, use that spelling; write a foreign name in Latin letters.'),
          address: z.string().min(1).describe('Their address in town, as they said it.'),
          nationality: z.string().min(1).describe('Their nationality, in English.'),
        }),
      }),
    },
    band: 'A',
    effect: { kind: 'registerResident' },
  }),
  // #24. Sending a parcel home from the post office counter. E at the town office's clerk.
  sendAParcel: defineInteraction({
    id: 'send-a-parcel',
    placeId: 'town-office',
    npcId: 'office-clerk',
    goal:
      'The customer wants to send a parcel. Ask where it is going, and how they would like to send it, and take the postage.',
    facts: ['openingHours', 'post', 'placeFacts'],
    items: [],
    completion: {
      name: 'ship',
      description:
        'Send the parcel and take the postage, once the customer has confirmed your read-back of where it is going, how and the ' +
        'price. Answers "done", "cannot_afford" (they cannot pay for it) or "invalid_arguments".',
      args: z.object({
        destination: z.string().min(1).describe('Where the parcel is going (a country, or a city and country), in English.'),
        speed: z.enum(SHIPPING_SPEEDS).describe('The speed id given in FACTS.'),
      }),
    },
    band: 'I',
    effect: { kind: 'ship' },
  }),
  // #25. Asking someone waiting at a tram stop which tram goes to a place. E at a passer-by. The stop to get off at is marked.
  askForDirections: defineInteraction({
    id: 'ask-for-directions',
    placeId: 'tram-stop',
    npcId: PASSER_BY,
    goal:
      'A stranger has asked you something while you wait for the tram: they want to know how to get somewhere by tram. ' +
      'Find out where they want to go, and tell them which stop to get off at.',
    facts: ['tramLine'],
    items: [],
    completion: {
      name: 'give_directions',
      description: 'Call this once you have told them which stop to get off at and they have confirmed they have it. Answers "done".',
      args: z.object({ stop: z.enum(TRAM_LINE).describe('The stop id given in FACTS of the stop to get off at.') }),
    },
    band: 'B',
    effect: { kind: 'giveDirections' },
  }),
  // Not one the Player starts: the nurse begins it when the Character wakes from Fainting.
  wakeInWard: defineInteraction({
    id: 'wake-in-ward',
    placeId: 'clinic',
    npcId: 'nurse',
    goal:
      'The patient fainted yesterday from not eating or drinking and has slept on your ward. They have just woken up. ' +
      'Ask how they feel, and once they have told you, let them go home.',
    facts: ['ward'],
    items: [],
    completion: {
      name: 'discharge_patient',
      description: 'Let the patient go home, once they have told you how they feel. Answers "done".',
      args: z.object({ feeling: z.enum(['well', 'unwell']).describe('How the patient said they feel.') }),
    },
    band: 'B',
    effect: { kind: 'none' },
  }),
  // #16. Pay the landlord at home: rent debt first, then this week's rent.
  payRent: defineInteraction({
    id: 'pay-rent',
    placeId: 'home',
    npcId: 'landlord',
    goal: 'Your tenant has come to pay rent. Find out how much they want to pay of what they owe, and take it.',
    facts: ['rent'],
    items: [],
    completion: acceptRent,
    band: 'B',
    effect: { kind: 'payRent' },
  }),
  // #17. Ask the landlord for more time to pay.
  askForMoreTime: defineInteraction({
    id: 'ask-for-more-time',
    placeId: 'home',
    npcId: 'landlord',
    goal:
      'Your tenant wants more time to pay the rent. Hear them out: why, and how long they need. ' +
      `Agree on a number of extra days, never more than ${ECONOMY.maxRentExtensionDays}. If they ask for more, haggle them down.`,
    facts: ['rent'],
    items: [],
    completion: {
      name: 'grant_extension',
      description: 'Give the tenant more days to pay, once they have confirmed the number of days you agreed. Answers "done".',
      args: z.object({ days: z.int().min(1).max(ECONOMY.maxRentExtensionDays).describe('How many extra days you agreed.') }),
    },
    band: 'A',
    effect: { kind: 'extendRent' },
  }),
  // Not one the Player starts: the landlord catches the Character in the hallway when rent is due and unpaid.
  rentReminder: defineInteraction({
    id: 'rent-reminder',
    placeId: 'home',
    npcId: 'landlord',
    goal:
      'You have caught your tenant in the hallway: their rent is due and unpaid. Remind them politely what they owe and by when, ' +
      'and take it if they want to pay now. If they cannot pay, tell them they can come and ask you for more time.',
    facts: ['rent'],
    items: [],
    completion: acceptRent,
    band: 'B',
    effect: { kind: 'payRent' },
  }),
  // Not one the Player starts: the landlord tells the Character their Newcomer Discount has stepped down.
  newcomerDiscountNews: defineInteraction({
    id: 'newcomer-discount-news',
    placeId: 'home',
    npcId: 'landlord',
    goal:
      "You have stopped your tenant in the hallway with news: their newcomer's discount on the rent is getting smaller, " +
      'because they are settling in and their language has come on so well. Tell them, with the new weekly rent, ' +
      'and make sure they have understood. Never speak of percentages.',
    facts: ['newcomerDiscount'],
    items: [],
    completion: {
      name: 'finish_rent_news',
      description: 'Finish telling the tenant about their new rent, once they have answered you. Answers "done".',
      args: z.object({ understood: z.boolean().describe('The tenant showed they understood the new rent.') }),
    },
    band: 'B',
    effect: { kind: 'none' },
  }),
} satisfies Record<string, Interaction>;
