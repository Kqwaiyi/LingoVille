import { describe, expect, it } from 'vitest';
import {
  applyShiftCustomer,
  cancelShift,
  endShift,
  METER_MAX,
  MOOD,
  moodModifier,
  PROFICIENCY_STEP_TABLE,
  PROFICIENCY_STEPS,
  tick,
  type ProficiencyStep,
  createSave,
  ECONOMY,
  hire,
  nextShiftCustomer,
  shiftRefusal,
  startShift,
  type GameState,
  type OpeningHours,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const CAFE_HOURS: OpeningHours = { opensAt: 7 * 60, closesAt: 19 * 60, closedOn: [] };

/** A hired barista at the café at 10:00 on day 3. */
function hiredBarista(): GameState {
  const state = hire(createSave(TEST_SETUP), 'barista');
  return { ...state, placeId: 'cafe', clock: { day: 3, minuteOfDay: 10 * 60 } };
}

describe('startShift: E at the staff door', () => {
  it("starts a Shift of the tuning's range of Shift Customers during opening hours", () => {
    const after = startShift(hiredBarista(), 'barista', CAFE_HOURS);
    const shift = after.possessions.shift!;
    expect(shift.jobId).toBe('barista');
    expect(shift.customers).toBeGreaterThanOrEqual(ECONOMY.shiftCustomers.min);
    expect(shift.customers).toBeLessThanOrEqual(ECONOMY.shiftCustomers.max);
    expect(shift).toMatchObject({ served: 0, failed: 0, customer: null });
  });

  it('draws how many customers come from the seeded RNG', () => {
    const counts = new Set(
      Array.from({ length: 40 }, (_, seed) => {
        const state = hire(createSave({ ...TEST_SETUP, rngSeed: seed }), 'barista');
        return startShift({ ...state, clock: { day: 3, minuteOfDay: 600 } }, 'barista', CAFE_HOURS).possessions.shift!.customers;
      }),
    );
    const { min, max } = ECONOMY.shiftCustomers;
    expect([...counts].sort((a, b) => a - b)).toEqual(Array.from({ length: max - min + 1 }, (_, i) => min + i));
    const before = hiredBarista();
    expect(startShift(before, 'barista', CAFE_HOURS)).toEqual(startShift(before, 'barista', CAFE_HOURS));
    expect(startShift(before, 'barista', CAFE_HOURS).rngState).not.toBe(before.rngState);
  });

  it('allows at most one Shift a day, with no schedule', () => {
    const worked = startShift(hiredBarista(), 'barista', CAFE_HOURS);
    const finished = { ...worked, possessions: { ...worked.possessions, shift: null } };
    expect(shiftRefusal(finished, 'barista', CAFE_HOURS)).toBe('workedToday');
    expect(startShift(finished, 'barista', CAFE_HOURS)).toBe(finished);

    // Any day after, at any hour the café is open.
    const nextDay = { ...finished, clock: { day: 4, minuteOfDay: 18 * 60 } };
    expect(shiftRefusal(nextDay, 'barista', CAFE_HOURS)).toBeNull();
    expect(startShift(nextDay, 'barista', CAFE_HOURS).possessions.shift).not.toBeNull();
  });

  it('refuses outside opening hours, before the Character is hired, or while a Shift is under way', () => {
    const closed = { ...hiredBarista(), clock: { day: 3, minuteOfDay: 19 * 60 } };
    expect(shiftRefusal(closed, 'barista', CAFE_HOURS)).toBe('closed');
    expect(startShift(closed, 'barista', CAFE_HOURS)).toBe(closed);

    const notHired = { ...createSave(TEST_SETUP), clock: { day: 3, minuteOfDay: 600 } };
    expect(shiftRefusal(notHired, 'barista', CAFE_HOURS)).toBe('notHired');
    expect(startShift(notHired, 'barista', CAFE_HOURS)).toBe(notHired);

    const working = startShift(hiredBarista(), 'barista', CAFE_HOURS);
    expect(shiftRefusal(working, 'barista', CAFE_HOURS)).toBe('underway');
  });
});

const DRINKS = ['latte', 'coffee', 'tea'] as const;

/** A Shift under way, with its first customer at the counter. */
function withCustomer(state = startShift(hiredBarista(), 'barista', CAFE_HOURS)): GameState {
  return nextShiftCustomer(state, DRINKS);
}

const orderOf = (state: GameState) => state.possessions.shift!.customer!.order;

describe('nextShiftCustomer: a Shift Customer walks up', () => {
  it('orders one drink from the template, held hidden in the Shift', () => {
    const order = orderOf(withCustomer());
    expect(order).toHaveLength(1);
    expect(DRINKS).toContain(order[0]!.itemId);
    expect(order[0]!.quantity).toBe(1);
  });

  it('draws the order and a voice from the seeded RNG', () => {
    const shift = startShift(hiredBarista(), 'barista', CAFE_HOURS);
    expect(withCustomer(shift)).toEqual(withCustomer(shift));
    const drawn = Array.from({ length: 30 }, (_, seed) => withCustomer({ ...shift, rngState: seed }).possessions.shift!.customer!);
    expect(new Set(drawn.map((customer) => customer.order[0]!.itemId)).size).toBe(DRINKS.length);
    expect(new Set(drawn.map((customer) => customer.voiceSeed)).size).toBeGreaterThan(1);
  });

  it('does nothing with no Shift under way', () => {
    const state = hiredBarista();
    expect(nextShiftCustomer(state, DRINKS)).toBe(state);
  });
});

describe('applyShiftCustomer: the exact check of what was served', () => {
  it('counts the customer served when the items match the order exactly', () => {
    const state = withCustomer();
    const { state: after, correct } = applyShiftCustomer(state, orderOf(state));
    expect(correct).toBe(true);
    expect(after.possessions.shift).toMatchObject({ served: 1, failed: 0, customer: null });
  });

  it('fails a different drink, a second drink, or more of the right one', () => {
    const state = withCustomer();
    const { itemId } = orderOf(state)[0]!;
    const other = DRINKS.find((drink) => drink !== itemId)!;
    for (const served of [
      [{ itemId: other, quantity: 1 }],
      [{ itemId, quantity: 1 }, { itemId: other, quantity: 1 }],
      [{ itemId, quantity: 2 }],
      [],
    ]) {
      const { state: after, correct } = applyShiftCustomer(state, served);
      expect(correct).toBe(false);
      expect(after.possessions.shift).toMatchObject({ served: 0, failed: 1, customer: null });
    }
  });

  it('fails a customer who walks off unserved (null), out of Patience', () => {
    const { state: after, correct } = applyShiftCustomer(withCustomer(), null);
    expect(correct).toBe(false);
    expect(after.possessions.shift).toMatchObject({ served: 0, failed: 1, customer: null });
  });

  it('ignores the order of lines in what was served', () => {
    const state = withCustomer();
    const order = [{ itemId: 'tea' as const, quantity: 1 }, { itemId: 'latte' as const, quantity: 2 }];
    const shift = { ...state.possessions.shift!, customer: { ...state.possessions.shift!.customer!, order } };
    const twoLines = { ...state, possessions: { ...state.possessions, shift } };
    expect(applyShiftCustomer(twoLines, [...order].reverse()).correct).toBe(true);
  });
});

/** A Shift of 6 customers that has served `served` of them and failed the rest, with Mood and the highest step reached as given. */
function finishedShift(served: number, { highestStep = 'A1' as ProficiencyStep, mood = MOOD.neutral } = {}): GameState {
  let state = startShift(hiredBarista(), 'barista', CAFE_HOURS);
  state = { ...state, possessions: { ...state.possessions, shift: { ...state.possessions.shift!, customers: 6 } } };
  for (let i = 0; i < 6; i++) {
    state = nextShiftCustomer(state, DRINKS);
    state = applyShiftCustomer(state, i < served ? orderOf(state) : null).state;
  }
  return {
    ...state,
    character: { ...state.character, mood },
    progression: { ...state.progression, highestStep },
  };
}

describe('endShift: the pay', () => {
  it('pays base × share served × Mood modifier × stake multiplier, minus a dock per failed customer, at each step', () => {
    for (const step of PROFICIENCY_STEPS) {
      const { stakeMultiplier, failedCustomerDock } = PROFICIENCY_STEP_TABLE[step];
      const before = finishedShift(4, { highestStep: step });
      const { state, payInShifts } = endShift(before);
      // Neutral Mood: a modifier of 1. Two failed customers: two docks, each a share of one Shift's base pay.
      expect(payInShifts).toBeCloseTo(ECONOMY.shiftBasePayInShifts * (4 / 6) * stakeMultiplier - 2 * failedCustomerDock * ECONOMY.shiftBasePayInShifts);
      expect(state.character.moneyInShifts).toBeCloseTo(before.character.moneyInShifts + payInShifts);
      expect(state.possessions.shift).toBeNull();
    }
  });

  it('docks nothing at A1 and A2, and more at each step from B1', () => {
    const docked = (step: ProficiencyStep) => endShift(finishedShift(6, { highestStep: step })).payInShifts - endShift(finishedShift(5, { highestStep: step })).payInShifts;
    const shareOfOne = (step: ProficiencyStep) => (ECONOMY.shiftBasePayInShifts / 6) * PROFICIENCY_STEP_TABLE[step].stakeMultiplier;
    expect(docked('A1')).toBeCloseTo(shareOfOne('A1'));
    expect(docked('A2')).toBeCloseTo(shareOfOne('A2'));
    const docks = (['B1', 'B2', 'C1', 'C2'] as const).map((step) => docked(step) - shareOfOne(step));
    expect(docks[0]).toBeGreaterThan(0);
    docks.slice(1).forEach((dock, i) => expect(dock).toBeGreaterThan(docks[i]!));
  });

  it('pays a whole Shift × the stake for every customer served at neutral Mood', () => {
    expect(endShift(finishedShift(6, { highestStep: 'A1' })).payInShifts).toBeCloseTo(ECONOMY.shiftBasePayInShifts);
    expect(endShift(finishedShift(6, { highestStep: 'C2' })).payInShifts).toBeCloseTo(
      ECONOMY.shiftBasePayInShifts * PROFICIENCY_STEP_TABLE.C2.stakeMultiplier,
    );
  });

  it('takes the stake from the highest step reached, not the current one', () => {
    const fellBack = { ...finishedShift(6, { highestStep: 'B2' }), proficiencyStep: 'A2' as const };
    expect(endShift(fellBack).payInShifts).toBeCloseTo(endShift(finishedShift(6, { highestStep: 'B2' })).payInShifts);
  });

  it('pays more in a good Mood and less in a bad one', () => {
    const at = (mood: number) => endShift(finishedShift(5, { mood })).payInShifts;
    expect(at(METER_MAX)).toBeCloseTo(at(MOOD.neutral) * moodModifier(METER_MAX));
    expect(at(0)).toBeLessThan(at(MOOD.neutral));
  });

  it('never pays below 0', () => {
    const { state, payInShifts } = endShift(finishedShift(0, { highestStep: 'C2' }));
    expect(payInShifts).toBe(0);
    expect(state.character.moneyInShifts).toBe(finishedShift(0).character.moneyInShifts);
  });

  it('pays nothing and changes nothing with no Shift under way', () => {
    const state = hiredBarista();
    expect(endShift(state)).toEqual({ state, payInShifts: 0 });
  });
});

describe('closing time and a Shift', () => {
  it("doesn't cut a Shift short: customers keep coming and the Shift pays after the café closes", () => {
    const lateStart = { ...hiredBarista(), clock: { day: 3, minuteOfDay: 19 * 60 - 5 } };
    let state = startShift(lateStart, 'barista', CAFE_HOURS);
    state = tick(state, 60);
    expect(state.possessions.shift).not.toBeNull();
    for (let i = 0; i < state.possessions.shift!.customers; i++) {
      state = nextShiftCustomer(state, DRINKS);
      state = applyShiftCustomer(state, orderOf(state)).state;
    }
    expect(endShift(state).payInShifts).toBeCloseTo(ECONOMY.shiftBasePayInShifts);
  });
});

describe('cancelShift: a Shift that can’t go on through no fault of the Player’s', () => {
  it('gives the day’s Shift back if no customer had been dealt with yet', () => {
    const before = hiredBarista();
    const cancelled = cancelShift(withCustomer(startShift(before, 'barista', CAFE_HOURS)));
    expect(cancelled.possessions.shift).toBeNull();
    expect(cancelled.character.moneyInShifts).toBe(before.character.moneyInShifts);
    expect(shiftRefusal(cancelled, 'barista', CAFE_HOURS)).toBeNull();
  });

  it('otherwise ends the Shift, paid for the customers served so far', () => {
    let state = withCustomer();
    state = applyShiftCustomer(state, orderOf(state)).state;
    expect(cancelShift(state)).toEqual(endShift(state).state);
  });
});
