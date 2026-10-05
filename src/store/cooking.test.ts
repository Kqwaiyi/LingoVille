import { describe, expect, it } from 'vitest';
import { createSave, LIFE_SKILLS, type GameState } from '../sim/index.ts';
import { createGameStore, DEV_SETUP, selectHunger, selectInventory, selectLifeSkillLevels, selectToast } from './index.ts';

/** A hungry Character at home with groceries, Cooking at `cookingXp`. */
function hungryAtHome(inventory: GameState['possessions']['inventory'], cookingXp = 0) {
  const game = createSave(DEV_SETUP);
  return createGameStore({
    ...game,
    character: { ...game.character, hunger: 10 },
    progression: { ...game.progression, lifeSkillXp: { ...game.progression.lifeSkillXp, cooking: cookingXp } },
    possessions: { ...game.possessions, inventory },
  });
}

describe('cooking at home', () => {
  it('cooks a grocery into a meal and shows the skill on the skills page', () => {
    const store = hungryAtHome([{ itemId: 'eggs', quantity: 1, expiresOnDay: 3 }], LIFE_SKILLS.xpToReachLevel[1]! - 1);

    store.getState().cook();

    expect(selectHunger(store.getState())).toBeGreaterThan(10);
    expect(selectInventory(store.getState())).toEqual([]);
    expect(selectLifeSkillLevels(store.getState())).toEqual({ cooking: 1, fitness: 0, barista: 0, cashier: 0, server: 0 });
  });

  it('says there is nothing to cook without groceries', () => {
    const store = hungryAtHome([]);

    store.getState().cook();

    expect(selectHunger(store.getState())).toBe(10);
    expect(selectToast(store.getState())).toEqual({ kind: 'nothingToCook' });
  });
});
