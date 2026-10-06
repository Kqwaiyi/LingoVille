import { describe, expect, it } from 'vitest';
import type { DrinkModifiers, ShiftTemplate } from '../content/index.ts';
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
  LIFE_SKILLS,
  hire,
  nextShiftCustomer,
  shiftRefusal,
  startShift,
  type GameState,
  type OpeningHours,
  type ShiftOrder,
  STEP_BANDS,
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
const EXTRAS = { coffee: ['milk', 'sugar'], tea: ['lemon', 'milk'] } as const;
const SINGLE_DRINK: ShiftTemplate = { id: 'single', band: 'B', drinks: DRINKS, modifiers: null, changesMind: false };
const MADE_TO_ORDER: ShiftTemplate = { id: 'made-to-order', band: 'I', drinks: ['coffee', 'tea'], modifiers: { sizes: ['small', 'medium', 'large'], temperatures: ['hot', 'iced'], extras: EXTRAS }, changesMind: false };
const CHANGE_OF_MIND: ShiftTemplate = { ...MADE_TO_ORDER, id: 'change-of-mind', band: 'A', changesMind: true };
const BARISTA = [SINGLE_DRINK, MADE_TO_ORDER, CHANGE_OF_MIND];

/** A Shift under way, with its first customer at the counter, drawn from `templates`. */
function withCustomer(state = startShift(hiredBarista(), 'barista', CAFE_HOURS), templates: readonly ShiftTemplate[] = [SINGLE_DRINK]): GameState {
  return nextShiftCustomer(state, templates);
}

const customerOf = (state: GameState) => state.possessions.shift!.customer!;
const orderOf = (state: GameState) => customerOf(state).order;

describe('nextShiftCustomer: a Shift Customer walks up', () => {
  it('orders one drink from the template, held hidden in the Shift', () => {
    const customer = customerOf(withCustomer());
    expect(customer).toMatchObject({ templateId: 'single', changedFrom: null });
    expect(customer.order).toHaveLength(1);
    expect(DRINKS).toContain(customer.order[0]!.itemId);
    expect(customer.order[0]).toEqual({ itemId: customer.order[0]!.itemId, quantity: 1 });
  });

  it('draws the order and a voice from the seeded RNG', () => {
    const shift = startShift(hiredBarista(), 'barista', CAFE_HOURS);
    expect(withCustomer(shift)).toEqual(withCustomer(shift));
    const drawn = Array.from({ length: 30 }, (_, seed) => customerOf(withCustomer({ ...shift, rngState: seed })));
    expect(new Set(drawn.map((customer) => customer.order[0]!.itemId)).size).toBe(DRINKS.length);
    expect(new Set(drawn.map((customer) => customer.voiceSeed)).size).toBeGreaterThan(1);
  });

  it('does nothing with no Shift under way, or with no templates', () => {
    const state = hiredBarista();
    expect(nextShiftCustomer(state, BARISTA)).toBe(state);
    const shift = startShift(state, 'barista', CAFE_HOURS);
    expect(nextShiftCustomer(shift, [])).toBe(shift);
  });
});

describe('nextShiftCustomer: harder customers', () => {
  const shift = startShift(hiredBarista(), 'barista', CAFE_HOURS);
  const drawn = (template: ShiftTemplate) => Array.from({ length: 60 }, (_, seed) => customerOf(withCustomer({ ...shift, rngState: seed }, [template])));

  it('orders a drink made to order: a size, hot or iced, and one extra that drink takes', () => {
    const customers = drawn(MADE_TO_ORDER);
    for (const { order, changedFrom } of customers) {
      expect(changedFrom).toBeNull();
      expect(order).toHaveLength(1);
      const { itemId, quantity, modifiers } = order[0]!;
      expect(quantity).toBe(1);
      expect(['coffee', 'tea']).toContain(itemId);
      expect(modifiers!.extras).toHaveLength(1);
      expect(EXTRAS[itemId as keyof typeof EXTRAS]).toContain(modifiers!.extras[0]);
    }
    const all = customers.map(({ order }) => order[0]!.modifiers!);
    expect(new Set(all.map((m) => m.size))).toEqual(new Set(['small', 'medium', 'large']));
    expect(new Set(all.map((m) => m.temperature))).toEqual(new Set(['hot', 'iced']));
  });

  it('changes their mind halfway: they first ask for something else made to order', () => {
    for (const { order, changedFrom } of drawn(CHANGE_OF_MIND)) {
      expect(changedFrom).toHaveLength(1);
      expect(changedFrom![0]!.modifiers).toBeDefined();
      expect(order[0]!.modifiers).toBeDefined();
      expect(changedFrom).not.toEqual(order);
    }
  });
});

