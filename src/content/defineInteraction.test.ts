import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ECONOMY, LANGUAGE_CODES } from '../sim/index.ts';
import {
  CAFE_COUNTER,
  CONVENIENCE_MENU,
  CULTURE_PACKS,
  defineInteraction,
  formatLocalMoney,
  GROCERIES_SOLD,
  interactionFacts,
  INTERACTIONS,
  ITEMS,
  menuPrice,
  READING_SOLD,
  readBillTotal,
} from './index.ts';

function interactionWith(args: z.ZodObject) {
  return defineInteraction({
    id: 'test-interaction',
    placeId: 'cafe',
    npcId: 'barista',
    goal: 'Test goal.',
    facts: ['menu'],
    items: [],
    completion: { name: 'do_thing', description: 'Does the thing.', args },
    band: 'B',
    effect: { kind: 'none' },
  });
}

describe('defineInteraction', () => {
  it('turns the completion schema into a Live tool declaration', () => {
    const interaction = interactionWith(
      z.object({
        items: z
          .array(z.object({ item: z.enum(['tea', 'cake']).describe('What to serve.'), quantity: z.int().min(1).max(3) }))
          .min(1),
        note: z.string().optional(),
      }),
    );

    expect(interaction.toolDeclaration).toEqual({
      name: 'do_thing',
      description: 'Does the thing.',
      parameters: {
        type: 'OBJECT',
        properties: {
          items: {
            type: 'ARRAY',
            minItems: 1,
            items: {
              type: 'OBJECT',
              properties: {
                item: { type: 'STRING', enum: ['tea', 'cake'], description: 'What to serve.' },
                quantity: { type: 'INTEGER', minimum: 1, maximum: 3 },
              },
              required: ['item', 'quantity'],
            },
          },
          note: { type: 'STRING' },
        },
        required: ['items'],
      },
    });
  });

  it('validates arguments with the same schema the declaration came from', () => {
    const interaction = interactionWith(z.object({ size: z.enum(['small', 'large']), count: z.int().min(1).max(3) }));

    expect(interaction.parseArgs({ size: 'large', count: 2 })).toEqual({ success: true, data: { size: 'large', count: 2 } });
    for (const bad of [{ size: 'medium', count: 2 }, { size: 'large', count: 0 }, { size: 'large' }, 'large', null]) {
      expect(interaction.parseArgs(bad).success).toBe(false);
    }
  });

  it.each([
    ['an unknown place', { placeId: 'moon' }],
    ['an unknown NPC', { npcId: 'wizard' }],
    ['an empty goal', { goal: '' }],
    ['an unknown band', { band: 'X' }],
    ['no facts', { facts: [] }],
    ['a completion name the model cannot call', { completion: { name: 'Serve Order', description: 'x', args: z.object({}) } }],
    ['an item no pack knows', { items: ['champagne'] }],
    ['completion arguments that are not a Zod object', { completion: { name: 'serve', description: 'x', args: { items: [] } } }],
  ])('rejects a definition with %s', (_, override) => {
    const valid = {
      id: 'test-interaction',
      placeId: 'cafe',
      npcId: 'barista',
      goal: 'Test goal.',
      facts: ['menu'],
      items: [],
      completion: { name: 'do_thing', description: 'Does the thing.', args: z.object({}) },
      band: 'B',
      effect: { kind: 'none' },
    };
    // @ts-expect-error -- deliberately malformed content
    expect(() => defineInteraction({ ...valid, ...override })).toThrow();
  });
});

describe('waking in the ward: the nurse sees the patient home', () => {
  const { wakeInWard } = INTERACTIONS;

  it('is the nurse’s, at the clinic, and sells nothing', () => {
    expect(wakeInWard).toMatchObject({ npcId: 'nurse', placeId: 'clinic', items: [], effect: { kind: 'none' } });
  });

  it('declares discharge_patient with how the patient says they feel', () => {
    expect(wakeInWard.toolDeclaration.name).toBe('discharge_patient');
    expect(wakeInWard.parseArgs({ feeling: 'well' }).success).toBe(true);
    expect(wakeInWard.parseArgs({ feeling: 'unwell' }).success).toBe(true);
    expect(wakeInWard.parseArgs({ feeling: 'ecstatic' }).success).toBe(false);
  });
});

