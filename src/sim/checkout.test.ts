import { describe, expect, it } from 'vitest';
import type { ItemId, ShiftTemplate } from '../content/index.ts';
import {
  applyShiftCustomer,
  createSave,
  ECONOMY,
  hire,
  jobAids,
  LIFE_SKILLS,
  nextShiftCustomer,
  startShift,
  suggestChange,
  type GameState,
  type OpeningHours,
  type Till,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const SUPERMARKET_HOURS: OpeningHours = { opensAt: 9 * 60, closesAt: 21 * 60, closedOn: [] };

const GROCERIES = ['vegetables', 'eggs', 'noodles'] as const satisfies readonly ItemId[];
const BEHIND = ['batteries', 'stamps'] as const satisfies readonly ItemId[];
const PAYS: ShiftTemplate = { id: 'pays', band: 'B', basket: GROCERIES, behindTheCounter: null };
const PAYS_CASH: ShiftTemplate = { id: 'pays-cash', band: 'I', basket: GROCERIES, behindTheCounter: BEHIND };

/** A till in yen: groceries at ¥360, batteries at ¥420, stamps at ¥120, and the coins and notes in the drawer. */
const YEN: Till = {
  prices: { vegetables: 360, eggs: 360, noodles: 360, batteries: 420, stamps: 120 } as Till['prices'],
  denominations: [1, 5, 10, 50, 100, 500, 1000, 5000, 10000],
};
/** A till in pounds, where change runs to pence. */
const POUNDS: Till = {
  prices: { vegetables: 3.6, eggs: 3.6, noodles: 3.6, batteries: 4.2, stamps: 1.2 } as Till['prices'],
  denominations: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50],
};

/** A hired cashier at the supermarket at 10:00 on day 3, with a Shift under way. */
function cashierShift(seed = TEST_SETUP.rngSeed): GameState {
  const state = hire(createSave({ ...TEST_SETUP, rngSeed: seed }), 'cashier');
  return startShift({ ...state, placeId: 'supermarket', clock: { day: 3, minuteOfDay: 10 * 60 } }, 'cashier', SUPERMARKET_HOURS);
}

const customerOf = (state: GameState) => state.possessions.shift!.customer!;
const drawn = (template: ShiftTemplate, till = YEN) =>
  Array.from({ length: 80 }, (_, seed) => customerOf(nextShiftCustomer(cashierShift(seed), [template], till)));

/** What the customer's shopping and anything from behind the counter come to, at this till. */
const totalOf = (state: GameState, till = YEN) => customerOf(state).order.reduce((sum, { itemId, quantity }) => sum + till.prices[itemId] * quantity, 0);

