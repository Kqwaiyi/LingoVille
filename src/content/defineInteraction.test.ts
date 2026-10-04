import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CAFE_MENU, defineInteraction, INTERACTIONS } from './index.ts';

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