describe('Goal Interaction #1: order a drink', () => {
  const { orderDrink } = INTERACTIONS;

  it('declares serve_order with an item from the café counter (Comfort Purchases included) and a quantity', () => {
    expect(orderDrink.toolDeclaration.name).toBe('serve_order');
    const item = orderDrink.toolDeclaration.parameters.properties!.items!.items!.properties!.item!;
    expect(item.enum).toEqual([...CAFE_COUNTER]);
  });

  it('accepts an order of menu items and rejects anything else', () => {
    expect(orderDrink.parseArgs({ items: [{ item: 'latte', quantity: 1 }] }).success).toBe(true);
    expect(orderDrink.parseArgs({ items: [{ item: 'champagne', quantity: 1 }] }).success).toBe(false);
    expect(orderDrink.parseArgs({ items: [] }).success).toBe(false);
  });
});

describe('Goal Interaction #4: pay for groceries at the supermarket', () => {
  const { payForGroceries } = INTERACTIONS;

  it('is the cashier’s, at the supermarket, a beginner interaction that sells groceries', () => {
    expect(payForGroceries).toMatchObject({ npcId: 'cashier', placeId: 'supermarket', band: 'B', effect: { kind: 'purchase' } });
    expect(payForGroceries.items).toEqual([...GROCERIES_SOLD]);
  });

  it('declares complete_purchase(bag, card)', () => {
    const { name, parameters } = payForGroceries.toolDeclaration;
    expect(name).toBe('complete_purchase');
    expect(parameters.required).toEqual(['bag', 'card']);
    expect(parameters.properties!.bag!.type).toBe('BOOLEAN');
    expect(parameters.properties!.card!.type).toBe('BOOLEAN');
  });

  it('accepts a bag and points card choice and rejects anything else', () => {
    expect(payForGroceries.parseArgs({ bag: true, card: false }).success).toBe(true);
    expect(payForGroceries.parseArgs({ bag: 'yes', card: false }).success).toBe(false);
    expect(payForGroceries.parseArgs({ bag: true }).success).toBe(false);
  });

  it('charges for what the Character brought to the till, not for anything in the arguments', () => {
    const basket = [{ itemId: 'eggs' as const, quantity: 2 }];
    const resolved = payForGroceries.resolveCompletion({ bag: true, card: true }, 'ja', basket);
    expect(resolved).toMatchObject({ success: true, lines: [{ itemId: 'eggs', quantity: 2 }] });
  });

  it('has nothing to charge for with an empty basket', () => {
    expect(payForGroceries.resolveCompletion({ bag: true, card: true }, 'ja', []).success).toBe(false);
  });
});

describe('Goal Interaction #5: ask where an item is', () => {
  const { findAnItem } = INTERACTIONS;

  it('is the cashier’s, at the supermarket, a beginner interaction', () => {
    expect(findAnItem).toMatchObject({ npcId: 'cashier', placeId: 'supermarket', band: 'B', effect: { kind: 'pointTo' } });
  });

  it('declares point_to(item) over the groceries on the shelves', () => {
    expect(findAnItem.toolDeclaration.name).toBe('point_to');
    expect(findAnItem.toolDeclaration.parameters.properties!.item!.enum).toEqual([...GROCERIES_SOLD]);
    expect(findAnItem.parseArgs({ item: 'eggs' }).success).toBe(true);
    expect(findAnItem.parseArgs({ item: 'latte' }).success).toBe(false);
  });

  it('points to the item, in the pack’s words, and sells nothing', () => {
    expect(findAnItem.resolveCompletion({ item: 'eggs' }, 'de')).toEqual({
      success: true,
      lines: [],
      pointedTo: { itemId: 'eggs', name: 'Eier', glosses: { ja: '卵', zh: '鸡蛋', en: 'Eggs' }, quantity: 1 },
    });
  });
});

describe('Goal Interaction #7: counter food at the convenience store', () => {
  const { buyCounterFood } = INTERACTIONS;

  it('is the clerk’s, at the convenience store, a beginner order', () => {
    expect(buyCounterFood).toMatchObject({
      npcId: 'convenience-clerk',
      placeId: 'convenience-store',
      band: 'B',
      effect: { kind: 'serveOrder' },
    });
  });

  it('declares serve_order over the counter menu: a snack and a bento', () => {
    expect(buyCounterFood.toolDeclaration.name).toBe('serve_order');
    expect(buyCounterFood.toolDeclaration.parameters.properties!.items!.items!.properties!.item!.enum).toEqual([...CONVENIENCE_MENU]);
    expect(buyCounterFood.parseArgs({ items: [{ item: 'bento', quantity: 1 }] }).success).toBe(true);
    expect(buyCounterFood.parseArgs({ items: [{ item: 'latte', quantity: 1 }] }).success).toBe(false);
  });
});

