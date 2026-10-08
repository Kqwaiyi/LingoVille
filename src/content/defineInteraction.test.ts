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

describe('Goal Interactions #2 and #3: a café order with options, and one avoiding an allergen', () => {
  const { orderWithOptions, orderAvoidingAllergen } = INTERACTIONS;
  const COFFEE = { item: 'coffee', quantity: 1, size: 'large', temperature: 'iced', extras: ['milk'] };

  it('are the barista’s serve_order, Intermediate and Advanced, over the café counter', () => {
    expect([orderWithOptions, orderAvoidingAllergen].map((i) => [i.npcId, i.placeId, i.completion.name, i.band, i.effect.kind])).toEqual([
      ['barista', 'cafe', 'serve_order', 'I', 'serveOrder'],
      ['barista', 'cafe', 'serve_order', 'A', 'serveOrder'],
    ]);
    expect(orderWithOptions.items).toEqual([...CAFE_COUNTER]);
  });

  it('declares how a drink is made as optional size, hot or iced and extras on each line', () => {
    const line = orderWithOptions.toolDeclaration.parameters.properties!.items!.items!;
    expect(line.required).toEqual(['item', 'quantity']);
    expect(line.properties!.size!.enum).toEqual(['small', 'medium', 'large']);
    expect(line.properties!.temperature!.enum).toEqual(['hot', 'iced']);
    expect(line.properties!.extras!.items!.enum).toEqual(['milk', 'sugar', 'extra-shot', 'lemon']);
  });

  it('takes a drink made to order with its options, and food as it comes', () => {
    expect(orderWithOptions.parseArgs({ items: [COFFEE, { item: 'cake', quantity: 1 }] }).success).toBe(true);
    expect(orderWithOptions.parseArgs({ items: [{ ...COFFEE, size: 'huge' }] }).success).toBe(false);
  });

  it('must say what the customer is allergic to, or that they are not, avoiding an allergen', () => {
    expect(orderAvoidingAllergen.toolDeclaration.parameters.properties!.allergen!.enum).toEqual(['milk', 'egg', 'wheat', 'none']);
    expect(orderAvoidingAllergen.parseArgs({ items: [COFFEE] }).success).toBe(false);
    expect(orderAvoidingAllergen.parseArgs({ items: [COFFEE], allergen: 'egg' }).success).toBe(true);
  });

  it.each(LANGUAGE_CODES)('rejects an order in %s with the allergen in it, naming the item by its local name', (packId) => {
    const resolved = orderAvoidingAllergen.resolveCompletion({ items: [{ item: 'latte', quantity: 1 }], allergen: 'milk' }, packId);

    expect(resolved).toEqual({ success: false, error: expect.stringContaining(CULTURE_PACKS[packId].goods.latte.name) });
  });

  it.each(LANGUAGE_CODES)('tells the %s barista how each drink made to order can be made, by local name and id', (packId) => {
    const { goods, drinkOptions } = CULTURE_PACKS[packId];
    const facts = interactionFacts(orderWithOptions, packId);

    expect(facts).toContain(
      `${goods.tea.name} (menu id "tea") is made to order. It can have added: ` +
        `${drinkOptions.milk.name} (id "milk"), ${drinkOptions.sugar.name} (id "sugar"), ${drinkOptions.lemon.name} (id "lemon").`,
    );
    expect(facts.some((fact) => fact.includes(`${drinkOptions.iced.name} (id "iced")`))).toBe(true);
    expect(facts.some((fact) => fact.includes('(menu id "latte") is made to order'))).toBe(false);
  });

  it('tells the barista avoiding an allergen what is in each item in this pack, and what an extra adds', () => {
    const facts = interactionFacts(orderAvoidingAllergen, 'de');

    expect(facts).toContain('Butterbrezel (menu id "pastry") has milk and wheat in it.');
    expect(facts).toContain('Filterkaffee (menu id "coffee") has no milk, egg or wheat in it.');
    expect(facts).toContain('Adding milk to a drink adds milk to it.');
    expect(facts).toContain(
      'The allergies you know about: Milch (allergen id "milk"), Ei (allergen id "egg") and Weizen (allergen id "wheat"). ' +
        "You can't say what else anything has in it.",
    );
    expect(interactionFacts(orderWithOptions, 'de').some((fact) => fact.includes('Butterbrezel (menu id "pastry") has'))).toBe(false);
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

  it.each(LANGUAGE_CODES)('tells the %s server what is owed from a bill walked out on, and adds it to the total', (packId) => {
    const bill = [{ itemId: 'fish-dish', quantity: 1 }] as const;
    const owed = menuPrice('pork-dish', packId);

    const facts = interactionFacts(payTheBill, packId, { bill, restaurantDebt: owed });

    expect(facts).toContain(`Owed from last time, when they left without paying: ${formatLocalMoney(owed, packId)}.`);
    expect(facts).toContain(`Bill total: ${formatLocalMoney(owed + menuPrice('fish-dish', packId), packId)}.`);
  });

  it('tells the server what is owed from last time when nothing is on the bill now', () => {
    const owed = menuPrice('pork-dish', 'en');

    const facts = interactionFacts(payTheBill, 'en', { restaurantDebt: owed });

    expect(facts).toEqual([
      'The customer has nothing on their bill today.',
      `Owed from last time, when they left without paying: ${formatLocalMoney(owed, 'en')}.`,
      `Bill total: ${formatLocalMoney(owed, 'en')}.`,
      ...interactionFacts(payTheBill, 'en').slice(1),
    ]);
  });
});

describe('Goal Interactions #21 and #22: the bathhouse', () => {
  const { buyBathEntry, joinTheGym, renewGymMembership } = INTERACTIONS;

  it('are #21 admit(options) (B) and #22 register_member (I), with a renewal path, all with the attendant', () => {
    expect([buyBathEntry, joinTheGym, renewGymMembership].map((i) => [i.npcId, i.placeId, i.toolDeclaration.name, i.band])).toEqual([
      ['attendant', 'bathhouse', 'admit', 'B'],
      ['attendant', 'bathhouse', 'register_member', 'I'],
      ['attendant', 'bathhouse', 'register_member', 'I'],
    ]);
    expect(buyBathEntry.parseArgs({ options: ['towel', 'sauna'] }).success).toBe(true);
    expect(buyBathEntry.parseArgs({ options: ['massage'] }).success).toBe(false);
    expect(joinTheGym.parseArgs({ kind: 'join' }).success).toBe(true);
    expect(renewGymMembership.parseArgs({}).success).toBe(false);
  });

  it.each(LANGUAGE_CODES)('resolves %s bath entry to a bathhouse Comfort Purchase, and membership to its price', (packId) => {
    expect(buyBathEntry.resolveCompletion({ options: [] }, packId)).toMatchObject({
      success: true,
      lines: [{ itemId: 'bath-entry', quantity: 1, gift: false, comfort: 'bathhouse', name: CULTURE_PACKS[packId].goods['bath-entry'].name }],
    });
    expect(renewGymMembership.resolveCompletion({ kind: 'renew' }, packId)).toMatchObject({
      success: true,
      lines: [{ itemId: 'gym-membership', quantity: 1, comfort: null, priceInShifts: menuPrice('gym-membership', packId) }],
    });
  });

  it.each(LANGUAGE_CODES)('tells the %s attendant both prices, how long membership lasts, and the bathhouse’s own facts', (packId) => {
    const facts = interactionFacts(joinTheGym, packId);
    for (const id of ['bath-entry', 'gym-membership'] as const) {
      expect(facts.join('\n')).toContain(`${CULTURE_PACKS[packId].goods[id].name}, ${formatLocalMoney(menuPrice(id, packId), packId)}`);
    }
    expect(facts.join('\n')).toContain(`${ECONOMY.gymMembershipDays} days`);
    expect(facts.join('\n')).toMatch(/never renewed automatically/);
    expect(facts).toEqual(expect.arrayContaining(CULTURE_PACKS[packId].townPlaces.bathhouse.facts!));
  });
});

describe('Goal Interaction #6: return a faulty item', () => {
  const { returnAnItem } = INTERACTIONS;

  it('is the cashier’s refund(item, reason) over the groceries on the shelves, Advanced', () => {
    expect([returnAnItem.npcId, returnAnItem.placeId, returnAnItem.toolDeclaration.name, returnAnItem.band]).toEqual(['cashier', 'supermarket', 'refund', 'A']);
    expect(returnAnItem.parseArgs({ item: 'eggs', reason: 'cracked' }).success).toBe(true);
    expect(returnAnItem.parseArgs({ item: 'latte', reason: 'cold' }).success).toBe(false);
    expect(returnAnItem.parseArgs({ item: 'eggs' }).success).toBe(false);
  });

  it.each(LANGUAGE_CODES)('resolves a refund in %s to the item in the pack’s words and its shelf price, selling nothing', (packId) => {
    expect(returnAnItem.resolveCompletion({ item: 'eggs', reason: 'cracked' }, packId)).toEqual({
      success: true,
      lines: [],
      refund: { item: { itemId: 'eggs', name: CULTURE_PACKS[packId].goods.eggs.name, glosses: CULTURE_PACKS[packId].goods.eggs.glosses, quantity: 1 }, amountInShifts: menuPrice('eggs', packId) },
    });
  });

  it('tells the cashier what the shop takes back', () => {
    expect(interactionFacts(returnAnItem, 'en').join('\n')).toMatch(/brought back if something is wrong with it, as long as it is still within its use-by date/);
  });
});

describe('Goal Interactions #23 and #24: the town office and post office', () => {
  const { registerAddress, sendAParcel } = INTERACTIONS;

  it('are the clerk’s #23 register_resident(fields) (A) and #24 ship(destination, speed) (I)', () => {
    expect([registerAddress, sendAParcel].map((i) => [i.npcId, i.placeId, i.toolDeclaration.name, i.band])).toEqual([
      ['office-clerk', 'town-office', 'register_resident', 'A'],
      ['office-clerk', 'town-office', 'ship', 'I'],
    ]);
    expect(registerAddress.parseArgs({ fields: { name: 'Sam', address: 'Flat 2', nationality: 'Irish' } }).success).toBe(true);
    expect(registerAddress.parseArgs({ fields: { name: 'Sam' } }).success).toBe(false);
    expect(sendAParcel.parseArgs({ destination: 'Ireland', speed: 'air' }).success).toBe(true);
    expect(sendAParcel.parseArgs({ destination: 'Ireland', speed: 'pigeon' }).success).toBe(false);
  });

  it('resolves a registration to the name on the form, for the sim to check', () => {
    expect(registerAddress.resolveCompletion({ fields: { name: 'Sam', address: 'Flat 2', nationality: 'Irish' } }, 'de')).toEqual({
      success: true,
      lines: [],
      registration: { name: 'Sam' },
    });
  });

  it.each(LANGUAGE_CODES)('charges postage in %s by speed, express dearest, as the clerk’s facts say', (packId) => {
    const postage = (speed: string) => sendAParcel.resolveCompletion({ destination: 'Ireland', speed }, packId);
    const [sea, air, express] = (['sea', 'air', 'express'] as const).map((speed) => {
      const resolved = postage(speed);
      if (!resolved.success || !resolved.shipment) throw new Error('no shipment');
      expect(resolved.shipment).toMatchObject({ destination: 'Ireland', speed });
      expect(interactionFacts(sendAParcel, packId).join('\n')).toContain(`(speed id "${speed}")`);
      expect(interactionFacts(sendAParcel, packId).join('\n')).toContain(formatLocalMoney(resolved.shipment.postageInShifts, packId));
      return resolved.shipment.postageInShifts;
    });
    expect(sea).toBeLessThan(air!);
    expect(air).toBeLessThan(express!);
    expect(sea).toBeCloseTo(ECONOMY.postageInShifts.sea, 1);
  });

  it.each(LANGUAGE_CODES)('tells the %s clerk the town office’s own facts', (packId) => {
    expect(interactionFacts(registerAddress, packId)).toEqual(expect.arrayContaining(CULTURE_PACKS[packId].townPlaces['town-office'].facts!));
  });
});

describe('Goal Interaction #25: which tram goes to a place', () => {
  const { askForDirections } = INTERACTIONS;

  it('is a passer-by’s give_directions(stop) at a tram stop, Beginner', () => {
    expect([askForDirections.npcId, askForDirections.placeId, askForDirections.toolDeclaration.name, askForDirections.band]).toEqual([
      'passer-by',
      'tram-stop',
      'give_directions',
      'B',
    ]);
    expect(askForDirections.resolveCompletion({ stop: 'east-stop' }, 'ja')).toEqual({ success: true, lines: [], directions: 'east-stop' });
    expect(askForDirections.parseArgs({ stop: 'moon-stop' }).success).toBe(false);
  });

  it.each(LANGUAGE_CODES)('tells a %s passer-by each stop by its local name, the places to get off for, and where they wait', (packId) => {
    const { tramStops, townPlaces, supermarket } = CULTURE_PACKS[packId];
    const facts = interactionFacts(askForDirections, packId, { tramStop: 'central-stop' });
    expect(facts).toContain(`You are waiting at ${tramStops['central-stop'].name} (stop id "central-stop").`);
    expect(facts.join('\n')).toContain(`${tramStops['west-stop'].name} (stop id "west-stop")`);
    expect(facts.find((fact) => fact.startsWith(`Get off at ${tramStops['west-stop'].name} for`))).toContain(townPlaces['town-office'].name);
    expect(facts.find((fact) => fact.startsWith(`Get off at ${tramStops['east-stop'].name} for`))).toContain(supermarket.name);
  });
});
