import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS, formatLocalMoney, INTERACTIONS, menuPrice, type ItemId } from '../content/index.ts';
import { applyInteractionOutcome, createSave, GROCERIES, METER_MAX, MOOD, WELL_BEING, type GameState } from './index.ts';
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

    // Only the NPC remembers it: they have still met the Character.
    expect({ ...after, people: state.people }).toEqual(state);
    expect(result).toEqual({ kind: 'abandon' });
  });
});

describe('applyInteractionOutcome: paying for groceries (#4)', () => {
  const { payForGroceries } = INTERACTIONS;
  const BAG_NO_CARD = { bag: true, card: false };

  function atTheTill(inventory: GameState['possessions']['inventory'] = [], money?: number): GameState {
    const state = createSave(TEST_SETUP);
    return {
      ...state,
      placeId: 'supermarket',
      clock: { day: 3, minuteOfDay: 10 * 60 },
      character: { ...state.character, moneyInShifts: money ?? state.character.moneyInShifts },
      possessions: { ...state.possessions, inventory },
    };
  }

  it('charges for the basket and puts it in the inventory, going off after expiryDays', () => {
    const state = atTheTill();
    const basket = [
      { itemId: 'eggs', quantity: 2 },
      { itemId: 'noodles', quantity: 1 },
    ] as const;

    const { state: after, result } = applyInteractionOutcome(state, payForGroceries, { kind: 'success', args: BAG_NO_CARD, basket });

    const cost = 2 * price('eggs') + price('noodles');
    expect(after.character.moneyInShifts).toBeCloseTo(state.character.moneyInShifts - cost);
    expect(after.possessions.inventory).toEqual([
      { itemId: 'eggs', quantity: 2, expiresOnDay: 3 + GROCERIES.expiryDays },
      { itemId: 'noodles', quantity: 1, expiresOnDay: 3 + GROCERIES.expiryDays },
    ]);
    expect(result).toMatchObject({ kind: 'success', paidInShifts: cost, served: [{ itemId: 'eggs', quantity: 2 }, { itemId: 'noodles', quantity: 1 }] });
  });

  it('fills no meter: groceries are for cooking', () => {
    const state = atTheTill();
    const { state: after } = applyInteractionOutcome(state, payForGroceries, {
      kind: 'success',
      args: BAG_NO_CARD,
      basket: [{ itemId: 'vegetables', quantity: 1 }],
    });
    expect(after.character.hunger).toBe(state.character.hunger);
    expect(after.character.thirst).toBe(state.character.thirst);
  });

  it('adds to groceries bought the same day, and keeps older ones apart, since they go off sooner', () => {
    const older = { itemId: 'eggs' as const, quantity: 1, expiresOnDay: 2 + GROCERIES.expiryDays };
    const today = { itemId: 'eggs' as const, quantity: 1, expiresOnDay: 3 + GROCERIES.expiryDays };
    const state = atTheTill([older, today]);

    const { state: after } = applyInteractionOutcome(state, payForGroceries, {
      kind: 'success',
      args: BAG_NO_CARD,
      basket: [{ itemId: 'eggs', quantity: 2 }],
    });

    expect(after.possessions.inventory).toEqual([older, { ...today, quantity: 3 }]);
  });

  it('refuses a basket the Character cannot afford, changing nothing', () => {
    const state = atTheTill([], price('eggs'));
    const basket = [{ itemId: 'eggs', quantity: 2 }] as const;

    const { state: after, result } = applyInteractionOutcome(state, payForGroceries, { kind: 'success', args: BAG_NO_CARD, basket });

    expect(after).toBe(state);
    expect(result).toEqual({ kind: 'cannot_afford' });
  });

  it('has nothing to charge with an empty basket', () => {
    const state = atTheTill();
    const { state: after, result } = applyInteractionOutcome(state, payForGroceries, { kind: 'success', args: BAG_NO_CARD, basket: [] });
    expect(after).toBe(state);
    expect(result.kind).toBe('invalid_arguments');
  });
});

describe('applyInteractionOutcome: asking where an item is (#5)', () => {
  const { findAnItem } = INTERACTIONS;

  it('points to the item, charging nothing, and lifts Mood', () => {
    const state = { ...createSave(TEST_SETUP), placeId: 'supermarket' as const };

    const { state: after, result } = applyInteractionOutcome(state, findAnItem, { kind: 'success', args: { item: 'noodles' } });

    expect(after.character.moneyInShifts).toBe(state.character.moneyInShifts);
    expect(after.possessions.inventory).toEqual([]);
    expect(result).toEqual({
      kind: 'success',
      served: [],
      paidInShifts: 0,
      moodChange: MOOD.changes.goalInteractionSuccess,
      pointedTo: { itemId: 'noodles', name: CULTURE_PACKS.ja.goods.noodles.name, glosses: CULTURE_PACKS.ja.goods.noodles.glosses, quantity: 1 },
    });
  });
});

