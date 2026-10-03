import { describe, expect, it } from 'vitest';
import { createSave, METER_MAX, tick, WELL_BEING, type GameState } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const HOUR = 60;

function withCharacter(character: Partial<GameState['character']>): GameState {
  const state = createSave(TEST_SETUP);
  return { ...state, character: { ...state.character, ...character } };
}

describe('tick: the clock', () => {
  it('advances the minute of day', () => {
    const state = withCharacter({});
    expect(tick(state, 30).clock.minuteOfDay).toBe(state.clock.minuteOfDay + 30);
  });

  it('rolls over to the next day at midnight', () => {
    const state = { ...withCharacter({}), clock: { day: 3, minuteOfDay: 23 * HOUR + 30 } };
    expect(tick(state, HOUR).clock).toEqual({ day: 4, minuteOfDay: 30 });
  });

  it('does nothing for zero time', () => {
    const state = withCharacter({});
    expect(tick(state, 0)).toEqual(state);
  });
});

describe('tick: Hunger and Thirst', () => {
  it('empties a full Hunger over hungerFullToEmptyGameMinutes', () => {
    const state = withCharacter({ hunger: METER_MAX });
    expect(tick(state, WELL_BEING.hungerFullToEmptyGameMinutes / 2).character.hunger).toBeCloseTo(METER_MAX / 2);
    expect(tick(state, WELL_BEING.hungerFullToEmptyGameMinutes).character.hunger).toBe(0);
  });

  it('empties a full Thirst over thirstFullToEmptyGameMinutes', () => {
    const state = withCharacter({ thirst: METER_MAX });
    expect(tick(state, WELL_BEING.thirstFullToEmptyGameMinutes / 2).character.thirst).toBeCloseTo(METER_MAX / 2);
    expect(tick(state, WELL_BEING.thirstFullToEmptyGameMinutes).character.thirst).toBe(0);
  });

  it('never takes Hunger or Thirst below 0', () => {
    const state = withCharacter({ hunger: 1, thirst: 1 });
    const after = tick(state, WELL_BEING.hungerFullToEmptyGameMinutes);
    expect(after.character.hunger).toBe(0);
    expect(after.character.thirst).toBe(0);
  });
});

describe('tick: Health', () => {
  it('does not fall while Hunger and Thirst stay above 0', () => {
    const state = withCharacter({ health: METER_MAX / 2, hunger: METER_MAX, thirst: METER_MAX });
    expect(tick(state, HOUR).character.health).toBe(METER_MAX / 2);
  });

  it('falls while Hunger is at 0', () => {
    const state = withCharacter({ health: METER_MAX, hunger: 0, thirst: METER_MAX });
    const minutes = WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes / 4;
    expect(tick(state, minutes).character.health).toBeCloseTo(METER_MAX * 0.75);
  });

  it('falls while Thirst is at 0', () => {
    const state = withCharacter({ health: METER_MAX, hunger: METER_MAX, thirst: 0 });
    const minutes = WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes / 4;
    expect(tick(state, minutes).character.health).toBeCloseTo(METER_MAX * 0.75);
  });

  it('starts falling only from the moment a meter hits 0 within one tick', () => {
    // Thirst empties after one hour, so only the second hour drains Health.
    const oneHourOfThirst = METER_MAX * (HOUR / WELL_BEING.thirstFullToEmptyGameMinutes);
    const oneHourOfHealth = METER_MAX * (HOUR / WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes);
    const state = withCharacter({ health: METER_MAX, hunger: METER_MAX, thirst: oneHourOfThirst });
    expect(tick(state, 2 * HOUR).character.health).toBeCloseTo(METER_MAX - oneHourOfHealth);
  });

  it('gives the same result for one long tick as for many short ones', () => {
    const state = withCharacter({ health: METER_MAX, hunger: 10, thirst: 5 });
    let stepped = state;
    for (let i = 0; i < 600; i++) stepped = tick(stepped, 1);
    const once = tick(state, 600);
    expect(stepped.character.health).toBeCloseTo(once.character.health);
    expect(stepped.character.hunger).toBeCloseTo(once.character.hunger);
    expect(stepped.character.thirst).toBeCloseTo(once.character.thirst);
  });

  it('never falls below 0', () => {
    const state = withCharacter({ health: 1, hunger: 0, thirst: 0 });
    expect(tick(state, WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes).character.health).toBe(0);
  });
});
