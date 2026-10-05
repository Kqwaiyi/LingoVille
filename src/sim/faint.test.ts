import { describe, expect, it } from 'vitest';
import { CLOCK, createSave, ECONOMY, faint, METER_MAX, MOOD, tick, WELL_BEING, type GameState } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const HOUR = 60;

function collapsing(clock: GameState['clock'], character: Partial<GameState['character']> = {}): GameState {
  const state = createSave(TEST_SETUP);
  return { ...state, placeId: 'park', clock, character: { ...state.character, health: 0, hunger: 0, thirst: 0, ...character } };
}

describe('faint: waking in hospital', () => {
  it('wakes at 08:00 the next day, in the hospital, losing the rest of the day', () => {
    const after = faint(collapsing({ day: 4, minuteOfDay: 15 * HOUR }));
    expect(after.clock).toEqual({ day: 5, minuteOfDay: CLOCK.faintWakeAt });
    expect(after.placeId).toBe('clinic');
  });

  it('wakes at 08:00 on the same day number after fainting past midnight, as sleep does after a late bedtime', () => {
    expect(faint(collapsing({ day: 5, minuteOfDay: 30 })).clock).toEqual({ day: 5, minuteOfDay: CLOCK.faintWakeAt });
  });

  it('loses the rest of the day for a faint once the night is over, even before 08:00', () => {
    expect(faint(collapsing({ day: 5, minuteOfDay: CLOCK.wakeAt + 3 })).clock).toEqual({ day: 6, minuteOfDay: CLOCK.faintWakeAt });
  });
});

describe('tick: Health at 0 always leads to faint', () => {
  const deprivedHealthPerMinute = METER_MAX / WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes;

  it('faints the moment Health runs out, and the rest of the tick is lost', () => {
    // Health runs out at 23:30 on day 4; the tick runs on past midnight.
    const health = deprivedHealthPerMinute * 1.5 * HOUR;
    const after = tick(collapsing({ day: 4, minuteOfDay: 22 * HOUR }, { health }), 3 * HOUR);
    expect(after.clock).toEqual({ day: 5, minuteOfDay: CLOCK.faintWakeAt });
    expect(after.placeId).toBe('clinic');
    expect(after.wokeInWardOnDay).toBe(5);
  });

  it('faints at once when Health is already at 0', () => {
    const after = tick(collapsing({ day: 4, minuteOfDay: 15 * HOUR }), 0.01);
    expect(after.clock).toEqual({ day: 5, minuteOfDay: CLOCK.faintWakeAt });
  });

  it('never leaves the Character at Health 0, however long or short the tick', () => {
    for (const dt of [0.01, 1, 30, HOUR, 12 * HOUR, 3 * 24 * HOUR]) {
      for (const health of [0, 1, 50, METER_MAX]) {
        const after = tick(collapsing({ day: 2, minuteOfDay: 9 * HOUR }, { health }), dt);
        expect(after.character.health).toBeGreaterThan(0);
      }
    }
  });

  it('leaves a Character with Health to spare as they were', () => {
    const after = tick(collapsing({ day: 2, minuteOfDay: 9 * HOUR }, { health: METER_MAX }), HOUR);
    expect(after.placeId).toBe('park');
    expect(after.wokeInWardOnDay).toBeNull();
  });
});

describe('faint: the Character afterwards', () => {
  it('takes a Mood hit', () => {
    const after = faint(collapsing({ day: 4, minuteOfDay: 15 * HOUR }, { mood: MOOD.neutral }));
    expect(after.character.mood).toBe(MOOD.neutral + MOOD.changes.fainting);
    expect(MOOD.changes.fainting).toBeLessThan(0);
  });

  it('never takes Mood below 0', () => {
    expect(faint(collapsing({ day: 4, minuteOfDay: 15 * HOUR }, { mood: 1 })).character.mood).toBe(0);
  });

  it('comes round with the ward’s care: Health, Hunger and Thirst back above 0', () => {
    const { health, hunger, thirst } = faint(collapsing({ day: 4, minuteOfDay: 15 * HOUR })).character;
    expect({ health, hunger, thirst }).toEqual(WELL_BEING.afterFainting);
    expect(Math.min(health, hunger, thirst)).toBeGreaterThan(0);
  });
});

describe('faint: the hospital bill', () => {
  it('is paid from the Character’s money when there is enough', () => {
    const after = faint(collapsing({ day: 4, minuteOfDay: 15 * HOUR }, { moneyInShifts: ECONOMY.faintingBillInShifts + 0.5 }));
    expect(after.character.moneyInShifts).toBeCloseTo(0.5);
    expect(after.debts).toEqual([]);
  });

  it('becomes hospital debt when the Character can’t pay it, leaving their money for food', () => {
    const after = faint(collapsing({ day: 4, minuteOfDay: 15 * HOUR }, { moneyInShifts: ECONOMY.faintingBillInShifts - 0.5 }));
    expect(after.character.moneyInShifts).toBe(ECONOMY.faintingBillInShifts - 0.5);
    expect(after.debts).toEqual([{ kind: 'hospital', amountInShifts: ECONOMY.faintingBillInShifts }]);
  });

  it('adds to hospital debt already owed, and carries other debts forward', () => {
    const state = {
      ...collapsing({ day: 4, minuteOfDay: 15 * HOUR }, { moneyInShifts: 0 }),
      debts: [
        { kind: 'rent' as const, amountInShifts: 2 },
        { kind: 'hospital' as const, amountInShifts: 0.5 },
      ],
    };
    expect(faint(state).debts).toEqual([
      { kind: 'rent', amountInShifts: 2 },
      { kind: 'hospital', amountInShifts: 0.5 + ECONOMY.faintingBillInShifts },
    ]);
  });
});
