import { advanceClock, isOpen, type OpeningHours } from './clock.ts';
import { clampMeter } from './meters.ts';
import type { GameState, PlaceId } from './state.ts';
import { METER_MAX, WELL_BEING } from './tuning.ts';

const hungerPerMinute = METER_MAX / WELL_BEING.hungerFullToEmptyGameMinutes;
const thirstPerMinute = METER_MAX / WELL_BEING.thirstFullToEmptyGameMinutes;
const deprivedHealthPerMinute = METER_MAX / WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes;

/**
 * Advances the game by `dtGameMinutes`. Hunger and Thirst empty steadily, and
 * Health falls only from the moment one of them reaches 0, so one long tick
 * gives the same result as many short ones.
 */
export function tick(state: GameState, dtGameMinutes: number): GameState {
  if (dtGameMinutes <= 0) return state;
  const { character } = state;

  const minutesUntilDeprived = Math.min(character.hunger / hungerPerMinute, character.thirst / thirstPerMinute);
  const deprivedMinutes = Math.max(0, dtGameMinutes - minutesUntilDeprived);

  return {
    ...state,
    clock: advanceClock(state.clock, dtGameMinutes),
    character: {
      ...character,
      hunger: clampMeter(character.hunger - hungerPerMinute * dtGameMinutes),
      thirst: clampMeter(character.thirst - thirstPerMinute * dtGameMinutes),
      health: clampMeter(character.health - deprivedHealthPerMinute * deprivedMinutes),
    },
  };
}

/** The Character walks into a place, given its hours in this pack. A closed place can't be entered. */
export function enterPlace(state: GameState, placeId: PlaceId, hours: OpeningHours): GameState {
  if (state.placeId === placeId || !isOpen(hours, state.clock)) return state;
  return { ...state, placeId };
}

/** Tap water at home: refills Thirst for free. There's no tap anywhere else. */
export function drinkWater(state: GameState): GameState {
  if (state.placeId !== 'home') return state;
  return { ...state, character: { ...state.character, thirst: METER_MAX } };
}