describe('nextShiftCustomer: the customer mix', () => {
  const DRAWS = 3000;
  /** The share of `DRAWS` customers from each template, at this step, with these templates. */
  function mix(step: ProficiencyStep, templates: readonly ShiftTemplate[]) {
    let state: GameState = { ...startShift(hiredBarista(), 'barista', CAFE_HOURS), proficiencyStep: step };
    const counts: Record<string, number> = {};
    for (let i = 0; i < DRAWS; i++) {
      state = nextShiftCustomer(state, templates);
      const { templateId } = customerOf(state);
      counts[templateId] = (counts[templateId] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, n / DRAWS]));
  }
  const { ownBand, bandBelow, bandAbove } = ECONOMY.shiftCustomerMix;
  const expectShares = (actual: Record<string, number>, expected: Record<string, number>) => {
    for (const id of new Set([...Object.keys(actual), ...Object.keys(expected)])) expect(actual[id] ?? 0).toBeCloseTo(expected[id] ?? 0, 1);
  };

  it('maps the steps to bands: B = A1–A2, I = B1–B2, A = C1–C2', () => {
    expect(STEP_BANDS).toEqual({ A1: 'B', A2: 'B', B1: 'I', B2: 'I', C1: 'A', C2: 'A' });
  });

  it('draws from the own band, the one below and the one above in the tuned shares, on the current step', () => {
    expectShares(mix('B1', BARISTA), { single: bandBelow, 'made-to-order': ownBand, 'change-of-mind': bandAbove });
    expectShares(mix('B2', BARISTA), { single: bandBelow, 'made-to-order': ownBand, 'change-of-mind': bandAbove });
  });

  it('falls back to the nearest band the Job has: below B is B, above A is A', () => {
    expectShares(mix('A1', BARISTA), { single: ownBand + bandBelow, 'made-to-order': bandAbove });
    expectShares(mix('C2', BARISTA), { 'made-to-order': bandBelow, 'change-of-mind': ownBand + bandAbove });
  });

  it('falls back to the nearest band for a Job missing one, the easier on a tie', () => {
    expectShares(mix('C1', [SINGLE_DRINK, MADE_TO_ORDER]), { single: 0, 'made-to-order': 1 });
    expectShares(mix('B1', [SINGLE_DRINK, CHANGE_OF_MIND]), { single: ownBand + bandBelow, 'change-of-mind': bandAbove });
    expectShares(mix('C1', [SINGLE_DRINK]), { single: 1 });
  });

  it('follows the current step, not the highest reached', () => {
    const atA2 = (state: GameState): GameState => ({ ...state, progression: { ...state.progression, highestStep: 'C2' } });
    let state = atA2({ ...startShift(hiredBarista(), 'barista', CAFE_HOURS), proficiencyStep: 'A2' });
    for (let i = 0; i < 200; i++) {
      state = nextShiftCustomer(state, BARISTA);
      expect(customerOf(state).templateId).not.toBe('change-of-mind');
    }
  });
});

const made = (size: DrinkModifiers['size'], temperature: DrinkModifiers['temperature'], ...extras: DrinkModifiers['extras']): DrinkModifiers => ({
  size,
  temperature,
  extras,
});

/** A Shift under way, with a customer at the counter who wants `order`, having first asked for `changedFrom`. */
function wanting(order: ShiftOrder, changedFrom: ShiftOrder | null = null): GameState {
  const state = withCustomer();
  const shift = state.possessions.shift!;
  return { ...state, possessions: { ...state.possessions, shift: { ...shift, customer: { ...shift.customer!, order, changedFrom } } } };
}

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
    state = nextShiftCustomer(state, [SINGLE_DRINK]);
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

