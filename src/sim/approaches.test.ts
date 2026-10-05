import { describe, expect, it } from 'vitest';
import {
  approachDue,
  createSave,
  faint,
  hallwayApproach,
  hallwayApproachMade,
  payRent,
  tick,
  type GameState,
  type OpeningHours,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const HOUR = 60;

function inTown(character: Partial<GameState['character']> = {}): GameState {
  const state = createSave(TEST_SETUP);
  return { ...state, placeId: 'park', clock: { day: 3, minuteOfDay: 15 * HOUR }, character: { ...state.character, ...character } };
}

describe('approachDue: NPCs who start conversations themselves', () => {
  it('sends the nurse when the Character wakes from Fainting', () => {
    const before = inTown({ health: 0, hunger: 0, thirst: 0 });
    expect(approachDue(before, faint(before))).toBe('nurseOnWaking');
    expect(approachDue(before, tick(before, 1))).toBe('nurseOnWaking');
  });

  it('sends no one when nothing has happened to approach about', () => {
    const before = inTown();
    expect(approachDue(before, tick(before, HOUR))).toBeNull();
    expect(approachDue(before, before)).toBeNull();
  });

  it('sends the nurse only once per Fainting', () => {
    const fainted = faint(inTown({ health: 0, hunger: 0, thirst: 0 }));
    expect(approachDue(fainted, tick(fainted, HOUR))).toBeNull();
  });
});

describe('approachDue: Fainting twice on one day number', () => {
  it('sends the nurse again when the Character faints again the day they woke in the ward', () => {
    // Fainted past midnight, so woke at 08:00 on the same day number; then fainted again that afternoon.
    const woke = faint({ ...inTown({ health: 0, hunger: 0, thirst: 0 }), clock: { day: 3, minuteOfDay: 30 } });
    const again = { ...woke, clock: { day: 3, minuteOfDay: 15 * HOUR }, character: { ...woke.character, health: 0 } };

    expect(approachDue(again, faint(again))).toBe('nurseOnWaking');
  });
});

const LANDLORD_HOURS: OpeningHours = { opensAt: 8 * HOUR, closesAt: 20 * HOUR, closedOn: [] };

/** At home on `day` at `minuteOfDay`, with this week's rent unpaid. */
function atHome(day: number, minuteOfDay: number, change: (state: GameState) => GameState = (s) => s): GameState {
  return change({ ...createSave(TEST_SETUP), clock: { day, minuteOfDay } });
}

const inRentDebt = (state: GameState): GameState => ({ ...state, debts: [{ kind: 'rent', amountInShifts: 1 }] });
const reachedB1 = (state: GameState): GameState => ({ ...state, progression: { ...state.progression, highestStep: 'B1' } });

describe('hallwayApproach: the landlord catching the Character on the way out', () => {
  it('reminds the Character on the day rent is due, while it is unpaid', () => {
    expect(hallwayApproach(atHome(7, 9 * HOUR), LANDLORD_HOURS)).toBe('landlordRentDue');
  });

  it('reminds the Character while rent is owed as debt', () => {
    expect(hallwayApproach(atHome(9, 9 * HOUR, inRentDebt), LANDLORD_HOURS)).toBe('landlordRentDue');
  });

  it('says nothing before the due day, or once the rent is paid', () => {
    expect(hallwayApproach(atHome(5, 9 * HOUR), LANDLORD_HOURS)).toBeNull();
    const paid = payRent({ ...atHome(7, 9 * HOUR), character: { ...atHome(7, 9 * HOUR).character, moneyInShifts: 5 } }, 1);
    if (paid.kind !== 'paid') throw new Error(paid.kind);
    expect(hallwayApproach(paid.state, LANDLORD_HOURS)).toBeNull();
  });

  it('is only there 8:00–20:00', () => {
    expect(hallwayApproach(atHome(7, 7 * HOUR + 30), LANDLORD_HOURS)).toBeNull();
    expect(hallwayApproach(atHome(7, 20 * HOUR), LANDLORD_HOURS)).toBeNull();
    expect(hallwayApproach(atHome(7, 8 * HOUR), LANDLORD_HOURS)).toBe('landlordRentDue');
  });

  it('is only in the hallway at home', () => {
    expect(hallwayApproach(atHome(7, 9 * HOUR, (s) => ({ ...s, placeId: 'park' })), LANDLORD_HOURS)).toBeNull();
  });

  it('reminds about rent once a day at most', () => {
    const reminded = hallwayApproachMade(atHome(9, 9 * HOUR, inRentDebt), 'landlordRentDue');
    expect(hallwayApproach(reminded, LANDLORD_HOURS)).toBeNull();
    expect(hallwayApproach({ ...reminded, clock: { day: 10, minuteOfDay: 9 * HOUR } }, LANDLORD_HOURS)).toBe('landlordRentDue');
  });

  it('leaves the Character be while they have more time', () => {
    const extended = atHome(9, 9 * HOUR, (s) => inRentDebt({ ...s, rent: { ...s.rent, extendedThroughDay: 10 } }));
    expect(hallwayApproach(extended, LANDLORD_HOURS)).toBeNull();
    expect(hallwayApproach({ ...extended, clock: { day: 11, minuteOfDay: 9 * HOUR } }, LANDLORD_HOURS)).toBe('landlordRentDue');
  });

  it('announces a Newcomer Discount step-down, once', () => {
    const due = atHome(3, 9 * HOUR, reachedB1);
    expect(hallwayApproach(due, LANDLORD_HOURS)).toBe('landlordDiscountStepDown');
    expect(hallwayApproach(hallwayApproachMade(due, 'landlordDiscountStepDown'), LANDLORD_HOURS)).toBeNull();
  });

  it('reminds about rent first, and announces the step-down the next time', () => {
    const both = atHome(7, 9 * HOUR, reachedB1);
    expect(hallwayApproach(both, LANDLORD_HOURS)).toBe('landlordRentDue');
    expect(hallwayApproach(hallwayApproachMade(both, 'landlordRentDue'), LANDLORD_HOURS)).toBe('landlordDiscountStepDown');
  });
});
