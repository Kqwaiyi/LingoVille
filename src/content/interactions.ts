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
} satisfies Record<string, Interaction>;