describe('nextShiftCustomer: a customer at the till', () => {
  it('brings shopping from the shelves, wants a bag or not and has a points card or not, and pays by card', () => {
    const customers = drawn(PAYS);
    for (const { order, checkout, changedFrom } of customers) {
      expect(changedFrom).toBeNull();
      expect(order.length).toBeGreaterThanOrEqual(ECONOMY.checkout.basketLines.min);
      expect(order.length).toBeLessThanOrEqual(ECONOMY.checkout.basketLines.max);
      expect(new Set(order.map(({ itemId }) => itemId)).size).toBe(order.length);
      for (const { itemId, quantity, modifiers } of order) {
        expect(GROCERIES).toContain(itemId);
        expect(quantity).toBeGreaterThanOrEqual(1);
        expect(quantity).toBeLessThanOrEqual(ECONOMY.checkout.maxQuantity);
        expect(modifiers).toBeUndefined();
      }
      expect(checkout).toMatchObject({ fromBehindTheCounter: null, cashHanded: null, changeDue: null });
    }
    expect(new Set(customers.map(({ checkout }) => checkout!.bag))).toEqual(new Set([true, false]));
    expect(new Set(customers.map(({ checkout }) => checkout!.pointsCard))).toEqual(new Set([true, false]));
  });

  it('asks for one item from behind the counter, which is rung up with the shopping, and pays cash', () => {
    const customers = drawn(PAYS_CASH);
    for (const { order, checkout } of customers) {
      const fetched = checkout!.fromBehindTheCounter!;
      expect(BEHIND).toContain(fetched);
      expect(order).toContainEqual({ itemId: fetched, quantity: 1 });
      expect(order.filter(({ itemId }) => !GROCERIES.includes(itemId as never))).toHaveLength(1);
    }
    expect(new Set(customers.map(({ checkout }) => checkout!.fromBehindTheCounter))).toEqual(new Set(BEHIND));
  });

  it('hands over more cash than the total, in a round amount of the money in the drawer, and is owed the difference', () => {
    for (const till of [YEN, POUNDS]) {
      for (let seed = 0; seed < 60; seed++) {
        const state = nextShiftCustomer(cashierShift(seed), [PAYS_CASH], till);
        const { cashHanded, changeDue } = customerOf(state).checkout!;
        const total = totalOf(state, till);
        expect(cashHanded!).toBeGreaterThan(total);
        expect(till.denominations.some((d) => Math.abs(Math.round(cashHanded! / d) * d - cashHanded!) < 1e-9)).toBe(true);
        expect(changeDue!).toBeCloseTo(cashHanded! - total, 9);
      }
    }
  });

  it('draws everything from the seeded RNG', () => {
    const shift = cashierShift();
    expect(nextShiftCustomer(shift, [PAYS_CASH], YEN)).toEqual(nextShiftCustomer(shift, [PAYS_CASH], YEN));
    expect(new Set(drawn(PAYS_CASH).map(({ checkout }) => checkout!.cashHanded)).size).toBeGreaterThan(1);
  });

  it('cannot be drawn without the till', () => {
    expect(() => nextShiftCustomer(cashierShift(), [PAYS])).toThrow(/till/);
  });
});

/** A Shift with a customer at the till, drawn from `template`. */
const atTheTill = (template = PAYS_CASH, seed = TEST_SETUP.rngSeed, till = YEN) => nextShiftCustomer(cashierShift(seed), [template], till);

/** Everything done right for the customer at the till: their bag and card as they wanted, and their change. */
const rightly = (state: GameState) => {
  const { bag, pointsCard, changeDue } = customerOf(state).checkout!;
  return { bag, pointsCard, change: changeDue ?? 0 };
};