describe('the landlord’s completions', () => {
  it('reads accept_rent’s amount as local money, and turns it into Shifts in each pack', () => {
    expect(INTERACTIONS.payRent.resolveCompletion({ amount: 6000 }, 'ja')).toEqual({ success: true, lines: [], rent: { kind: 'pay', amountInShifts: 1 } });
    expect(INTERACTIONS.payRent.resolveCompletion({ amount: 90 }, 'de')).toEqual({ success: true, lines: [], rent: { kind: 'pay', amountInShifts: 1.5 } });
    expect(INTERACTIONS.rentReminder.resolveCompletion({ amount: 240 }, 'zh')).toEqual({ success: true, lines: [], rent: { kind: 'pay', amountInShifts: 1 } });
  });

  it('refuses an amount that is not a positive sum of money', () => {
    for (const amount of [0, -60, 'sixty']) expect(INTERACTIONS.payRent.resolveCompletion({ amount }, 'en').success).toBe(false);
  });

  it('reads grant_extension’s days, from 1 up to the most the landlord will give', () => {
    expect(INTERACTIONS.askForMoreTime.resolveCompletion({ days: 3 }, 'en')).toEqual({ success: true, lines: [], rent: { kind: 'extend', days: 3 } });
    expect(INTERACTIONS.askForMoreTime.resolveCompletion({ days: 0 }, 'en').success).toBe(false);
    expect(INTERACTIONS.askForMoreTime.resolveCompletion({ days: ECONOMY.maxRentExtensionDays + 1 }, 'en').success).toBe(false);
  });
});

describe('Goal Interactions #18–#20: the bookshop', () => {
  const { buyABook, buyAGift, recommendABook } = INTERACTIONS;

  it('sells something to read through complete_purchase, by name (#18, Beginner) or recommended (#20, Advanced)', () => {
    for (const interaction of [buyABook, recommendABook]) {
      expect(interaction.toolDeclaration.name).toBe('complete_purchase');
      const item = interaction.toolDeclaration.parameters.properties!.items!.items!.properties!.item!;
      expect(item.enum).toEqual([...READING_SOLD]);
      expect(interaction.parseArgs({ items: [{ item: 'magazine', quantity: 1 }] }).success).toBe(true);
      expect(interaction.parseArgs({ items: [{ item: 'flowers', quantity: 1 }] }).success).toBe(false);
    }
    expect([buyABook.band, recommendABook.band]).toEqual(['B', 'A']);
  });

  it('sells a gift through complete_purchase(wrap) (#19, Intermediate), which must say whether to wrap it', () => {
    expect(buyAGift.toolDeclaration.name).toBe('complete_purchase');
    expect(buyAGift.band).toBe('I');
    expect(buyAGift.parseArgs({ items: [{ item: 'flowers', quantity: 1 }], wrap: true }).success).toBe(true);
    expect(buyAGift.parseArgs({ items: [{ item: 'flowers', quantity: 1 }] }).success).toBe(false);
    expect(buyAGift.parseArgs({ items: [{ item: 'magazine', quantity: 1 }], wrap: false }).success).toBe(false);
  });

  it.each(LANGUAGE_CODES)('tells the %s shopkeeper what each book is for, with its local name and price, to recommend by taste', (packId) => {
    const facts = interactionFacts(recommendABook, packId);
    for (const id of READING_SOLD) {
      const line = facts.find((fact) => fact.includes(`"${id}"`));
      expect(line).toContain(CULTURE_PACKS[packId].goods[id].name);
      expect(line).toContain(formatLocalMoney(menuPrice(id, packId), packId));
      expect(line).toContain(ITEMS[id].about);
    }
  });

  it.each(LANGUAGE_CODES)('resolves a gift in %s to a line kept to give, and a book to one that is not', (packId) => {
    const gift = buyAGift.resolveCompletion({ items: [{ item: 'scented-candle', quantity: 1 }], wrap: true }, packId);
    const book = buyABook.resolveCompletion({ items: [{ item: 'cookbook', quantity: 1 }] }, packId);

    expect(gift).toMatchObject({ success: true, lines: [{ itemId: 'scented-candle', gift: true, comfort: 'gift' }] });
    expect(book).toMatchObject({ success: true, lines: [{ itemId: 'cookbook', gift: false, comfort: 'reading' }] });
  });
});

