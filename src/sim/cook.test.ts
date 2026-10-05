import { describe, expect, it } from 'vitest';
import {
  cook,
  createSave,
  GROCERIES,
  ILLNESS,
  LIFE_SKILLS,
  lifeSkillLevel,
  METER_MAX,
  MOOD,
  WELL_BEING,
  type GameState,
  type InventoryItem,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const DAY = 4;
const fresh = (quantity = 1): InventoryItem => ({ itemId: 'vegetables', quantity, expiresOnDay: DAY + 1 });
const goneOff = (quantity = 1): InventoryItem => ({ itemId: 'eggs', quantity, expiresOnDay: DAY - 1 });

/** A hungry Character at home on day 4 with this inventory, Cooking at `level`. */
function hungryAtHome(inventory: InventoryItem[], level = 0, character: Partial<GameState['character']> = {}): GameState {
  const state = createSave(TEST_SETUP);
  return {
    ...state,
    clock: { day: DAY, minuteOfDay: 18 * 60 },
    placeId: 'home',
    character: { ...state.character, hunger: 0, ...character },
    progression: {
      ...state.progression,
      lifeSkillXp: { ...state.progression.lifeSkillXp, cooking: LIFE_SKILLS.xpToReachLevel[level]! },
      today: { day: DAY, homeMeals: 0, gymSessions: 0 },
    },
    possessions: { ...state.possessions, inventory },
  };
}

const cookingXp = (state: GameState) => state.progression.lifeSkillXp.cooking;

describe('cook', () => {
  it('uses up one grocery for a meal', () => {
    const after = cook(hungryAtHome([fresh(2)]));
    expect(after.possessions.inventory).toEqual([fresh(1)]);
    expect(cook(after).possessions.inventory).toEqual([]);
  });

  it('at Cooking 0, fills less Hunger than a bento', () => {
    const after = cook(hungryAtHome([fresh()], 0));
    expect(after.character.hunger).toBeGreaterThan(0);
    expect(after.character.hunger).toBeLessThan(WELL_BEING.bentoHunger);
    expect(after.character.mood).toBe(MOOD.neutral);
  });

  it('at Cooking 5, fills more Hunger than a bento and lifts Mood a little', () => {
    const after = cook(hungryAtHome([fresh()], 5));
    expect(after.character.hunger).toBeGreaterThan(WELL_BEING.bentoHunger);
    expect(after.character.mood).toBe(MOOD.neutral + MOOD.changes.goodHomeMeal);
  });

  it('fills more Hunger with each Cooking level', () => {
    const fills = [0, 1, 2, 3, 4, 5].map((level) => cook(hungryAtHome([fresh()], level)).character.hunger);
    fills.slice(1).forEach((fill, i) => expect(fill).toBeGreaterThan(fills[i]!));
  });

  it('never fills Hunger past full', () => {
    expect(cook(hungryAtHome([fresh()], 5, { hunger: METER_MAX - 1 })).character.hunger).toBe(METER_MAX);
  });

  it('does nothing away from home or without groceries', () => {
    const away = { ...hungryAtHome([fresh()]), placeId: 'cafe' as const };
    expect(cook(away)).toEqual(away);
    const nothing = hungryAtHome([]);
    expect(cook(nothing)).toEqual(nothing);
  });

  it('cooks the fresh grocery that goes off soonest, and gone-off food only when nothing is fresh', () => {
    const later: InventoryItem = { itemId: 'noodles', quantity: 1, expiresOnDay: DAY + 3 };
    const after = cook(hungryAtHome([goneOff(), later, fresh()]));
    expect(after.possessions.inventory).toEqual([goneOff(), later]);
    expect(cook(hungryAtHome([goneOff()])).possessions.inventory).toEqual([]);
  });

  it('gives Cooking XP for a meal, multiplied by the Mood modifier', () => {
    const low = cookingXp(cook(hungryAtHome([fresh()], 0, { mood: 0 })));
    const high = cookingXp(cook(hungryAtHome([fresh()], 0, { mood: METER_MAX })));
    expect(low).toBeCloseTo(LIFE_SKILLS.xpPerHomeMeal * MOOD.modifier.atZero);
    expect(high).toBeCloseTo(LIFE_SKILLS.xpPerHomeMeal * MOOD.modifier.atMax);
  });

  it('gives XP for only the first few meals each day, counting afresh the next day', () => {
    const counting = LIFE_SKILLS.homeMealsCountingPerDay;
    let state = hungryAtHome([fresh(counting + 2)]);
    for (let meal = 0; meal < counting; meal++) {
      const before = cookingXp(state);
      state = cook(state);
      expect(cookingXp(state)).toBeGreaterThan(before);
    }
    const extra = cook(state);
    expect(cookingXp(extra)).toBe(cookingXp(state));
    expect(extra.possessions.inventory).toEqual([fresh(1)]);

    const tomorrow = cook({ ...extra, clock: { ...extra.clock, day: DAY + 1 } });
    expect(cookingXp(tomorrow)).toBeGreaterThan(cookingXp(extra));
  });

  it('reaches Cooking 5 in about 3–4 weeks of cooking every counted meal', () => {
    const counting = LIFE_SKILLS.homeMealsCountingPerDay;
    let state = hungryAtHome([]);
    let days = 0;
    while (lifeSkillLevel(cookingXp(state)) < LIFE_SKILLS.maxLevel) {
      days++;
      state = {
        ...state,
        clock: { ...state.clock, day: DAY + days },
        character: { ...state.character, mood: MOOD.neutral },
        possessions: { ...state.possessions, inventory: [{ itemId: 'vegetables', quantity: counting, expiresOnDay: DAY + days }] },
      };
      for (let meal = 0; meal < counting; meal++) state = cook(state);
    }
    expect(days).toBeGreaterThanOrEqual(21);
    expect(days).toBeLessThanOrEqual(28);
  });

  describe('food poisoning risk, recorded for Illness', () => {
    const risk = (state: GameState) => state.character.foodPoisoningChance;

    it('is none from fresh groceries', () => {
      expect(risk(cook(hungryAtHome([fresh()], 0)))).toBe(0);
    });

    it('comes from gone-off groceries, at its full chance at Cooking 0', () => {
      expect(risk(cook(hungryAtHome([goneOff()], 0)))).toBeCloseTo(ILLNESS.expiredFoodPoisoningChance);
    });

    it('falls with each Cooking level', () => {
      const risks = [0, 1, 2, 3, 4, 5].map((level) => risk(cook(hungryAtHome([goneOff()], level))));
      risks.slice(1).forEach((chance, i) => expect(chance).toBeLessThan(risks[i]!));
      expect(risks[5]).toBeGreaterThan(0);
    });

    it('builds up over several gone-off meals without passing certainty', () => {
      const once = cook(hungryAtHome([goneOff(2)], 0));
      const twice = cook(once);
      expect(risk(twice)).toBeGreaterThan(risk(once));
      expect(risk(twice)).toBeLessThan(1);
    });
  });

  it('still cooks groceries kept past going off until they are thrown out', () => {
    const lastDayKept: InventoryItem = { itemId: 'eggs', quantity: 1, expiresOnDay: DAY - GROCERIES.goneOffDaysKept };
    expect(cook(hungryAtHome([lastDayKept])).possessions.inventory).toEqual([]);
  });
});
