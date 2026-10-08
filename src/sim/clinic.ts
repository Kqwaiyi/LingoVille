import type { Diagnosis, Treatment } from '../content/index.ts';
import { addDebt } from './debts.ts';
import type { GameState, PaymentPlan } from './state.ts';
import { CLINIC, CLOCK, ECONOMY } from './tuning.ts';

/** An amount this close to nothing, in Shifts, is nothing: instalments go through floating point. */
const NOTHING = 1e-6;

/** What the Character owes the hospital: unpaid Fainting bills and doctor's visits. */
export function hospitalDebt(state: GameState): number {
  return state.debts.find((debt) => debt.kind === 'hospital')?.amountInShifts ?? 0;
}

/** The plan the hospital debt is being paid off on, or null if there's none. */
export function hospitalPaymentPlan(state: GameState): PaymentPlan | null {
  return state.paymentPlans.find((plan) => plan.debtKind === 'hospital') ?? null;
}

/** What reception knows about the Character's hospital bill. Never the Character's money: the sim checks what they can afford. */
export type HospitalStatement = {
  today: number;
  owedInShifts: number;
  /** The weekly instalment of a plan already running, or null. */
  instalmentInShifts: number | null;
  /** Rent day, when a new plan takes its first instalment. */
  rentDueDay: number;
};

/** What reception is told about the Character's hospital bill now. */
export function hospitalStatement(state: GameState): HospitalStatement {
  return {
    today: state.clock.day,
    owedInShifts: hospitalDebt(state),
    instalmentInShifts: hospitalPaymentPlan(state)?.instalmentInShifts ?? null,
    rentDueDay: state.rent.dueDay,
  };
}

/** The Character checks in at reception, to wait for the doctor to call their name. Checking in again starts the wait again. */
export function checkIn(state: GameState): GameState {
  const { day, minuteOfDay } = state.clock;
  return { ...state, clinic: { ...state.clinic, checkedInAt: { day, minuteOfDay } } };
}

/** Game minutes the Character has waited since checking in, or null if they aren't waiting. */
function minutesWaited(state: GameState): number | null {
  const at = state.clinic.checkedInAt;
  if (!at) return null;
  return (state.clock.day - at.day) * CLOCK.minutesPerDay + state.clock.minuteOfDay - at.minuteOfDay;
}

/** The Character has waited long enough at the clinic between these two states: the doctor calls their name. */
export function doctorCallDue(before: GameState, after: GameState): boolean {
  const waited = minutesWaited(after);
  if (waited === null || after.placeId !== 'clinic' || waited < CLINIC.waitForDoctorGameMinutes) return false;
  const waitedBefore = minutesWaited(before);
  return waitedBefore === null || waitedBefore < CLINIC.waitForDoctorGameMinutes;
}

/** The doctor has called the Character in: they are no longer waiting. */
export function doctorCalled(state: GameState): GameState {
  return { ...state, clinic: { ...state.clinic, checkedInAt: null } };
}

/**
 * Leaving the clinic gives up the Character's place in the queue. A prescription is kept: it can be collected later.
 * Nothing changes while they stay.
 */
export function leaveClinic(state: GameState): GameState {
  if (state.placeId !== 'clinic' || !state.clinic.checkedInAt) return state;
  return doctorCalled(state);
}

/**
 * The doctor's diagnosis: the prescription it calls for is recorded, replacing any other, and the visit is charged,
 * from the Character's money if they have enough, otherwise all of it as hospital debt.
 */
export function diagnose(state: GameState, { prescription, feeInShifts }: Diagnosis): GameState {
  const { character } = state;
  const canPay = character.moneyInShifts >= feeInShifts;
  return {
    ...state,
    clinic: { ...state.clinic, prescription },
    character: canPay ? { ...character, moneyInShifts: character.moneyInShifts - feeInShifts } : character,
    debts: canPay ? state.debts : addDebt(state.debts, { kind: 'hospital', amountInShifts: feeInShifts }),
  };
}

/** How dispensing went: the medicine handed over, not what was prescribed, or not affordable. */
export type Dispensing = { kind: 'dispensed'; state: GameState } | { kind: 'not_prescribed' } | { kind: 'cannot_afford' };

