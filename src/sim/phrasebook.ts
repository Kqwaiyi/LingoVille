import type { GameState, PhrasebookEntry } from './state.ts';

/**
 * "+ Phrasebook": keeps a word from a Recap in the personal phrasebook, dated
 * today. A word already kept in the same Native Language isn't kept twice.
 */
export function addToPhrasebook(state: GameState, word: Omit<PhrasebookEntry, 'dayAdded'>): GameState {
  const kept = state.phrasebook.some((entry) => entry.text === word.text && entry.glossLanguage === word.glossLanguage);
  if (kept) return state;
  return { ...state, phrasebook: [...state.phrasebook, { ...word, dayAdded: state.clock.day }] };
}
