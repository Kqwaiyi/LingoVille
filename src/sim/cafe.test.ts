import { describe, expect, it } from 'vitest';
import { INTERACTIONS, menuPrice, type ItemId } from '../content/index.ts';
import { applyInteractionOutcome, createSave, MOOD, WELL_BEING, type GameState, type LanguageCode } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const { orderWithOptions, orderAvoidingAllergen } = INTERACTIONS;

/** The Character at the café counter, hungry and thirsty, in this pack's town. */
function atTheCafe(packId: LanguageCode = 'ja'): GameState {
  const state = createSave({ ...TEST_SETUP, targetLanguage: packId, culturePackId: packId });
  return { ...state, placeId: 'cafe', character: { ...state.character, hunger: 10, thirst: 10 } };
}

const succeed = (state: GameState, interaction: typeof orderWithOptions, args: unknown) =>
  applyInteractionOutcome(state, interaction, { kind: 'success', args });

const iced = { size: 'large', temperature: 'iced' } as const;
const food = (item: ItemId) => ({ item, quantity: 1 });

describe('the café: a drink and food with options (#2)', () => {
  it('serves a drink made to order and something to eat, filling Thirst and Hunger, and charges the menu prices', () => {
    const state = atTheCafe();

    const { state: after, result } = succeed(state, orderWithOptions, {
      items: [{ item: 'coffee', quantity: 1, ...iced, extras: ['milk', 'sugar'] }, food('pastry')],
    });

    const paid = menuPrice('coffee', 'ja') + menuPrice('pastry', 'ja');
    expect(result).toMatchObject({ kind: 'success', paidInShifts: paid, served: [{ itemId: 'coffee' }, { itemId: 'pastry' }] });
    expect(after.character.moneyInShifts).toBeCloseTo(state.character.moneyInShifts - paid);
    expect(after.character.thirst).toBe(10 + WELL_BEING.cafeDrinkThirst);
    expect(after.character.hunger).toBe(10 + WELL_BEING.cafeFoodHunger);
    expect(after.character.mood).toBe(state.character.mood + MOOD.changes.goalInteractionSuccess);
  });

  it.each([
    ['a drink made to order with no size', { item: 'tea', quantity: 1, temperature: 'hot', extras: [] }],
    ['a drink made to order, not said hot or iced', { item: 'tea', quantity: 1, size: 'small', extras: [] }],
    ['an extra the drink does not take', { item: 'coffee', quantity: 1, ...iced, extras: ['lemon'] }],
    ['options on food', { item: 'pastry', quantity: 1, size: 'large' }],
    ['options on a drink that is not made to order', { item: 'latte', quantity: 1, ...iced }],
  ])('rejects %s, and nothing changes', (_, line) => {
    const state = atTheCafe();

    const { state: after, result } = succeed(state, orderWithOptions, { items: [line] });

    expect(result).toMatchObject({ kind: 'invalid_arguments' });
    expect(after).toBe(state);
  });
});

describe('the café: an order avoiding an allergen (#3)', () => {
  it('serves an order with none of the stated allergen in it', () => {
    const { result } = succeed(atTheCafe(), orderAvoidingAllergen, {
      items: [{ item: 'coffee', quantity: 1, ...iced, extras: ['sugar'] }],
      allergen: 'milk',
    });

    expect(result).toMatchObject({ kind: 'success', served: [{ itemId: 'coffee' }] });
  });

  it.each([
    ['ja', 'milk', { item: 'latte', quantity: 1 }],
    ['ja', 'egg', food('pastry')],
    ['en', 'wheat', food('cake')],
    ['ja', 'milk', { item: 'coffee', quantity: 1, ...iced, extras: ['milk'] }],
  ] as const)('rejects an order with the stated allergen in it (%s, %s), naming what has it, and nothing changes', (packId, allergen, line) => {
    const state = atTheCafe(packId);

    const { state: after, result } = succeed(state, orderAvoidingAllergen, { items: [{ item: 'tea', quantity: 1, ...iced, extras: [] }, line], allergen });

    expect(result).toMatchObject({ kind: 'invalid_arguments', error: expect.stringContaining(`"${line.item}"`) });
    expect(after).toBe(state);
  });

  it("goes by each pack's own café food: a German butter pretzel has no egg in it, a Japanese melon bread does", () => {
    const order = { items: [food('pastry')], allergen: 'egg' };

    expect(succeed(atTheCafe('de'), orderAvoidingAllergen, order).result).toMatchObject({ kind: 'success' });
    expect(succeed(atTheCafe('ja'), orderAvoidingAllergen, order).result).toMatchObject({ kind: 'invalid_arguments' });
  });

  it('serves anything on the menu to a customer with no allergy', () => {
    const { result } = succeed(atTheCafe(), orderAvoidingAllergen, { items: [{ item: 'latte', quantity: 1 }, food('cake')], allergen: 'none' });

    expect(result).toMatchObject({ kind: 'success' });
  });
});