describe('applyInteractionOutcome: counter food at the convenience store (#7)', () => {
  const { buyCounterFood } = INTERACTIONS;

  it('serves a bento, charging for it and raising Hunger', () => {
    const state = { ...atTheCafe({ hunger: 10 }), placeId: 'convenience-store' as const };

    const { state: after, result } = applyInteractionOutcome(state, buyCounterFood, {
      kind: 'success',
      args: { items: [{ item: 'bento', quantity: 1 }] },
    });

    expect(after.character.hunger).toBe(10 + WELL_BEING.bentoHunger);
    expect(after.character.moneyInShifts).toBeCloseTo(state.character.moneyInShifts - price('bento'));
    expect(after.possessions.inventory).toEqual([]);
    expect(result).toMatchObject({ kind: 'success', served: [{ itemId: 'bento', quantity: 1 }] });
  });

  it('a counter snack raises Hunger by less', () => {
    const state = atTheCafe({ hunger: 10 });
    const { state: after } = applyInteractionOutcome(state, buyCounterFood, {
      kind: 'success',
      args: { items: [{ item: 'snack', quantity: 1 }] },
    });
    expect(after.character.hunger).toBe(10 + WELL_BEING.counterSnackHunger);
  });
});

describe('applyInteractionOutcome: the landlord', () => {
  /** At home on day 9, owing 0.5 in rent debt as well as this week's rent, with 3 Shifts to pay it. */
  const tenant = (): GameState => {
    const state = createSave(TEST_SETUP);
    return {
      ...state,
      clock: { day: 9, minuteOfDay: 10 * 60 },
      rent: { ...state.rent, dueDay: 14 },
      debts: [{ kind: 'rent', amountInShifts: 0.5 }],
      character: { ...state.character, moneyInShifts: 3 },
    };
  };

  it('accept_rent takes the money, clears rent debt first, and lifts Mood', () => {
    // ¥9,000 in the ja pack is 1.5 Shifts: the 0.5 debt and a whole week at the A1 discount.
    const { state, result } = applyInteractionOutcome(tenant(), INTERACTIONS.payRent, { kind: 'success', args: { amount: 9000 } });

    expect(result).toMatchObject({ kind: 'success', paidInShifts: 1.5, moodChange: MOOD.changes.goalInteractionSuccess });
    expect(state.debts).toEqual([]);
    expect(state.rent.owedInShifts).toBe(0);
    expect(state.character.moneyInShifts).toBeCloseTo(1.5);
  });

  it('refuses more than the tenant owes, or more than they have, changing nothing', () => {
    const tooMuch = applyInteractionOutcome(tenant(), INTERACTIONS.payRent, { kind: 'success', args: { amount: 12000 } });
    expect(tooMuch.result.kind).toBe('invalid_arguments');
    expect(tooMuch.state).toEqual(tenant());

    const broke = { ...tenant(), character: { ...tenant().character, moneyInShifts: 0.2 } };
    const cannot = applyInteractionOutcome(broke, INTERACTIONS.rentReminder, { kind: 'success', args: { amount: 3000 } });
    expect(cannot.result.kind).toBe('cannot_afford');
    expect(cannot.state).toEqual(broke);
  });

  it('grant_extension gives the days agreed, with nothing paid', () => {
    const { state, result } = applyInteractionOutcome(tenant(), INTERACTIONS.askForMoreTime, { kind: 'success', args: { days: 3 } });

    expect(result).toMatchObject({ kind: 'success', paidInShifts: 0, extendedDays: 3 });
    expect(state.rent.extendedThroughDay).toBe(11);
    expect(state.character.moneyInShifts).toBe(3);
  });
});

describe('applyInteractionOutcome: hiring', () => {
  const { askBaristaForWork } = INTERACTIONS;
  /** At the café counter, the Character named Sam Lee at setup. */
  const applicant = (): GameState => ({ ...createSave({ ...TEST_SETUP, characterName: 'Sam Lee' }), placeId: 'cafe' });
  const applying = (name: string) => ({ kind: 'success' as const, args: { name, start: 'tomorrow' } });

  it('hires the Character when the name the barista heard is theirs, and lifts Mood', () => {
    const { state, result } = applyInteractionOutcome(applicant(), askBaristaForWork, applying('Sam'));

    expect(state.possessions.jobsHired).toEqual(['barista']);
    expect(result).toEqual({ kind: 'success', served: [], paidInShifts: 0, moodChange: MOOD.changes.goalInteractionSuccess, hired: 'barista' });
  });

  it('turns down a name that is not theirs, changing nothing, so the barista can ask again', () => {
    const { state, result } = applyInteractionOutcome(applicant(), askBaristaForWork, applying('Pam'));

    expect(result).toEqual({ kind: 'wrong_name' });
    expect(state).toEqual(applicant());
  });

  it('leaves the Job unhired after a failure, so the Character can try again', () => {
    const failed = applyInteractionOutcome(applicant(), askBaristaForWork, { kind: 'failure' }).state;
    expect(failed.possessions.jobsHired).toEqual([]);

    const { state } = applyInteractionOutcome(failed, askBaristaForWork, applying('Sam Lee'));
    expect(state.possessions.jobsHired).toEqual(['barista']);
  });

  it('records a Job only once', () => {
    const hired = applyInteractionOutcome(applicant(), askBaristaForWork, applying('Sam')).state;

    const { state } = applyInteractionOutcome(hired, askBaristaForWork, applying('Sam'));
    expect(state.possessions.jobsHired).toEqual(['barista']);
  });
});

