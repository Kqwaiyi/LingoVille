import { describe, expect, it } from 'vitest';
import { createSave, faintedBetween, ILLNESS, ILLNESS_IDS, LIFE_SKILLS, METER_MAX, tick, WELL_BEING, type GameState } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const HOUR = 60;
const SEEDS = 4000;

/** A Character at 23:00, with their needs met unless the test says otherwise. */
function lateEvening(seed: number, character: Partial<GameState['character']> = {}, fitnessXp = 0): GameState {
  const state = createSave({ ...TEST_SETUP, rngSeed: seed });
  return {
    ...state,
    clock: { day: 3, minuteOfDay: 23 * HOUR },
    character: { ...state.character, health: METER_MAX, hunger: METER_MAX, thirst: METER_MAX, ...character },
    progression: { ...state.progression, lifeSkillXp: { ...state.progression.lifeSkillXp, fitness: fitnessXp } },
  };
}

/** Ticks across midnight, when the day's Illness roll is made. */
const pastMidnight = (state: GameState) => tick(state, 2 * HOUR);

/** The share of many seeded Characters who fall ill overnight. */
function shareFallingIll(character: Partial<GameState['character']> = {}, fitnessXp = 0): number {
  let ill = 0;
  for (let seed = 0; seed < SEEDS; seed++) if (pastMidnight(lateEvening(seed, character, fitnessXp)).character.illness) ill++;
  return ill / SEEDS;
}

describe('Illness onset', () => {
  it('comes about once every 1–2 weeks to a well, unfit Character', () => {
    const daily = shareFallingIll();
    expect(daily).toBeGreaterThan(1 / 14);
    expect(daily).toBeLessThan(1 / 7);
  });

  it('is more likely when Well-being is low', () => {
    const low = { health: 0.1 * METER_MAX, hunger: 0.2 * METER_MAX, thirst: 0.3 * METER_MAX };
    expect(shareFallingIll(low)).toBeGreaterThan(1.3 * shareFallingIll());
  });

  it('is less likely with Fitness', () => {
    const maxFitness = LIFE_SKILLS.xpToReachLevel[LIFE_SKILLS.maxLevel]!;
    expect(shareFallingIll({}, maxFitness)).toBeLessThan(0.8 * shareFallingIll());
  });

  it('can be any of the 4 Illnesses, starting on the new day', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const { illness } = pastMidnight(lateEvening(seed)).character;
      if (!illness) continue;
      seen.add(illness.illnessId);
      expect(illness.onsetDay).toBe(4);
    }
    expect([...seen].sort()).toEqual([...ILLNESS_IDS].sort());
  });

  it('is food poisoning when what the Character ate was sure to make them ill, and the risk is used up', () => {
    const after = pastMidnight(lateEvening(1, { foodPoisoningChance: 1 }));
    expect(after.character.illness?.illnessId).toBe('food-poisoning');
    expect(after.character.foodPoisoningChance).toBe(0);
  });

  it('does not strike a Character who is already ill with something else', () => {
    for (let seed = 0; seed < 200; seed++) {
      const ill = lateEvening(seed, { illness: { illnessId: 'cold', onsetDay: 2 }, foodPoisoningChance: 1 });
      expect(pastMidnight(ill).character.illness).toEqual({ illnessId: 'cold', onsetDay: 2 });
    }
  });

  it('cannot be dodged by reloading: the same save always rolls the same way', () => {
    for (let seed = 0; seed < 200; seed++) {
      const saved = lateEvening(seed);
      const reloaded: GameState = JSON.parse(JSON.stringify(saved));
      expect(pastMidnight(reloaded).character.illness).toEqual(pastMidnight(saved).character.illness);
    }
  });

  it('rolls again each new day from where the RNG left off, rather than repeating the same roll', () => {
    const saved = lateEvening(7);
    const nextNight = { ...pastMidnight(saved), clock: { day: 4, minuteOfDay: 23 * HOUR } };
    expect(pastMidnight(saved).rngState).not.toBe(saved.rngState);
    expect(pastMidnight(nextNight).rngState).not.toBe(nextNight.rngState);
  });
});

/** A Character in the middle of the morning, with a cold or well, and their needs met unless the test says otherwise. */
function midMorning(ill: boolean, character: Partial<GameState['character']> = {}): GameState {
  const state = lateEvening(1, { illness: ill ? { illnessId: 'cold', onsetDay: 3 } : null, ...character });
  return { ...state, clock: { day: 3, minuteOfDay: 10 * HOUR } };
}

