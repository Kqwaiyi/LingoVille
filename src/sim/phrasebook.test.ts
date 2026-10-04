import { describe, expect, it } from 'vitest';
import { addToPhrasebook, createSave, type GameState } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const WORD = { text: 'いらっしゃいませ', reading: 'いらっしゃいませ', gloss: 'welcome (said by shop staff)', glossLanguage: 'en' } as const;

function onDay(day: number): GameState {
  const state = createSave(TEST_SETUP);
  return { ...state, clock: { ...state.clock, day } };
}

describe('addToPhrasebook', () => {
  it('keeps the word in the personal phrasebook, with the day it was added', () => {
    const after = addToPhrasebook(onDay(3), WORD);

    expect(after.phrasebook).toEqual([{ ...WORD, dayAdded: 3 }]);
  });

  it('keeps a word only once in the same Native Language', () => {
    const once = addToPhrasebook(onDay(1), WORD);

    expect(addToPhrasebook(once, { ...WORD, gloss: 'welcome' })).toBe(once);
    expect(addToPhrasebook(once, { ...WORD, gloss: 'willkommen', glossLanguage: 'de' }).phrasebook).toHaveLength(2);
  });

  it('costs no money and no Mood', () => {
    const state = onDay(1);
    const after = addToPhrasebook(state, WORD);

    expect(after.character).toEqual(state.character);
  });
});
