import type { NewGameSetup } from '../sim/index.ts';
import { DEV_SETUP, type createGameStore } from './gameStore.ts';

/**
 * New game, through every setup screen with the dev setup's answers (or the
 * ones given): from the title screen, once it's ready, to the First Morning.
 * The save's RNG seed is whatever the store's `newRngSeed` gives.
 */
export function setUpNewGame(store: ReturnType<typeof createGameStore>, answers: Partial<Omit<NewGameSetup, 'rngSeed'>> = {}) {
  const { targetLanguage, startingStep, characterName, appearancePresetId } = { ...DEV_SETUP, ...answers };
  const s = () => store.getState();
  s().newGame();
  s().setupNext();
  s().chooseTargetLanguage(targetLanguage);
  s().setupNext();
  s().chooseStartingStep(startingStep);
  s().nameCharacter(characterName);
  s().setupNext();
  s().chooseAppearance(appearancePresetId);
  s().setupNext();
}