describe('applyInteractionOutcome: Comfort Purchases', () => {
  const { buyABook, buyAGift } = INTERACTIONS;
  const order = (item: ItemId, quantity = 1) => ({ items: [{ item, quantity }] });
  const atTheBookshop = (): GameState => ({ ...createSave(TEST_SETUP), placeId: 'bookshop' });

  it('café cake fills Hunger and lifts Mood by the café Comfort Purchase lift, on top of the success', () => {
    const state = atTheCafe({ hunger: 10 });

    const { state: after, result } = applyInteractionOutcome(state, orderDrink, { kind: 'success', args: order('cake') });

    const lift = MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.cafe;
    expect(after.character.hunger).toBe(10 + WELL_BEING.cafeFoodHunger);
    expect(after.character.mood).toBe(state.character.mood + lift);
    expect(after.character.moneyInShifts).toBeCloseTo(state.character.moneyInShifts - price('cake'));
    expect(result).toMatchObject({ kind: 'success', moodChange: lift });
  });

  it('a special drink at the café is a Comfort Purchase too, and an everyday drink is not', () => {
    const comfort = applyInteractionOutcome(atTheCafe(), orderDrink, { kind: 'success', args: order('special-drink') });
    const everyday = applyInteractionOutcome(atTheCafe(), orderDrink, { kind: 'success', args: order('latte') });

    expect(comfort.result).toMatchObject({ moodChange: MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.cafe });
    expect(everyday.result).toMatchObject({ moodChange: MOOD.changes.goalInteractionSuccess });
  });

  it('lifts Mood once per kind of Comfort Purchase, however many are bought', () => {
    const args = { items: [{ item: 'cake', quantity: 3 }, { item: 'special-drink', quantity: 1 }] };

    const { result } = applyInteractionOutcome(atTheCafe(), orderDrink, { kind: 'success', args });

    expect(result).toMatchObject({ moodChange: MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.cafe });
  });

  it('a book is read, not kept: it lifts Mood and charges, and nothing goes into the inventory', () => {
    const state = atTheBookshop();

    const { state: after } = applyInteractionOutcome(state, buyABook, { kind: 'success', args: order('mystery-novel') });

    expect(after.character.mood).toBe(state.character.mood + MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.reading);
    expect(after.character.moneyInShifts).toBeCloseTo(state.character.moneyInShifts - price('mystery-novel'));
    expect(after.possessions.inventory).toEqual([]);
  });

  it('a wrapped gift goes into the inventory, ready to give, and never goes off', () => {
    const state = atTheBookshop();

    const { state: after, result } = applyInteractionOutcome(state, buyAGift, {
      kind: 'success',
      args: { items: [{ item: 'chocolates', quantity: 1 }], wrap: true },
    });

    expect(after.possessions.inventory).toEqual([{ itemId: 'chocolates', quantity: 1, expiresOnDay: null }]);
    expect(after.character.mood).toBe(state.character.mood + MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.gift);
    expect(result).toMatchObject({ kind: 'success', paidInShifts: price('chocolates'), served: [{ itemId: 'chocolates', quantity: 1 }] });
  });

  it('flowers bought unwrapped join the flowers already in the inventory', () => {
    const state = atTheBookshop();
    const once = applyInteractionOutcome(state, buyAGift, { kind: 'success', args: { items: [{ item: 'flowers', quantity: 1 }], wrap: false } });

    const { state: after } = applyInteractionOutcome(once.state, buyAGift, {
      kind: 'success',
      args: { items: [{ item: 'flowers', quantity: 2 }], wrap: true },
    });

    expect(after.possessions.inventory).toEqual([{ itemId: 'flowers', quantity: 3, expiresOnDay: null }]);
  });

  it('a Comfort Purchase the Character cannot afford changes nothing', () => {
    const broke = { ...atTheBookshop(), character: { ...atTheBookshop().character, moneyInShifts: 0.01 } };

    const { state, result } = applyInteractionOutcome(broke, buyAGift, { kind: 'success', args: { items: [{ item: 'flowers', quantity: 1 }], wrap: true } });

    expect(result).toEqual({ kind: 'cannot_afford' });
    expect(state).toEqual(broke);
  });
});
