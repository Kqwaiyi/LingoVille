import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  CLOCK,
  createSave,
  drinkWater,
  enterPlace,
  gameMinutesFor,
  tick,
  weekdayOf,
  type GameState,
  type NewGameSetup,
  type PlaceId,
} from '../sim/index.ts';

/** The fixed setup every new game uses until New game setup lands (ticket 12). */
export const DEV_SETUP: NewGameSetup = {
  characterName: 'Sam',
  targetLanguage: 'ja',
  culturePackId: 'ja',
  startingStep: 'A1',
  appearancePresetId: 'preset-1',
  rngSeed: 20261003,
};

/** Something in the world the Character is close enough to use with E. */
export type Interactable = 'tap';

export type GameStore = {
  game: GameState;
  tabHidden: boolean;
  interactable: Interactable | null;
  /** Called once per rendered frame with the real time since the last one. */
  advance: (realDeltaMs: number) => void;
  setTabHidden: (hidden: boolean) => void;
  enterPlace: (placeId: PlaceId) => void;
  setInteractable: (interactable: Interactable | null) => void;
  drinkWater: () => void;
};

export function createGameStore(initial: GameState) {
  return createStore<GameStore>()((set, get) => ({
    game: initial,
    tabHidden: false,
    interactable: null,
    advance: (realDeltaMs) => {
      const dt = gameMinutesFor(realDeltaMs, selectTimeScale(get()));
      if (dt > 0) set({ game: tick(get().game, dt) });
    },
    setTabHidden: (tabHidden) => set({ tabHidden }),
    // The world calls these every frame, so they only notify on a change.
    enterPlace: (placeId) => {
      const game = enterPlace(get().game, placeId);
      if (game !== get().game) set({ game });
    },
    setInteractable: (interactable) => {
      if (get().interactable !== interactable) set({ interactable });
    },
    drinkWater: () => set({ game: drinkWater(get().game) }),
  }));
}

export const gameStore = createGameStore(createSave(DEV_SETUP));

/** Reads the game store from React. Pass one of the selectors below. */
export function useGame<T>(selector: (state: GameStore) => T): T {
  return useStore(gameStore, selector);
}

// --- Selectors: the only way world and UI read game state -------------------

export const selectTimeScale = (s: GameStore) => (s.tabHidden ? CLOCK.timeScale.paused : CLOCK.timeScale.normal);
export const selectHealth = (s: GameStore) => s.game.character.health;
export const selectHunger = (s: GameStore) => s.game.character.hunger;
export const selectThirst = (s: GameStore) => s.game.character.thirst;
export const selectMood = (s: GameStore) => s.game.character.mood;
export const selectMoneyInShifts = (s: GameStore) => s.game.character.moneyInShifts;
export const selectCulturePackId = (s: GameStore) => s.game.identity.culturePackId;
export const selectDay = (s: GameStore) => s.game.clock.day;
export const selectWeekday = (s: GameStore) => weekdayOf(s.game.clock.day);
/** Whole game minutes since midnight, so the clock re-renders once a game minute. */
export const selectClockMinute = (s: GameStore) => Math.floor(s.game.clock.minuteOfDay);
export const selectPlaceId = (s: GameStore) => s.game.placeId;
export const selectInteractable = (s: GameStore) => s.interactable;