describe('applyShiftCustomer: the exact check at the till', () => {
  it('serves a customer whose items, bag, points card and change are all exactly right', () => {
    for (const template of [PAYS, PAYS_CASH]) {
      for (let seed = 0; seed < 20; seed++) {
        const state = atTheTill(template, seed);
        const { state: after, correct } = applyShiftCustomer(state, customerOf(state).order, { atTheTill: rightly(state) });
        expect(correct).toBe(true);
        expect(after.possessions.shift).toMatchObject({ served: 1, failed: 0, customer: null });
      }
    }
  });

  it('fails a missed item, one scanned twice, or the item from behind the counter not fetched', () => {
    const state = atTheTill();
    const { order, checkout } = customerOf(state);
    const done = { atTheTill: rightly(state) };
    const withoutFetched = order.filter(({ itemId }) => itemId !== checkout!.fromBehindTheCounter);
    const doubled = order.map((line, i) => (i === 0 ? { ...line, quantity: line.quantity + 1 } : line));
    for (const served of [order.slice(1), doubled, withoutFetched, []]) {
      expect(applyShiftCustomer(state, served, done).correct).toBe(false);
    }
  });

  it('fails the wrong item fetched from behind the counter', () => {
    const state = atTheTill();
    const { order, checkout } = customerOf(state);
    const other = BEHIND.find((itemId) => itemId !== checkout!.fromBehindTheCounter)!;
    const wrongFetch = order.map((line) => (line.itemId === checkout!.fromBehindTheCounter ? { ...line, itemId: other } : line));
    // Change worked out for the right item: only the fetch is wrong.
    expect(applyShiftCustomer(state, wrongFetch, { atTheTill: rightly(state) }).correct).toBe(false);
  });

  it('fails a bag or points card toggled the other way', () => {
    const state = atTheTill(PAYS);
    const { order } = customerOf(state);
    const right = rightly(state);
    expect(applyShiftCustomer(state, order, { atTheTill: { ...right, bag: !right.bag } }).correct).toBe(false);
    expect(applyShiftCustomer(state, order, { atTheTill: { ...right, pointsCard: !right.pointsCard } }).correct).toBe(false);
  });

  it('fails change short or over by the smallest coin, and passes it to the penny', () => {
    for (const till of [YEN, POUNDS]) {
      const state = atTheTill(PAYS_CASH, 7, till);
      const { order } = customerOf(state);
      const right = rightly(state);
      const smallest = till.denominations[0]!;
      expect(applyShiftCustomer(state, order, { atTheTill: { ...right, change: right.change - smallest } }).correct).toBe(false);
      expect(applyShiftCustomer(state, order, { atTheTill: { ...right, change: right.change + smallest } }).correct).toBe(false);
      // Coins added up one by one carry floating-point dust (0.1 + 0.2): still the right change.
      expect(applyShiftCustomer(state, order, { atTheTill: { ...right, change: right.change + 1e-12 } }).correct).toBe(true);
    }
  });

  it('fails change given to a customer who paid by card', () => {
    const state = atTheTill(PAYS);
    expect(applyShiftCustomer(state, customerOf(state).order, { atTheTill: { ...rightly(state), change: 10 } }).correct).toBe(false);
  });

  it('takes nothing done at the till as no bag, no points card and no change', () => {
    const noBagNoCard = Array.from({ length: 40 }, (_, seed) => atTheTill(PAYS, seed)).find((state) => {
      const { bag, pointsCard } = customerOf(state).checkout!;
      return !bag && !pointsCard;
    })!;
    expect(applyShiftCustomer(noBagNoCard, customerOf(noBagNoCard).order).correct).toBe(true);
  });

  it('earns Cashier XP for each customer served correctly, and none for a wrong one', () => {
    const state = atTheTill();
    const cashierXp = (s: GameState) => s.progression.lifeSkillXp.cashier;
    expect(cashierXp(applyShiftCustomer(state, customerOf(state).order, { atTheTill: rightly(state) }).state)).toBeCloseTo(LIFE_SKILLS.xpPerShiftCustomer);
    expect(cashierXp(applyShiftCustomer(state, [], { atTheTill: rightly(state) }).state)).toBe(0);
  });
});

describe('suggestChange: the Cashier skill suggests coins', () => {
  it('makes the amount with the fewest coins and notes, largest first', () => {
    expect(suggestChange(720, YEN.denominations)).toEqual([500, 100, 100, 10, 10]);
    expect(suggestChange(8640, YEN.denominations)).toEqual([5000, 1000, 1000, 1000, 500, 100, 10, 10, 10, 10]);
    expect(suggestChange(0, YEN.denominations)).toEqual([]);
  });

  it('counts pence exactly, with no floating-point dust', () => {
    expect(suggestChange(0.3, POUNDS.denominations)).toEqual([0.2, 0.1]);
    expect(suggestChange(15.87, POUNDS.denominations)).toEqual([10, 5, 0.5, 0.2, 0.1, 0.05, 0.02]);
  });

  it('is an aid of the Cashier skill from the tuned level', () => {
    const at = (xp: number) => {
      const state = createSave(TEST_SETUP);
      return { ...state, progression: { ...state.progression, lifeSkillXp: { ...state.progression.lifeSkillXp, cashier: xp } } };
    };
    const level = LIFE_SKILLS.jobAidsFromLevel.cashier.suggestedChange;
    expect(jobAids(at(LIFE_SKILLS.xpToReachLevel[level - 1]!), 'cashier')).toEqual([]);
    expect(jobAids(at(LIFE_SKILLS.xpToReachLevel[level]!), 'cashier')).toEqual(['suggestedChange']);
  });
});
