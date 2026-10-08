import { describe, expect, it } from 'vitest';
import { chargeInShifts, INTERACTIONS, menuPrice } from '../content/index.ts';
import {
  applyInteractionOutcome,
  CLINIC,
  CLOCK,
  createSave,
  doctorCallDue,
  doctorCalled,
  ECONOMY,
  enterPlace,
  hospitalDebt,
  hospitalPaymentPlan,
  METER_MAX,
  sleep,
  tick,
  type GameState,
  type IllnessId,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const HOUR = 60;
const { checkIn, getMedicine, seeTheDoctor, settleHospitalBill } = INTERACTIONS;

/** A Character at the clinic's pharmacy in the afternoon, ill with `illnessId`, holding a prescription for `prescription`. */
function atThePharmacy(illnessId: IllnessId | null, prescription: GameState['clinic']['prescription']): GameState {
  const state = createSave(TEST_SETUP);
  return {
    ...state,
    clock: { day: 3, minuteOfDay: 14 * HOUR },
    placeId: 'clinic',
    character: { ...state.character, illness: illnessId && { illnessId, onsetDay: 3, treated: false } },
    clinic: { ...state.clinic, prescription },
  };
}

const dispense = (state: GameState, medicine: string) => applyInteractionOutcome(state, getMedicine, { kind: 'success', args: { medicine } });

describe('dispense', () => {
  it('cures the Illness at once when the medicine matches it, and charges for the medicine', () => {
    const state = atThePharmacy('cold', 'cold-medicine');

    const { state: after, result } = dispense(state, 'cold-medicine');

    expect(result.kind).toBe('success');
    expect(after.character.illness).toBeNull();
    expect(after.character.moneyInShifts).toBeCloseTo(state.character.moneyInShifts - menuPrice('cold-medicine', 'ja'));
    expect(after.clinic.prescription).toBeNull();
  });

  it('does not cure when the medicine is for another Illness, from a wrong diagnosis', () => {
    const state = atThePharmacy('hay-fever', 'cold-medicine');

    const { state: after, result } = dispense(state, 'cold-medicine');

    expect(result.kind).toBe('success');
    expect(after.character.illness).toEqual(state.character.illness);
    expect(after.clinic.prescription).toBeNull();
  });

  it('dispenses only what the doctor prescribed', () => {
    const state = atThePharmacy('cold', 'cold-medicine');

    const { state: after, result } = dispense(state, 'antihistamine');

    expect(result.kind).toBe('invalid_arguments');
    expect(after).toBe(state);
  });

  it('charges nothing and cures nothing when the Character cannot pay for it', () => {
    const ill = atThePharmacy('cold', 'cold-medicine');
    const state = { ...ill, character: { ...ill.character, moneyInShifts: 0 } };

    const { state: after, result } = dispense(state, 'cold-medicine');

    expect(result.kind).toBe('cannot_afford');
    expect(after).toBe(state);
  });
});

describe('diagnose', () => {
  const fee = chargeInShifts(ECONOMY.consultationFeeInShifts, 'ja');
  /** A Character with hay fever, and `money` if given, sees the doctor, who names `illness`. */
  const diagnosing = (illness: IllnessId, money?: number) => {
    const ill = atThePharmacy('hay-fever', null);
    const before = money === undefined ? ill : { ...ill, character: { ...ill.character, moneyInShifts: money } };
    return { before, ...applyInteractionOutcome(before, seeTheDoctor, { kind: 'success', args: { illness } }) };
  };

  it('records the prescription for the Illness the doctor named, whatever the Character really has, and charges the visit', () => {
    const { before, state, result } = diagnosing('cold');

    expect(result.kind).toBe('success');
    expect(state.clinic.prescription).toBe('cold-medicine');
    expect(state.character.illness).toEqual(before.character.illness);
    expect(state.character.moneyInShifts).toBeCloseTo(before.character.moneyInShifts - fee);
  });

  it('owes the visit to the hospital when the Character cannot pay for it', () => {
    const { state } = diagnosing('hay-fever', 0);

    expect(state.clinic.prescription).toBe('antihistamine');
    expect(hospitalDebt(state)).toBeCloseTo(fee);
  });
});

describe('checking in at reception', () => {
  const checkedIn = () => {
    const state = atThePharmacy('cold', null);
    return applyInteractionOutcome(state, checkIn, { kind: 'success', args: { reason: 'a cough' } }).state;
  };

  it('the doctor calls the Character once they have waited at the clinic, and only once', () => {
    const waiting = checkedIn();
    const almost = tick(waiting, CLINIC.waitForDoctorGameMinutes - 1);
    const called = tick(almost, 2);

    expect(doctorCallDue(waiting, almost)).toBe(false);
    expect(doctorCallDue(almost, called)).toBe(true);
    expect(doctorCallDue(called, tick(called, 5))).toBe(false);
  });

  it('the doctor never calls a Character who has left the clinic: their place is given up', () => {
    const left = enterPlace(checkedIn(), 'park', null);

    expect(left.clinic.checkedInAt).toBeNull();
    expect(doctorCallDue(left, tick(left, 2 * CLINIC.waitForDoctorGameMinutes))).toBe(false);
  });

  it('once the doctor has called them, they are no longer waiting', () => {
    expect(doctorCalled(checkedIn()).clinic.checkedInAt).toBeNull();
  });
});

describe('settling the hospital bill at reception', () => {
  const OWED = ECONOMY.faintingBillInShifts;

  /** A Character at reception on day 3, owing the hospital `OWED`, with `money`. Rent falls due at the end of day 7. */
  function owingTheHospital(money: number): GameState {
    const state = atThePharmacy(null, null);
    return { ...state, character: { ...state.character, moneyInShifts: money }, debts: [{ kind: 'hospital', amountInShifts: OWED }] };
  }
  const settle = (state: GameState, weeks: number) => applyInteractionOutcome(state, settleHospitalBill, { kind: 'success', args: { weeks } });
  /** Skips to a minute before midnight at the end of `day`, well fed (so no Fainting), and ticks past midnight. */
  const pastEndOf = (state: GameState, day: number) =>
    tick(
      {
        ...state,
        clock: { day, minuteOfDay: CLOCK.minutesPerDay - 1 },
        character: { ...state.character, health: METER_MAX, hunger: METER_MAX, thirst: METER_MAX },
      },
      2,
    );

  it('in full: 0 weeks pays it all now, and nothing is owed', () => {
    const state = owingTheHospital(2);

    const { state: after, result } = settle(state, 0);

    expect(result).toMatchObject({ kind: 'success', paidInShifts: OWED });
    expect(after.character.moneyInShifts).toBeCloseTo(2 - OWED);
    expect(hospitalDebt(after)).toBe(0);
  });

  it('in full is refused when the Character has not got it all', () => {
    const state = owingTheHospital(1);

    expect(settle(state, 0).result.kind).toBe('cannot_afford');
  });

  it('is refused when nothing is owed', () => {
    const state = { ...owingTheHospital(2), debts: [] };

    expect(settle(state, 0).result.kind).toBe('invalid_arguments');
  });

  it('as a plan, charges nothing now and takes each weekly instalment automatically on rent day', () => {
    const { state: planned } = settle(owingTheHospital(1), 3);
    expect(planned.character.moneyInShifts).toBe(1);

    const firstRentDay = pastEndOf(planned, planned.rent.dueDay);
    expect(hospitalDebt(firstRentDay)).toBeCloseTo((2 * OWED) / 3);
    expect(firstRentDay.character.moneyInShifts).toBeCloseTo(1 - OWED / 3);

    const dayBefore = pastEndOf(firstRentDay, planned.rent.dueDay + ECONOMY.rentPeriodDays - 1);
    expect(hospitalDebt(dayBefore)).toBeCloseTo((2 * OWED) / 3);
  });

  it('pays off the debt over the weeks, and then the plan ends', () => {
    const { state: planned } = settle(owingTheHospital(5), 2);

    const paidOff = pastEndOf(pastEndOf(planned, planned.rent.dueDay), planned.rent.dueDay + ECONOMY.rentPeriodDays);

    expect(hospitalDebt(paidOff)).toBe(0);
    expect(paidOff.character.moneyInShifts).toBeCloseTo(5 - OWED);
    expect(hospitalPaymentPlan(paidOff)).toBeNull();
  });

  it('a missed instalment stays as debt, and the plan carries on the next rent day', () => {
    const { state: planned } = settle(owingTheHospital(0), 2);

    const missed = pastEndOf(planned, planned.rent.dueDay);
    expect(hospitalDebt(missed)).toBeCloseTo(OWED);
    expect(hospitalPaymentPlan(missed)?.nextDueDay).toBe(planned.rent.dueDay + ECONOMY.rentPeriodDays);

    const paid = pastEndOf({ ...missed, character: { ...missed.character, moneyInShifts: 1 } }, planned.rent.dueDay + ECONOMY.rentPeriodDays);
    expect(hospitalDebt(paid)).toBeCloseTo(OWED / 2);
  });
});

describe('the fever reducer and flu', () => {
  const treated = () => dispense(atThePharmacy('flu', 'fever-reducer'), 'fever-reducer').state;

  it("stops flu's Health drain at once, but the Character is still ill", () => {
    const untreated = atThePharmacy('flu', 'fever-reducer');
    const afterAnHour = (state: GameState) => tick(state, HOUR).character.health;

    expect(afterAnHour(untreated)).toBeLessThan(untreated.character.health);
    expect(afterAnHour(treated())).toBe(treated().character.health);
    expect(treated().character.illness?.illnessId).toBe('flu');
  });

  it('clears the flu after the next sleep', () => {
    const atBedtime: GameState = { ...treated(), placeId: 'home', clock: { day: 3, minuteOfDay: 22 * HOUR } };

    const slept = sleep(atBedtime);

    expect(slept.clock).toEqual({ day: 4, minuteOfDay: CLOCK.wakeAt });
    expect(slept.character.illness?.illnessId).not.toBe('flu');
  });

  it('leaves an untreated flu after a sleep', () => {
    const atBedtime: GameState = { ...atThePharmacy('flu', null), placeId: 'home', clock: { day: 3, minuteOfDay: 22 * HOUR } };

    expect(sleep(atBedtime).character.illness?.illnessId).toBe('flu');
  });
});
