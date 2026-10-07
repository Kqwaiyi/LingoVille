import { describe, expect, it } from 'vitest';
import { INTERACTIONS, menuPrice, placeHours, type ItemId } from '../content/index.ts';
import { applyInteractionOutcome, createSave, enterPlace, faint, MOOD, WELL_BEING, type GameState } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const { getATable, orderAMeal, recommendAMeal, payTheBill } = INTERACTIONS;
/** What an item costs on the ja menu, in Shifts. */
const price = (item: ItemId) => menuPrice(item, 'ja');
const meal = (dish: ItemId, drink: ItemId = 'juice') => ({
  items: [
    { item: dish, quantity: 1 },
    { item: drink, quantity: 1 },
  ],
});
const succeed = (state: GameState, interaction: (typeof INTERACTIONS)[keyof typeof INTERACTIONS], args: unknown) =>
  applyInteractionOutcome(state, interaction, { kind: 'success', args });

/** The Character just inside the restaurant, hungry and thirsty, not yet seated. */
function atTheRestaurant(character: Partial<GameState['character']> = {}): GameState {
  const state = createSave(TEST_SETUP);
  return { ...state, placeId: 'restaurant', character: { ...state.character, hunger: 10, thirst: 10, ...character } };
}

/** The Character at a table. */
const seated = (character: Partial<GameState['character']> = {}) =>
  succeed(atTheRestaurant(character), getATable, { party: 1, seating: 'table' }).state;

describe('the restaurant: getting a table (#8)', () => {
  it('seats the Character and lifts Mood, charging nothing', () => {
    const state = atTheRestaurant();

    const { state: after, result } = succeed(state, getATable, { party: 2, seating: 'window' });

    expect(after.restaurant).toEqual({ seated: true, bill: [] });
    expect(after.character.moneyInShifts).toBe(state.character.moneyInShifts);
    expect(result).toMatchObject({ kind: 'success', paidInShifts: 0, moodChange: MOOD.changes.goalInteractionSuccess });
  });

  it('a new save has no table and nothing on the bill', () => {
    expect(createSave(TEST_SETUP).restaurant).toEqual({ seated: false, bill: [] });
  });
});

describe('the restaurant: ordering a meal (#9)', () => {
  it('fills Hunger and Thirst and lifts Mood by the meal Comfort Purchase, and puts it on the bill rather than charging', () => {
    const state = seated();

    const { state: after, result } = succeed(state, orderAMeal, meal('chicken-dish'));

    expect(after.character.hunger).toBe(10 + WELL_BEING.restaurantDishHunger);
    expect(after.character.thirst).toBe(10 + WELL_BEING.restaurantDrinkThirst);
    expect(after.character.mood).toBe(state.character.mood + MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.meal);
    expect(after.character.moneyInShifts).toBe(state.character.moneyInShifts);
    expect(after.restaurant.bill).toEqual([
      { itemId: 'chicken-dish', quantity: 1 },
      { itemId: 'juice', quantity: 1 },
    ]);
    expect(result).toMatchObject({ kind: 'success', paidInShifts: 0, served: [{ itemId: 'chicken-dish' }, { itemId: 'juice' }] });
  });

  it('a drink on its own goes on the bill but is no Comfort Purchase', () => {
    const state = seated();

    const { result } = succeed(state, orderAMeal, { items: [{ item: 'cola', quantity: 1 }] });

    expect(result).toMatchObject({ moodChange: MOOD.changes.goalInteractionSuccess });
  });

  it('adds a second order to what is already on the bill', () => {
    const once = succeed(seated(), orderAMeal, meal('fish-dish')).state;

    const { state: after } = succeed(once, orderAMeal, { items: [{ item: 'juice', quantity: 2 }] });

    expect(after.restaurant.bill).toEqual([
      { itemId: 'fish-dish', quantity: 1 },
      { itemId: 'juice', quantity: 3 },
    ]);
  });

  it('serves nothing to a Character with no table', () => {
    const state = atTheRestaurant();

    const { state: after, result } = succeed(state, orderAMeal, meal('pork-dish'));

    expect(result).toMatchObject({ kind: 'invalid_arguments' });
    expect(after).toBe(state);
  });

  it('serves nothing the Character could not pay for, with what is already on the bill', () => {
    const state = seated({ moneyInShifts: price('pork-dish') + price('juice') + price('cola') / 2 });
    const once = succeed(state, orderAMeal, meal('pork-dish')).state;

    const { state: after, result } = succeed(once, orderAMeal, { items: [{ item: 'cola', quantity: 1 }] });

    expect(result).toEqual({ kind: 'cannot_afford' });
    expect(after).toBe(once);
  });
});

