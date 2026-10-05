import { describe, expect, it } from 'vitest';
import {
  announceNewcomerDiscount,
  applyRecapEvidence,
  createSave,
  ECONOMY,
  FIRST_MORNING,
  grantExtension,
  MOOD,
  newcomerDiscountStepDownDue,
  payRent,
  PROFICIENCY_STEP_TABLE,
  rentDebt,
  rentStatement,
  sleep,
  tick,
  type ConversationEvidence,
  type GameState,
  type ProficiencyStep,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const HOUR = 60;
const DAY = 24 * HOUR;

/** A week's rent at this step, worked out from the spec's table rather than by the rule under test. */
const weeklyRentAt = (step: ProficiencyStep) => ECONOMY.weeklyRentInShifts * (1 - PROFICIENCY_STEP_TABLE[step].newcomerDiscount);
/** The first due day, and the ones after it. */
const DUE = FIRST_MORNING.rentDueDay;
const WEEK = ECONOMY.rentPeriodDays;

/** A game on `day` at `minuteOfDay`, out in the park with needs met, so nothing but the clock matters. */
function on(day: number, minuteOfDay: number, change: (state: GameState) => GameState = (s) => s): GameState {
  const state = createSave(TEST_SETUP);
  return change({ ...state, placeId: 'park', clock: { day, minuteOfDay } });
}

/** Keeps the Character fed and watered, so a long tick changes nothing but the clock and rent. */
const fed = (state: GameState): GameState => ({ ...state, character: { ...state.character, hunger: 100, thirst: 100 } });

describe('rent falling due', () => {
  it("owes the first week's rent from the start, at the starting step's Newcomer Discount, due at the end of its first due day", () => {
    const state = createSave(TEST_SETUP);
    expect(state.rent.dueDay).toBe(FIRST_MORNING.rentDueDay);
    expect(state.rent.owedInShifts).toBeCloseTo(weeklyRentAt('A1'));
    expect(createSave({ ...TEST_SETUP, startingStep: 'B1' }).rent.owedInShifts).toBeCloseTo(weeklyRentAt('B1'));
  });

  it('turns unpaid rent into rent debt at the end of the due day, and starts the next week', () => {
    const before = fed(on(DUE, 23 * HOUR));
    const after = tick(before, 2 * HOUR);

    expect(rentDebt(after)).toBeCloseTo(weeklyRentAt('A1'));
    expect(after.rent.dueDay).toBe(DUE + WEEK);
    expect(after.rent.owedInShifts).toBeCloseTo(weeklyRentAt('A1'));
  });

  it('never takes rent from the Character’s money: rent is only paid to the landlord', () => {
    const before = fed(on(DUE, 23 * HOUR, (s) => ({ ...s, character: { ...s.character, moneyInShifts: 10 } })));
    const after = tick(before, 2 * HOUR);

    expect(after.character.moneyInShifts).toBe(10);
    expect(rentDebt(after)).toBeCloseTo(weeklyRentAt('A1'));
  });

  it('is not due before the end of the due day', () => {
    const after = tick(fed(on(DUE, 8 * HOUR)), 15 * HOUR);
    expect(after.debts).toEqual([]);
    expect(after.rent.dueDay).toBe(DUE);
  });

  it('falls due once a week, adding each unpaid week to the debt', () => {
    let state = fed(on(DUE, 23 * HOUR));
    for (let day = 0; day <= WEEK; day++) state = fed(tick(state, DAY));
    expect(state.rent.dueDay).toBe(DUE + 2 * WEEK);
    expect(rentDebt(state)).toBeCloseTo(2 * weeklyRentAt('A1'));
  });

  it('falls due while the Character sleeps through the end of the due day', () => {
    const after = sleep(on(DUE, 22 * HOUR, (s) => ({ ...s, placeId: 'home' })));
    expect(rentDebt(after)).toBeCloseTo(weeklyRentAt('A1'));
    expect(after.rent.dueDay).toBe(DUE + WEEK);
  });

  it('charges nothing when this week is paid already', () => {
    const after = tick(fed(on(DUE, 23 * HOUR, (s) => ({ ...s, rent: { ...s.rent, owedInShifts: 0 } }))), 2 * HOUR);
    expect(after.debts).toEqual([]);
    expect(after.rent.owedInShifts).toBeCloseTo(weeklyRentAt('A1'));
  });
});

describe('rent debt and Mood', () => {
  it('costs Mood at the end of the day the rent became debt, and every day after while it is owed', () => {
    const before = fed(on(DUE, 23 * HOUR));
    const fellDue = tick(before, 2 * HOUR);
    expect(fellDue.character.mood).toBeCloseTo(before.character.mood + MOOD.debtPenaltyPerDay);

    // Through the end of the next day, before the small hours drain Mood on their own.
    const dayLater = tick(fed({ ...fellDue, clock: { day: DUE + 1, minuteOfDay: 23 * HOUR } }), 2 * HOUR);
    expect(dayLater.character.mood).toBeCloseTo(fellDue.character.mood + MOOD.debtPenaltyPerDay);
  });

  it('costs no Mood while nothing is owed', () => {
    const before = fed(on(DUE - 2, 23 * HOUR));
    expect(tick(before, 2 * HOUR).character.mood).toBeCloseTo(before.character.mood);
  });
});

/** Two days into the second week, owing `debt` in rent debt on top of this week's rent, with `money` to pay it. */
const OWING_ON = DUE + 2;
function owing(debt: number, money = 5): GameState {
  return on(OWING_ON, 10 * HOUR, (s) => ({
    ...s,
    placeId: 'home',
    character: { ...s.character, moneyInShifts: money },
    rent: { ...s.rent, dueDay: DUE + WEEK },
    debts: debt > 0 ? [{ kind: 'rent', amountInShifts: debt }] : [],
  }));
}

describe('payRent: paying the landlord', () => {
  it('clears rent debt first, then this week’s rent', () => {
    const paid = payRent(owing(1.5), 2);
    if (paid.kind !== 'paid') throw new Error(paid.kind);
    expect(rentDebt(paid.state)).toBe(0);
    expect(paid.state.debts).toEqual([]);
    expect(paid.state.rent.owedInShifts).toBeCloseTo(weeklyRentAt('A1') - 0.5);
    expect(paid.state.character.moneyInShifts).toBeCloseTo(3);
  });

  it('takes part of the rent debt when that is all the Character pays', () => {
    const paid = payRent(owing(1.5), 1);
    if (paid.kind !== 'paid') throw new Error(paid.kind);
    expect(rentDebt(paid.state)).toBeCloseTo(0.5);
    expect(paid.state.rent.owedInShifts).toBeCloseTo(weeklyRentAt('A1'));
  });

  it('clears everything owed, so rent paid ahead never becomes debt', () => {
    const paid = payRent(owing(1.5), 1.5 + weeklyRentAt('A1'));
    if (paid.kind !== 'paid') throw new Error(paid.kind);
    expect(paid.state.debts).toEqual([]);
    expect(paid.state.rent.owedInShifts).toBe(0);
    expect(tick(fed({ ...paid.state, clock: { day: DUE + WEEK, minuteOfDay: 23 * HOUR } }), 2 * HOUR).debts).toEqual([]);
  });

  it('refuses more than is owed, and what the Character can’t afford, changing nothing', () => {
    expect(payRent(owing(1.5), 1.5 + weeklyRentAt('A1') + 0.5).kind).toBe('wrong_amount');
    expect(payRent(owing(1.5, 1), 1.5).kind).toBe('cannot_afford');
    expect(payRent(owing(0), 0).kind).toBe('wrong_amount');
  });
});

describe('grantExtension: more time from the landlord', () => {
  it('spares the Mood penalty for the extended days, then it comes back', () => {
    // Asked on the due day, for 2 days: the ends of the due day and the next cost nothing; the end of the day after does.
    const extended = grantExtension(fed(on(DUE, 10 * HOUR)), 2);
    const endOf = (state: GameState, day: number) => tick(fed({ ...state, clock: { day, minuteOfDay: 23 * HOUR } }), 2 * HOUR);

    const dueDay = endOf(extended, DUE);
    expect(rentDebt(dueDay)).toBeCloseTo(weeklyRentAt('A1'));
    expect(dueDay.character.mood).toBeCloseTo(extended.character.mood);
    const nextDay = endOf(dueDay, DUE + 1);
    expect(nextDay.character.mood).toBeCloseTo(extended.character.mood);
    expect(endOf(nextDay, DUE + 2).character.mood).toBeCloseTo(extended.character.mood + MOOD.debtPenaltyPerDay);
  });

  it('counts from today when the rent is already debt', () => {
    const inDebt = grantExtension(fed(owing(1)), 1);
    const endOfToday = tick(fed({ ...inDebt, clock: { day: OWING_ON, minuteOfDay: 23 * HOUR } }), 2 * HOUR);
    expect(endOfToday.character.mood).toBeCloseTo(inDebt.character.mood);
  });

  it('never shortens an extension already given', () => {
    const long = grantExtension(fed(on(DUE, 10 * HOUR)), 5);
    expect(grantExtension(long, 1).rent.extendedThroughDay).toBe(long.rent.extendedThroughDay);
  });
});

/** Recap evidence from a long conversation at `estimate`, enough to move the score. */
const evidence = (estimate: ProficiencyStep): ConversationEvidence => ({
  cefrEstimate: estimate,
  lines: Array.from({ length: 6 }, (_, i) => ({ speaker: i % 2 ? 'player' : 'npc', text: `line ${i}` }) as const),
  helpLog: [],
  notUnderstoodTurns: 0,
});

/** Feeds the same Recap estimate until the current step gets there. */
function reach(state: GameState, step: ProficiencyStep): GameState {
  let after = state;
  for (let i = 0; i < 100 && after.proficiencyStep !== step; i++) after = applyRecapEvidence(after, evidence(step));
  return after;
}

describe('the Newcomer Discount', () => {
  const nextWeek = (state: GameState) => tick(fed({ ...state, clock: { day: DUE, minuteOfDay: 23 * HOUR } }), 2 * HOUR).rent.owedInShifts;

  it('follows the highest step reached from the next week, whether or not the landlord has said so yet', () => {
    const atB1 = reach(createSave(TEST_SETUP), 'B1');
    expect(nextWeek(atB1)).toBeCloseTo(weeklyRentAt('B1'));
    expect(nextWeek(announceNewcomerDiscount(atB1))).toBeCloseTo(weeklyRentAt('B1'));
  });

  it('keeps this week’s rent as it was: the new rent starts with next week', () => {
    expect(reach(createSave(TEST_SETUP), 'B1').rent.owedInShifts).toBeCloseTo(weeklyRentAt('A1'));
  });

  it('never steps back up when the current step drops again', () => {
    const rusty = reach(reach(createSave(TEST_SETUP), 'B1'), 'A1');
    expect(rusty.proficiencyStep).toBe('A1');
    expect(nextWeek(rusty)).toBeCloseTo(weeklyRentAt('B1'));
  });

  it('has a step-down for the landlord to announce once, until announced', () => {
    const atB1 = reach(createSave(TEST_SETUP), 'B1');
    expect(newcomerDiscountStepDownDue(atB1)).toBe(true);
    expect(newcomerDiscountStepDownDue(announceNewcomerDiscount(atB1))).toBe(false);
    expect(newcomerDiscountStepDownDue(reach(announceNewcomerDiscount(atB1), 'A1'))).toBe(false);
  });

  it('has no step-down to announce between C1 and C2, where there is no discount left', () => {
    const atC1 = announceNewcomerDiscount({ ...createSave(TEST_SETUP), progression: { ...createSave(TEST_SETUP).progression, highestStep: 'C1' } });
    expect(newcomerDiscountStepDownDue({ ...atC1, progression: { ...atC1.progression, highestStep: 'C2' } })).toBe(false);
  });

  it('has no step-down to announce at the start', () => {
    expect(newcomerDiscountStepDownDue(createSave({ ...TEST_SETUP, startingStep: 'B2' }))).toBe(false);
  });
});

describe('rentStatement: what the landlord knows', () => {
  it('tells this week’s rent still to pay and when, the rent debt, and the weekly rent', () => {
    expect(rentStatement(owing(1.5))).toEqual({
      today: OWING_ON,
      dueDay: DUE + WEEK,
      owedThisWeekInShifts: weeklyRentAt('A1'),
      debtInShifts: 1.5,
      weeklyRentInShifts: weeklyRentAt('A1'),
    });
  });

  it('gives each new week’s rent at the highest step reached', () => {
    expect(rentStatement(reach(createSave(TEST_SETUP), 'B1')).weeklyRentInShifts).toBeCloseTo(weeklyRentAt('B1'));
  });
});

describe('payRent: money as the landlord reads it back', () => {
  it('takes an amount read back to the cent as what is owed', () => {
    // A cent off in a pack whose Shift is 60 units of money.
    const paid = payRent(owing(0), weeklyRentAt('A1') + 0.005 / 60);
    expect(paid.kind).toBe('paid');
  });
});