/**
 * The pharmacist hands over the prescribed medicine for `priceInShifts`, using up the prescription. The right medicine
 * cures its Illness at once, except flu: the fever reducer only stops its Health drain, and it clears after the next sleep.
 * Medicine for another Illness cures nothing. Only what the doctor prescribed is dispensed, and only if it can be paid for.
 */
export function dispense(state: GameState, { medicineId, cures }: Treatment, priceInShifts: number): Dispensing {
  if (state.clinic.prescription !== medicineId) return { kind: 'not_prescribed' };
  const { character } = state;
  if (priceInShifts > character.moneyInShifts) return { kind: 'cannot_afford' };
  const { illness } = character;
  const matches = illness?.illnessId === cures;
  const treated = !matches ? illness : cures === 'flu' ? { ...illness, treated: true } : null;
  return {
    kind: 'dispensed',
    state: {
      ...state,
      clinic: { ...state.clinic, prescription: null },
      character: { ...character, moneyInShifts: character.moneyInShifts - priceInShifts, illness: treated },
    },
  };
}

/** A flu the fever reducer has treated clears with a night's sleep. */
export function sleepOffTreatedFlu(state: GameState): GameState {
  const { illness } = state.character;
  if (!illness?.treated) return state;
  return { ...state, character: { ...state.character, illness: null } };
}

/** How settling the hospital bill went: settled (with what was paid now), nothing owed, or not affordable in full. */
export type HospitalSettlement = { kind: 'settled'; state: GameState; paidInShifts: number } | { kind: 'nothing_owed' } | { kind: 'cannot_afford' };

/**
 * Settles hospital debt at reception. With 0 weeks it is paid in full now, if the Character has enough, and any plan ends.
 * Otherwise it is spread over that many weekly instalments, the first taken on the next rent day, replacing any plan.
 */
export function settleHospitalBill(state: GameState, weeks: number): HospitalSettlement {
  const owed = hospitalDebt(state);
  if (owed <= NOTHING) return { kind: 'nothing_owed' };
  const otherPlans = state.paymentPlans.filter((plan) => plan.debtKind !== 'hospital');
  if (weeks === 0) {
    if (owed > state.character.moneyInShifts) return { kind: 'cannot_afford' };
    return {
      kind: 'settled',
      paidInShifts: owed,
      state: {
        ...state,
        character: { ...state.character, moneyInShifts: state.character.moneyInShifts - owed },
        debts: state.debts.filter((debt) => debt.kind !== 'hospital'),
        paymentPlans: otherPlans,
      },
    };
  }
  const plan: PaymentPlan = { debtKind: 'hospital', instalmentInShifts: owed / weeks, nextDueDay: state.rent.dueDay };
  return { kind: 'settled', paidInShifts: 0, state: { ...state, paymentPlans: [...otherPlans, plan] } };
}

/**
 * The end of `day`. A payment plan due today takes its instalment from the Character's money, never more than is
 * still owed, and is due again a rent period later. One the Character can't afford is missed: the instalment stays
 * as debt, to be taken in a later week. A plan ends once its debt is paid off.
 */
export function takeInstalments(state: GameState, day: number): GameState {
  let after = state;
  for (const plan of state.paymentPlans) {
    if (plan.nextDueDay !== day) continue;
    const owed = after.debts.find((debt) => debt.kind === plan.debtKind)?.amountInShifts ?? 0;
    const instalment = Math.min(plan.instalmentInShifts, owed);
    const { character } = after;
    const paid = instalment <= character.moneyInShifts;
    const left = paid ? owed - instalment : owed;
    const debts = after.debts.flatMap((debt) =>
      debt.kind !== plan.debtKind ? [debt] : left > NOTHING ? [{ ...debt, amountInShifts: left }] : [],
    );
    const plans = after.paymentPlans.flatMap((p) =>
      p !== plan ? [p] : left > NOTHING ? [{ ...p, nextDueDay: p.nextDueDay + ECONOMY.rentPeriodDays }] : [],
    );
    after = {
      ...after,
      debts,
      paymentPlans: plans,
      character: paid ? { ...character, moneyInShifts: character.moneyInShifts - instalment } : character,
    };
  }
  return after;
}
