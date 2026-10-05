import { z } from 'zod';
import { ECONOMY } from '../sim/index.ts';
import { defineInteraction, type Interaction } from './defineInteraction.ts';
import { CAFE_MENU, type ItemId } from './items.ts';

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