describe('the restaurant interactions', () => {
  const { getATable, orderAMeal, recommendAMeal, payTheBill } = INTERACTIONS;
  const MEAL = { items: [{ item: 'pork-dish', quantity: 1 }, { item: 'cola', quantity: 1 }] };

  it('are #8 seat_guest (B), #9 and #10 serve_order (I and A) and #11 settle_bill (B), all with the server', () => {
    expect([getATable, orderAMeal, recommendAMeal, payTheBill].map((i) => [i.npcId, i.completion.name, i.band])).toEqual([
      ['server', 'seat_guest', 'B'],
      ['server', 'serve_order', 'I'],
      ['server', 'serve_order', 'A'],
      ['server', 'settle_bill', 'B'],
    ]);
  });

  it('seats a party of a given size where they asked to sit', () => {
    expect(getATable.parseArgs({ party: 2, seating: 'window' }).success).toBe(true);
    expect(getATable.parseArgs({ party: 0, seating: 'table' }).success).toBe(false);
    expect(getATable.parseArgs({ party: ECONOMY.maxRestaurantParty + 1, seating: 'table' }).success).toBe(false);
    expect(getATable.parseArgs({ party: 1, seating: 'kitchen' }).success).toBe(false);
  });

  it('orders from the restaurant menu, and a recommendation must say which dietary need it keeps to', () => {
    expect(orderAMeal.parseArgs(MEAL).success).toBe(true);
    expect(orderAMeal.parseArgs({ items: [{ item: 'latte', quantity: 1 }] }).success).toBe(false);
    expect(recommendAMeal.parseArgs(MEAL).success).toBe(false);
    expect(recommendAMeal.parseArgs({ ...MEAL, restriction: 'no-seafood' }).success).toBe(true);
  });

  it.each(LANGUAGE_CODES)('rejects a recommendation in %s that breaks the dietary need, naming the dish', (packId) => {
    const resolved = recommendAMeal.resolveCompletion({ ...MEAL, restriction: 'no-pork' }, packId);

    expect(resolved).toEqual({ success: false, error: expect.stringContaining(CULTURE_PACKS[packId].goods['pork-dish'].name) });
  });

  it('pays the bill in cash or by card', () => {
    expect(payTheBill.parseArgs({ method: 'card' }).success).toBe(true);
    expect(payTheBill.parseArgs({ method: 'cheque' }).success).toBe(false);
  });

  it.each(LANGUAGE_CODES)('tells the %s server what is in each dish and which dietary needs it suits, by its local name', (packId) => {
    const facts = interactionFacts(recommendAMeal, packId);
    const dish = (id: string) => facts.find((fact) => fact.includes(`(menu id "${id}") has`));

    expect(dish('pork-dish')).toBe(
      `${CULTURE_PACKS[packId].goods['pork-dish'].name} (menu id "pork-dish") has meat and pork in it. It suits a diner who eats no fish or seafood.`,
    );
    expect(dish('veggie-dish')).toContain('has no meat, fish or seafood in it');
    expect(dish('veggie-dish')).toContain('eats no meat, fish or seafood');
    expect(dish('juice')).toBeUndefined();
  });

  it.each(LANGUAGE_CODES)('tells the %s server what is on the bill, with its total', (packId) => {
    const bill = [
      { itemId: 'fish-dish', quantity: 1 },
      { itemId: 'juice', quantity: 2 },
    ] as const;
    const total = menuPrice('fish-dish', packId) + 2 * menuPrice('juice', packId);

    const facts = interactionFacts(payTheBill, packId, { bill });

    expect(facts).toContain(`2 × ${CULTURE_PACKS[packId].goods.juice.name}, ${formatLocalMoney(menuPrice('juice', packId), packId)} each`);
    expect(facts).toContain(`Bill total: ${formatLocalMoney(total, packId)}.`);
    expect(readBillTotal(facts.join('\n'))).toBe(formatLocalMoney(total, packId));
  });
});
