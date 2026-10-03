import { describe, expect, it } from 'vitest';
import { createSave, drinkWater, METER_MAX, type GameState } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

function thirstyAt(placeId: GameState['placeId']): GameState {
  const state = createSave(TEST_SETUP);
  return { ...state, placeId, character: { ...state.character, thirst: 10 } };
}

describe('drinkWater', () => {
  it('refills Thirst at home without costing money', () => {
    const state = thirstyAt('home');
    const after = drinkWater(state);
    expect(after.character.thirst).toBe(METER_MAX);
    expect(after.character.moneyInShifts).toBe(state.character.moneyInShifts);
  });

  it('only works at home, where the tap is', () => {
    const state = thirstyAt('cafe');
    expect(drinkWater(state)).toEqual(state);
  });
});