describe('applyShiftCustomer: the exact check of a drink made to order', () => {
  const icedTea = [{ itemId: 'tea' as const, quantity: 1, modifiers: made('large', 'iced', 'lemon') }];

  it('serves a customer the drink made exactly as ordered', () => {
    expect(applyShiftCustomer(wanting(icedTea), icedTea).correct).toBe(true);
  });

  it('fails the wrong size, hot for iced, a missing, extra or different extra, or no modifiers at all', () => {
    for (const modifiers of [
      made('medium', 'iced', 'lemon'),
      made('large', 'hot', 'lemon'),
      made('large', 'iced'),
      made('large', 'iced', 'lemon', 'sugar'),
      made('large', 'iced', 'milk'),
      undefined,
    ]) {
      const { state, correct } = applyShiftCustomer(wanting(icedTea), [{ itemId: 'tea', quantity: 1, ...(modifiers && { modifiers }) }]);
      expect(correct).toBe(false);
      expect(state.possessions.shift).toMatchObject({ served: 0, failed: 1 });
    }
  });

  it('ignores the order extras are added in', () => {
    const order = [{ itemId: 'coffee' as const, quantity: 1, modifiers: made('small', 'hot', 'milk', 'sugar') }];
    expect(applyShiftCustomer(wanting(order), [{ itemId: 'coffee', quantity: 1, modifiers: made('small', 'hot', 'sugar', 'milk') }]).correct).toBe(true);
  });

  it('counts two lines of the same drink made the same way as one line of two', () => {
    const order = [{ itemId: 'tea' as const, quantity: 2, modifiers: made('large', 'iced', 'lemon') }];
    expect(applyShiftCustomer(wanting(order), [...icedTea, ...icedTea]).correct).toBe(true);
    expect(applyShiftCustomer(wanting(order), [...icedTea, { ...icedTea[0]!, modifiers: made('large', 'hot', 'lemon') }]).correct).toBe(false);
  });

  it('takes the drink alone for a customer who said nothing of how it is made', () => {
    expect(applyShiftCustomer(wanting([{ itemId: 'tea', quantity: 1 }]), icedTea).correct).toBe(true);
  });

  it('checks the final order after a change of mind, not what they first asked for', () => {
    const hotCoffee = [{ itemId: 'coffee' as const, quantity: 1, modifiers: made('medium', 'hot', 'milk') }];
    const changed = wanting(icedTea, hotCoffee);
    expect(applyShiftCustomer(changed, icedTea).correct).toBe(true);
    expect(applyShiftCustomer(changed, hotCoffee).correct).toBe(false);
    expect(applyShiftCustomer(changed, [...hotCoffee, ...icedTea]).correct).toBe(false);
  });
});

