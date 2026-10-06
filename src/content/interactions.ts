import { z } from 'zod';
import { ECONOMY } from '../sim/index.ts';
import { defineInteraction, type Interaction } from './defineInteraction.ts';
import { CAFE_MENU, CONVENIENCE_MENU, GROCERIES_SOLD, type ItemId } from './items.ts';

/** `serve_order(items[])` over a menu: the café, convenience store and restaurant orders share it. */
const serveOrder = (menu: readonly [ItemId, ...ItemId[]]) => ({
  name: 'serve_order',
  description:
    'Serve the customer exactly the order they confirmed after your read-back. ' +
    'Answers "served", "cannot_afford" (they cannot pay for it) or "invalid_arguments".',
  args: z.object({
    items: z
      .array(
        z.object({
          item: z.enum(menu).describe('The menu id given in FACTS.'),
          quantity: z.int().min(1).max(ECONOMY.maxQuantityPerOrderLine),
        }),
      )
      .min(1),
  }),
});

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
    items: CAFE_MENU,
    completion: serveOrder(CAFE_MENU),
    band: 'B',
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
