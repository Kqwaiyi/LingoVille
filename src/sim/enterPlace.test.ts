import { describe, expect, it } from 'vitest';
import { createSave, enterPlace } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

describe('enterPlace', () => {
  it('moves the Character to the new place', () => {
    expect(enterPlace(createSave(TEST_SETUP), 'cafe', null).placeId).toBe('cafe');
  });

  it('returns the same state when the Character is already there', () => {
    const state = createSave(TEST_SETUP);
    expect(enterPlace(state, state.placeId, null)).toBe(state);
  });
});