describe('being ill', () => {
  it('drains Health slowly, over healthFullToEmptyGameMinutes, while needs are met', () => {
    const after = tick(midMorning(true), ILLNESS.healthFullToEmptyGameMinutes / 4);
    expect(after.character.health).toBeCloseTo(0.75 * METER_MAX);
    expect(tick(midMorning(false), 2 * HOUR).character.health).toBe(METER_MAX);
  });

  it('drains Health on top of an empty Hunger', () => {
    const minutes = 2 * HOUR;
    const perMinute = METER_MAX / ILLNESS.healthFullToEmptyGameMinutes + METER_MAX / WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes;
    expect(tick(midMorning(true, { hunger: 0 }), minutes).character.health).toBeCloseTo(METER_MAX - perMinute * minutes);
  });

  it('lowers Mood', () => {
    expect(tick(midMorning(true), 2 * HOUR).character.mood).toBeLessThan(tick(midMorning(false), 2 * HOUR).character.mood);
  });

  it('leads to Fainting if left untreated, and the ward sees to the Illness', () => {
    const weak = { health: 0.1 * METER_MAX };
    const hoursToFaint = (0.1 * ILLNESS.healthFullToEmptyGameMinutes) / HOUR;
    const ill = midMorning(true, weak);
    const after = tick(ill, (hoursToFaint + 1) * HOUR);
    expect(faintedBetween(ill, after)).toBe(true);
    // The cold is gone: anything the Character has now is new, from the night's roll.
    expect(after.character.illness?.onsetDay ?? after.clock.day).toBe(after.clock.day);
    expect(faintedBetween(midMorning(false, weak), tick(midMorning(false, weak), (hoursToFaint + 1) * HOUR))).toBe(false);
  });

  it('faints at the moment Health runs out, with the Illness and an empty Hunger draining it together', () => {
    // An hour of Hunger left: the Illness alone drains Health for that hour, then both drains do.
    const illnessPerMinute = METER_MAX / ILLNESS.healthFullToEmptyGameMinutes;
    const deprivedPerMinute = METER_MAX / WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes;
    const health = 0.1 * METER_MAX;
    const ill = midMorning(true, { health, hunger: (METER_MAX / WELL_BEING.hungerFullToEmptyGameMinutes) * HOUR });
    const faintsAt = HOUR + (health - illnessPerMinute * HOUR) / (illnessPerMinute + deprivedPerMinute);
    expect(faintedBetween(ill, tick(ill, faintsAt - 2))).toBe(false);
    expect(faintedBetween(ill, tick(ill, faintsAt + 2))).toBe(true);
  });

  it('gives the same result for one long tick as for many short ones, across midnight', () => {
    const evening: GameState = { ...midMorning(true), clock: { day: 3, minuteOfDay: 20 * HOUR } };
    let short = evening;
    for (let hour = 0; hour < 8; hour++) short = tick(short, HOUR);
    const long = tick(evening, 8 * HOUR);
    expect(long.character.health).toBeCloseTo(short.character.health);
    expect(long.character.mood).toBeCloseTo(short.character.mood);
    expect(long.character.illness).toEqual(short.character.illness);
    expect(long.rngState).toBe(short.rngState);
  });
});

describe('fainting', () => {
  it("keeps the night's Illness roll: food sure to make the Character ill still does, though the ward cured what they had", () => {
    const ill = midMorning(true, { health: 0.01 * METER_MAX, foodPoisoningChance: 1 });
    const after = tick(ill, HOUR);
    expect(faintedBetween(ill, after)).toBe(true);
    expect(after.character.illness).toEqual({ illnessId: 'food-poisoning', onsetDay: after.clock.day });
  });
});

describe('falling ill partway through a tick', () => {
  it('drains Health for the rest of the tick after midnight, as many short ticks would', () => {
    const sure = lateEvening(1, { foodPoisoningChance: 1 });
    let short = sure;
    for (let hour = 0; hour < 5; hour++) short = tick(short, HOUR);
    const long = tick(sure, 5 * HOUR);
    expect(long.character.illness?.illnessId).toBe('food-poisoning');
    expect(long.character.health).toBeLessThan(METER_MAX);
    expect(long.character.health).toBeCloseTo(short.character.health);
  });
});