describe('the restaurant: a recommendation within a dietary restriction (#10)', () => {
  it('serves a dish that keeps to the restriction the Character stated', () => {
    const { result } = succeed(seated(), recommendAMeal, { ...meal('veggie-dish'), restriction: 'vegetarian' });

    expect(result).toMatchObject({ kind: 'success', moodChange: MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.meal });
  });

  it.each([
    ['vegetarian', 'chicken-dish'],
    ['no-pork', 'pork-dish'],
    ['no-seafood', 'fish-dish'],
  ] as const)('rejects an order that breaks the restriction (%s, %s), and nothing changes', (restriction, dish) => {
    const state = seated();

    const { state: after, result } = succeed(state, recommendAMeal, { ...meal(dish), restriction });

    expect(result).toMatchObject({ kind: 'invalid_arguments', error: expect.stringContaining(`"${dish}"`) });
    expect(after).toBe(state);
  });

  it('a no-pork diner can have chicken or fish', () => {
    for (const dish of ['chicken-dish', 'fish-dish'] as const) {
      expect(succeed(seated(), recommendAMeal, { ...meal(dish), restriction: 'no-pork' }).result).toMatchObject({ kind: 'success' });
    }
  });
});

describe('the restaurant: paying the bill (#11)', () => {
  it('charges everything on the bill at menu prices, then the Character leaves the table', () => {
    const eaten = succeed(seated(), orderAMeal, meal('fish-dish', 'cola')).state;

    const { state: after, result } = succeed(eaten, payTheBill, { method: 'card' });

    const bill = price('fish-dish') + price('cola');
    expect(after.character.moneyInShifts).toBeCloseTo(eaten.character.moneyInShifts - bill);
    expect(after.restaurant).toEqual({ seated: false, bill: [] });
    expect(result).toMatchObject({ kind: 'success', paidInShifts: bill, moodChange: MOOD.changes.goalInteractionSuccess });
  });

  it('a meal of a dish and a drink comes to about 0.25 Shift', () => {
    const eaten = succeed(seated(), orderAMeal, meal('veggie-dish')).state;

    const { result } = succeed(eaten, payTheBill, { method: 'cash' });

    expect(result).toMatchObject({ paidInShifts: expect.closeTo(0.25, 1) });
  });

  it('has nothing to charge with nothing on the bill', () => {
    const state = seated();

    const { state: after, result } = succeed(state, payTheBill, { method: 'cash' });

    expect(result).toMatchObject({ kind: 'invalid_arguments' });
    expect(after).toBe(state);
  });

  it('leaves the bill open if the Character cannot pay it now', () => {
    const eaten = succeed(seated(), orderAMeal, meal('pork-dish')).state;
    const broke: GameState = { ...eaten, character: { ...eaten.character, moneyInShifts: 0.01 } };

    const { state: after, result } = succeed(broke, payTheBill, { method: 'cash' });

    expect(result).toEqual({ kind: 'cannot_afford' });
    expect(after).toBe(broke);
  });
});

describe('the restaurant: leaving', () => {
  it('walking out gives up the table, but the bill stays open to pay next time', () => {
    const eaten = succeed(seated(), orderAMeal, meal('pork-dish')).state;

    const outside = enterPlace(eaten, 'park', null);

    expect(outside.restaurant).toEqual({ seated: false, bill: eaten.restaurant.bill });
  });

  it('fainting at the table gives it up too', () => {
    expect(faint(seated()).restaurant.seated).toBe(false);
  });

  it('coming back in does not seat the Character again', () => {
    const outside = enterPlace(seated(), 'park', null);

    expect(enterPlace(outside, 'restaurant', placeHours('restaurant', 'ja')).restaurant.seated).toBe(false);
  });
});
