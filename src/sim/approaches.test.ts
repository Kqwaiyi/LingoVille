import { describe, expect, it } from 'vitest';
import { approachDue, createSave, faint, tick, type GameState } from './index.ts';
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
