import { describe, expect, it } from 'vitest';
import { createSave, type GameState } from '../sim/index.ts';
import { createGameStore, DEV_SETUP, selectSymptoms } from './index.ts';

function withIllness(illness: GameState['character']['illness']) {
  const game = createSave(DEV_SETUP);
  return createGameStore({ ...game, character: { ...game.character, illness } });
}

describe('feeling ill', () => {
  it('shows what the Character feels: the symptoms, never the Illness', () => {
    const store = withIllness({ illnessId: 'flu', onsetDay: 1 });
    expect(selectSymptoms(store.getState())).toEqual(['fever', 'body-aches', 'chills']);
  });

  it('shows nothing while the Character is well', () => {
    expect(selectSymptoms(withIllness(null).getState())).toEqual([]);
  });
});
