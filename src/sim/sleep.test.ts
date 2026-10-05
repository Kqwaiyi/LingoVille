import { describe, expect, it } from 'vitest';
import { bedUsable, CLOCK, createSave, METER_MAX, MOOD, sleep, type GameState } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const HOUR = 60;

function atHome(day: number, minuteOfDay: number, character: Partial<GameState['character']> = {}): GameState {
  const state = createSave(TEST_SETUP);
  return { ...state, clock: { day, minuteOfDay }, character: { ...state.character, mood: MOOD.neutral, ...character } };
}

describe('sleep: when the bed can be used', () => {
  it('is too early before 20:00', () => {
    const state = atHome(2, CLOCK.bedUsableFrom - 1);
    expect(sleep(state)).toBe(state);
    expect(bedUsable(state.clock)).toBe(false);
  });

  it('allows no naps in the day', () => {
    for (const minute of [CLOCK.wakeAt, 12 * HOUR, 15 * HOUR + 30]) {
      const state = atHome(2, minute);
      expect(sleep(state)).toBe(state);
    }
  });

  it('is usable from 20:00 through the night', () => {
    for (const minute of [CLOCK.bedUsableFrom, 23 * HOUR + 59, 0, CLOCK.lateNightFrom + HOUR]) {
      expect(bedUsable({ day: 2, minuteOfDay: minute })).toBe(true);
    }
  });

  it('is only at home', () => {
    const state = { ...atHome(2, 21 * HOUR), placeId: 'cafe' as const };
    expect(sleep(state)).toBe(state);
  });
});

describe('sleep: waking up', () => {
  it('wakes at 07:00 the next morning', () => {
    expect(sleep(atHome(2, CLOCK.bedUsableFrom)).clock).toEqual({ day: 3, minuteOfDay: CLOCK.wakeAt });
    expect(sleep(atHome(2, 23 * HOUR + 30)).clock).toEqual({ day: 3, minuteOfDay: CLOCK.wakeAt });
  });

  it('still wakes at 07:00 after a bedtime past midnight', () => {
    expect(sleep(atHome(3, HOUR + 30)).clock).toEqual({ day: 3, minuteOfDay: CLOCK.wakeAt });
    expect(sleep(atHome(3, CLOCK.lateNightFrom + 2 * HOUR)).clock).toEqual({ day: 3, minuteOfDay: CLOCK.wakeAt });
  });

  it('gives a small Mood boost', () => {
    expect(sleep(atHome(2, 21 * HOUR)).character.mood).toBe(MOOD.neutral + MOOD.changes.sleep);
    expect(MOOD.changes.sleep).toBeGreaterThan(0);
  });

  it('never takes Mood above full', () => {
    expect(sleep(atHome(2, 21 * HOUR, { mood: METER_MAX - 1 })).character.mood).toBe(METER_MAX);
  });

  it('pauses decay: Hunger, Thirst and Health are as they were at bedtime', () => {
    const state = atHome(2, 21 * HOUR, { hunger: 0, thirst: 5, health: 40 });
    const { hunger, thirst, health } = sleep(state).character;
    expect({ hunger, thirst, health }).toEqual({ hunger: 0, thirst: 5, health: 40 });
  });

  it('spares a late bedtime the late-night Mood drain for the hours asleep', () => {
    expect(sleep(atHome(3, CLOCK.lateNightFrom)).character.mood).toBe(MOOD.neutral + MOOD.changes.sleep);
  });
});