describe('closing time and a Shift', () => {
  it("doesn't cut a Shift short: customers keep coming and the Shift pays after the café closes", () => {
    const lateStart = { ...hiredBarista(), clock: { day: 3, minuteOfDay: 19 * 60 - 5 } };
    let state = startShift(lateStart, 'barista', CAFE_HOURS);
    state = tick(state, 60);
    expect(state.possessions.shift).not.toBeNull();
    for (let i = 0; i < state.possessions.shift!.customers; i++) {
      state = nextShiftCustomer(state, [SINGLE_DRINK]);
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

describe('the Barista skill', () => {
  const baristaXp = (state: GameState) => state.progression.lifeSkillXp.barista;

  it('earns XP for each customer served correctly, times the Mood modifier', () => {
    const state = withCustomer();
    expect(baristaXp(applyShiftCustomer(state, orderOf(state)).state)).toBeCloseTo(baristaXp(state) + LIFE_SKILLS.xpPerShiftCustomer);
    const great = { ...state, character: { ...state.character, mood: METER_MAX } };
    expect(baristaXp(applyShiftCustomer(great, orderOf(great)).state)).toBeCloseTo(LIFE_SKILLS.xpPerShiftCustomer * moodModifier(METER_MAX));
  });

  it('earns nothing for a customer served the wrong thing or who walks off', () => {
    const state = withCustomer();
    expect(baristaXp(applyShiftCustomer(state, null).state)).toBe(baristaXp(state));
    expect(baristaXp(applyShiftCustomer(state, []).state)).toBe(baristaXp(state));
  });
});

describe('endShift: the Barista skill raise', () => {
  const atLevel = (state: GameState, level: number): GameState => ({
    ...state,
    progression: { ...state.progression, lifeSkillXp: { ...state.progression.lifeSkillXp, barista: LIFE_SKILLS.xpToReachLevel[level]! } },
  });

  it('adds the raise (6%) to pay for each level', () => {
    for (let level = 0; level <= LIFE_SKILLS.maxLevel; level++) {
      expect(endShift(atLevel(finishedShift(6), level)).payInShifts).toBeCloseTo(ECONOMY.shiftBasePayInShifts * (1 + ECONOMY.jobLifeSkillPayRaisePerLevel * level));
    }
  });

  it('raises what was earned, not the docks for failed customers', () => {
    const { stakeMultiplier, failedCustomerDock } = PROFICIENCY_STEP_TABLE.B2;
    const pay = endShift(atLevel(finishedShift(3, { highestStep: 'B2' }), 2)).payInShifts;
    expect(pay).toBeCloseTo(ECONOMY.shiftBasePayInShifts * ((3 / 6) * stakeMultiplier * (1 + 2 * ECONOMY.jobLifeSkillPayRaisePerLevel) - 3 * failedCustomerDock));
  });
});

describe('endShift: customers the Player had translated', () => {
  /** A Shift of 6 customers, every one served correctly, the first `translated` of them after translating their lines. */
  const servedAll = (translated: number, highestStep: ProficiencyStep): GameState => {
    let state = startShift(hiredBarista(), 'barista', CAFE_HOURS);
    state = { ...state, possessions: { ...state.possessions, shift: { ...state.possessions.shift!, customers: 6 } } };
    for (let i = 0; i < 6; i++) {
      state = nextShiftCustomer(state, [SINGLE_DRINK]);
      state = applyShiftCustomer(state, orderOf(state), { translated: i < translated }).state;
    }
    return { ...state, progression: { ...state.progression, highestStep } };
  };

  it('pays a translated customer served correctly the per-customer amount minus half the failure dock', () => {
    for (const step of PROFICIENCY_STEPS) {
      const halfDock = ECONOMY.translatedCustomerDockShare * PROFICIENCY_STEP_TABLE[step].failedCustomerDock * ECONOMY.shiftBasePayInShifts;
      expect(endShift(servedAll(1, step)).payInShifts).toBeCloseTo(endShift(servedAll(0, step)).payInShifts - halfDock);
      expect(endShift(servedAll(2, step)).payInShifts).toBeCloseTo(endShift(servedAll(0, step)).payInShifts - 2 * halfDock);
    }
  });

  it('docks nothing for translating at A1–A2, where failing is docked nothing either', () => {
    for (const step of ['A1', 'A2'] as const) {
      expect(endShift(servedAll(3, step)).payInShifts).toBeCloseTo(endShift(servedAll(0, step)).payInShifts);
    }
  });

  it('always pays more than failing the customer, from B1 up', () => {
    for (const step of ['B1', 'B2', 'C1', 'C2'] as const) {
      expect(endShift(servedAll(1, step)).payInShifts).toBeGreaterThan(endShift(finishedShift(5, { highestStep: step })).payInShifts);
    }
  });

  it('docks a translated customer served the wrong thing as one failure, no more', () => {
    const state = withCustomer();
    const { state: after } = applyShiftCustomer(state, [], { translated: true });
    expect(endShift(after)).toEqual(endShift(applyShiftCustomer(state, []).state));
  });
});

describe('endShift: overwork', () => {
  /** Works a whole Shift on `day`, every customer served, and returns the state after it is paid. */
  const workOn = (state: GameState, day: number): GameState => {
    let working = startShift({ ...state, clock: { day, minuteOfDay: 10 * 60 } }, 'barista', CAFE_HOURS);
    for (let i = 0; i < working.possessions.shift!.customers; i++) {
      working = nextShiftCustomer(working, [SINGLE_DRINK]);
      working = applyShiftCustomer(working, orderOf(working)).state;
    }
    return endShift(working).state;
  };
  const moodChange = (state: GameState, day: number) => workOn(state, day).character.mood - state.character.mood;
  const workedDays = (days: number[]) => days.reduce(workOn, hiredBarista());
  /** `count` days in a row from `from`. */
  const daysFrom = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);
  const { overworkDaysPerWeek: overwork, overworkWeekDays: week, overworkPenaltyPerShift: penalty } = MOOD;
  /** Days worked in a row up to the day before `day`: one short of overwork. */
  const oneShortBefore = (day: number) => workedDays(daysFrom(day - (overwork - 1), overwork - 1));

  it('costs no Mood for the days worked in a week short of overwork', () => {
    expect(moodChange(workedDays(daysFrom(20, overwork - 2)), 20 + overwork - 2)).toBe(0);
  });

  it('costs Mood for each Shift once the Character has worked overwork’s days (5) or more in the last week', () => {
    expect(penalty).toBeLessThan(0);
    expect(moodChange(oneShortBefore(30), 30)).toBe(penalty);
    expect(moodChange(workOn(oneShortBefore(30), 30), 31)).toBe(penalty);
  });

  it('forgets days worked more than a week ago', () => {
    // A day worked, then the last days of the week it starts but one short of overwork.
    const first = 20;
    const worked = workedDays([first, ...daysFrom(first + week - overwork + 1, overwork - 2)]);
    expect(moodChange(worked, first + week - 1)).toBe(penalty);
    expect(moodChange(worked, first + week)).toBe(0);
  });

  it('is taken after the pay, so it never lowers that Shift’s pay', () => {
    const paid = (state: GameState) => state.character.moneyInShifts;
    const payOn30 = (state: GameState) => paid(workOn(state, 30)) - paid(state);
    // The same Shifts worked, with the same Barista XP, but long enough ago not to count.
    expect(payOn30(oneShortBefore(30))).toBeCloseTo(payOn30(workedDays(daysFrom(1, overwork - 1))));
  });

  it('never takes Mood below 0', () => {
    const worked = oneShortBefore(30);
    expect(workOn({ ...worked, character: { ...worked.character, mood: 1 } }, 30).character.mood).toBe(0);
  });
});
