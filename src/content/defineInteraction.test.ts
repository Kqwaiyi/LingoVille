import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ECONOMY } from '../sim/index.ts';
import { CAFE_MENU, CONVENIENCE_MENU, defineInteraction, GROCERIES_SOLD, INTERACTIONS } from './index.ts';

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

  it('declares serve_order with an item from the café menu and a quantity', () => {
    expect(orderDrink.toolDeclaration.name).toBe('serve_order');
    const item = orderDrink.toolDeclaration.parameters.properties!.items!.items!.properties!.item!;
    expect(item.enum).toEqual([...CAFE_MENU]);
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
