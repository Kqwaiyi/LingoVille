import { describe, expect, it } from 'vitest';
import { createSave, FIRST_MORNING, METER_MAX, MOOD } from './index.ts';
import { TEST_SETUP as setup } from './testSetup.ts';

describe('createSave', () => {
  it('starts the First Morning at home on day 1 at 07:00', () => {
    const state = createSave(setup);

    expect(state.clock).toEqual({ day: FIRST_MORNING.day, minuteOfDay: FIRST_MORNING.minuteOfDay });
    expect(state.placeId).toBe('home');
  });

  it('starts with full Health, part-empty Hunger and Thirst, neutral Mood and the starting money', () => {
    const { character } = createSave(setup);

    expect(character.health).toBe(METER_MAX);
    expect(character.hunger).toBe(FIRST_MORNING.hunger);
    expect(character.thirst).toBe(FIRST_MORNING.thirst);
    expect(character.mood).toBe(MOOD.neutral);
    expect(character.moneyInShifts).toBe(FIRST_MORNING.moneyInShifts);
  });

  it('makes rent first due at the end of day 7', () => {
    expect(createSave(setup).rent.dueDay).toBe(FIRST_MORNING.rentDueDay);
  });

  it('keeps who the Character is and their starting step from the setup', () => {
    const state = createSave(setup);

    expect(state.identity).toEqual({
      characterName: setup.characterName,
      targetLanguage: setup.targetLanguage,
      culturePackId: setup.culturePackId,
      appearancePresetId: setup.appearancePresetId,
    });
    expect(state.proficiencyStep).toBe(setup.startingStep);
  });

  it('seeds the RNG state from the setup, so the same seed gives the same game', () => {
    expect(createSave(setup).rngState).toBe(createSave(setup).rngState);
    expect(createSave({ ...setup, rngSeed: setup.rngSeed + 1 }).rngState).not.toBe(createSave(setup).rngState);
  });
});
