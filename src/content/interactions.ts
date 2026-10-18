import { z } from 'zod';
import { ECONOMY } from '../sim/index.ts';
import { defineInteraction, type Interaction } from './defineInteraction.ts';
import { ALLERGENS, CAFE_COUNTER, DRINK_EXTRAS, DRINK_SIZES, DRINK_TEMPERATURES, MADE_TO_ORDER_EXTRAS, type ItemId } from './items.ts';

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

/** `serve_order(items[])` over a menu: the café orders share it. */
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

/** `serve_order(items[])` at the café, with how each drink made to order is made. */
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
  // A drink made to order and something to eat. E at the barista in the Intermediate band.
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
  // An order avoiding an allergen. E at the barista in the Advanced band. The sim rejects anything with the allergen in it.
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
} satisfies Record<string, Interaction>;
