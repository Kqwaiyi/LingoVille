import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS, formatLocalMoney, INTERACTIONS, menuPrice, type ItemId } from '../content/index.ts';
import { applyInteractionOutcome, createSave, METER_MAX, MOOD, WELL_BEING, type GameState } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const { orderDrink } = INTERACTIONS;
const LATTE = { items: [{ item: 'latte', quantity: 1 }] };
/** What an item costs on the ja menu, in Shifts. */
const price = (item: ItemId) => menuPrice(item, 'ja');

function atTheCafe(character: Partial<GameState['character']> = {}): GameState {
  const state = createSave(TEST_SETUP);
  return { ...state, placeId: 'cafe', character: { ...state.character, thirst: 20, ...character } };
}

describe('applyInteractionOutcome', () => {
  it('on success, takes payment, serves the drink and lifts Mood', () => {
    const state = atTheCafe();

    const { state: after, result } = applyInteractionOutcome(state, orderDrink, { kind: 'success', args: LATTE });

    expect(after.character.moneyInShifts).toBeCloseTo(state.character.moneyInShifts - price('latte'));
    expect(after.character.thirst).toBe(state.character.thirst + WELL_BEING.cafeDrinkThirst);
    expect(after.character.mood).toBe(state.character.mood + MOOD.changes.goalInteractionSuccess);
    expect(result).toEqual({
      kind: 'success',
      served: [{ itemId: 'latte', name: CULTURE_PACKS.ja.goods.latte.name, glosses: CULTURE_PACKS.ja.goods.latte.glosses, quantity: 1 }],
      paidInShifts: price('latte'),
      moodChange: MOOD.changes.goalInteractionSuccess,
    });
  });

  it('charges for every item and quantity in the order', () => {
    const state = atTheCafe({ thirst: 0 });
    const order = { items: [{ item: 'latte', quantity: 2 }, { item: 'tea', quantity: 1 }] };

    const { state: after } = applyInteractionOutcome(state, orderDrink, { kind: 'success', args: order });

    const cost = 2 * price('latte') + price('tea');
    expect(after.character.moneyInShifts).toBeCloseTo(state.character.moneyInShifts - cost);
    expect(after.character.thirst).toBe(Math.min(METER_MAX, 3 * WELL_BEING.cafeDrinkThirst));
  });

  it('charges the price on the pack’s menu, at its local price point', () => {
    const cafe = atTheCafe();
    const state: GameState = { ...cafe, identity: { ...cafe.identity, culturePackId: 'de' } };
    const order = { items: [{ item: 'coffee', quantity: 1 }] };

    const { state: after, result } = applyInteractionOutcome(state, orderDrink, { kind: 'success', args: order });

    const paid = state.character.moneyInShifts - after.character.moneyInShifts;
    expect(formatLocalMoney(paid, 'de')).toBe(formatLocalMoney(menuPrice('coffee', 'de'), 'de'));
    expect(result).toMatchObject({ served: [{ name: CULTURE_PACKS.de.goods.coffee.name }] });
  });

  it('a café pastry fills Hunger rather than Thirst', () => {
    const state = atTheCafe({ hunger: 10 });
    const order = { items: [{ item: 'pastry', quantity: 1 }] };

    const { state: after } = applyInteractionOutcome(state, orderDrink, { kind: 'success', args: order });

    expect(after.character.hunger).toBe(10 + WELL_BEING.cafeFoodHunger);
    expect(after.character.thirst).toBe(state.character.thirst);
  });

  it('never lifts a meter past full, and reports the Mood change that actually happened', () => {
    const state = atTheCafe({ thirst: METER_MAX - 1, mood: METER_MAX - 1 });

    const { state: after, result } = applyInteractionOutcome(state, orderDrink, { kind: 'success', args: LATTE });

    expect(after.character.thirst).toBe(METER_MAX);
    expect(after.character.mood).toBe(METER_MAX);
    expect(result).toMatchObject({ moodChange: 1 });
  });

  it('reports no Mood change for a failure when Mood is already empty', () => {
    const { result } = applyInteractionOutcome(atTheCafe({ mood: 0 }), orderDrink, { kind: 'failure' });

    expect(result).toEqual({ kind: 'failure', moodChange: 0 });
  });

  it('refuses an order the Character cannot afford, changing nothing', () => {
    const state = atTheCafe({ moneyInShifts: price('latte') / 2 });

    const { state: after, result } = applyInteractionOutcome(state, orderDrink, { kind: 'success', args: LATTE });

    expect(after).toBe(state);
    expect(result).toEqual({ kind: 'cannot_afford' });
  });

  it('serves an order that costs exactly what the Character has', () => {
    const state = atTheCafe({ moneyInShifts: price('latte') });

    const { state: after, result } = applyInteractionOutcome(state, orderDrink, { kind: 'success', args: LATTE });

    expect(result.kind).toBe('success');
    expect(after.character.moneyInShifts).toBeCloseTo(0);
  });

  it('rejects completion arguments that fail validation, changing nothing', () => {
    const state = atTheCafe();

    for (const args of [{ items: [{ item: 'champagne', quantity: 1 }] }, { items: [] }, undefined]) {
      const { state: after, result } = applyInteractionOutcome(state, orderDrink, { kind: 'success', args });
      expect(after).toBe(state);
      expect(result.kind).toBe('invalid_arguments');
    }
  });

  it('on failure, charges nothing and dips Mood by less than success would lift it', () => {
    const state = atTheCafe();

    const { state: after, result } = applyInteractionOutcome(state, orderDrink, { kind: 'failure' });

    expect(after.character.moneyInShifts).toBe(state.character.moneyInShifts);
    expect(after.character.thirst).toBe(state.character.thirst);
    expect(after.character.mood).toBe(state.character.mood + MOOD.changes.goalInteractionFailure);
    expect(MOOD.changes.goalInteractionFailure).toBeLessThan(0);
    expect(-MOOD.changes.goalInteractionFailure).toBeLessThan(MOOD.changes.goalInteractionSuccess);
    expect(result).toEqual({ kind: 'failure', moodChange: MOOD.changes.goalInteractionFailure });
  });

  it('abandoning costs nothing', () => {
    const state = atTheCafe();

    const { state: after, result } = applyInteractionOutcome(state, orderDrink, { kind: 'abandon' });

    expect(after).toBe(state);
    expect(result).toEqual({ kind: 'abandon' });
  });
});
