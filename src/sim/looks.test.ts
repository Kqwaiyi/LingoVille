import { describe, expect, it } from 'vitest';
import { lookFromSeed } from './index.ts';
import { TEST_LOOKS } from './testSetup.ts';

describe('lookFromSeed: someone anonymous who is always about', () => {
  it('looks the same every time, from their own seed', () => {
    expect(lookFromSeed(2, TEST_LOOKS)).toEqual(lookFromSeed(2, TEST_LOOKS));
    const looks = Array.from({ length: 20 }, (_, seed) => JSON.stringify(lookFromSeed(seed, TEST_LOOKS)));
    expect(new Set(looks).size).toBeGreaterThan(5);
  });

  it('wears only parts the pack weighs', () => {
    const look = lookFromSeed(7, { ...TEST_LOOKS, hairColour: { grey: 1 }, skinTone: { 'tone-6': 1 } });
    expect(look).toMatchObject({ hairColour: 'grey', skinTone: 'tone-6' });
  });
});
