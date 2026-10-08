import { advanceClock, isOpen, type OpeningHours } from './clock.ts';
import { faint } from './faint.ts';
import { throwOutSpoiled } from './inventory.ts';
import { clampMeter } from './meters.ts';
import { endDaysSince } from './rent.ts';
import { leaveTable } from './restaurant.ts';
import type { GameState, PlaceId } from './state.ts';
import { CLOCK, METER_MAX, MINUTES_PER_HOUR, MOOD, WELL_BEING } from './tuning.ts';

const hungerPerMinute = METER_MAX / WELL_BEING.hungerFullToEmptyGameMinutes;
const thirstPerMinute = METER_MAX / WELL_BEING.thirstFullToEmptyGameMinutes;
const deprivedHealthPerMinute = METER_MAX / WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes;

/** Game minutes from `minuteOfDay` over the next `dtGameMinutes` that fall late at night, from about 2am until morning. */
function lateNightMinutes(minuteOfDay: number, dtGameMinutes: number): number {
  const end = minuteOfDay + dtGameMinutes;
  let minutes = 0;
  for (let dayStart = 0; dayStart < end; dayStart += CLOCK.minutesPerDay) {
    const from = Math.max(minuteOfDay, dayStart + CLOCK.lateNightFrom);
    const until = Math.min(end, dayStart + CLOCK.wakeAt);
    minutes += Math.max(0, until - from);
  }
  return minutes;
}

const minutesUntilDeprived = ({ hunger, thirst }: GameState['character']) =>
  Math.min(hunger / hungerPerMinute, thirst / thirstPerMinute);

/** Game minutes until Health runs out at the current rates: never, while the Character's needs are met. */
function minutesUntilFainting(character: GameState['character']): number {
  if (character.health <= 0) return 0;
  return minutesUntilDeprived(character) + character.health / deprivedHealthPerMinute;
}

/**
 * Advances the game by `dtGameMinutes`. Hunger and Thirst empty steadily, and
 * Health falls only from the moment one of them reaches 0, so one long tick
 * gives the same result as many short ones. Mood falls while a need is unmet
 * and, faster, while the Character is up late at night. The moment Health
 * reaches 0, the Character faints, and the rest of the tick is lost.
 * Groceries that have been off too long are thrown out, and rent falls due
 * at the end of its day.
 */
export function tick(state: GameState, dtGameMinutes: number): GameState {
  if (dtGameMinutes <= 0) return state;
  const untilFainting = minutesUntilFainting(state.character);
  const { day } = state.clock;
  if (untilFainting <= dtGameMinutes) return faint(endDaysSince(day, decay(state, untilFainting)));
  return throwOutSpoiled(endDaysSince(day, decay(state, dtGameMinutes)));
}

function decay(state: GameState, dtGameMinutes: number): GameState {
  const { character } = state;
  const deprivedMinutes = Math.max(0, dtGameMinutes - minutesUntilDeprived(character));
  const moodChange =
    (MOOD.changes.unmetNeedPerGameHour * deprivedMinutes +
      MOOD.changes.lateNightPerGameHour * lateNightMinutes(state.clock.minuteOfDay, dtGameMinutes)) /
    MINUTES_PER_HOUR;

  return {
    ...state,
    clock: advanceClock(state.clock, dtGameMinutes),
    character: {
      ...character,
      hunger: clampMeter(character.hunger - hungerPerMinute * dtGameMinutes),
      thirst: clampMeter(character.thirst - thirstPerMinute * dtGameMinutes),
      health: clampMeter(character.health - deprivedHealthPerMinute * deprivedMinutes),
      mood: clampMeter(character.mood + moodChange),
    },
  };
}

/** The Character walks into a place, given its hours in this pack. A closed place can't be entered. */
export function enterPlace(state: GameState, placeId: PlaceId, hours: OpeningHours): GameState {
  if (state.placeId === placeId || !isOpen(hours, state.clock)) return state;
  // Walking out of the restaurant gives up the table, and any unpaid bill becomes debt.
  return { ...leaveTable(state), placeId };
}

/** Tap water at home: refills Thirst for free. There's no tap anywhere else. */
export function drinkWater(state: GameState): GameState {
  if (state.placeId !== 'home') return state;
  return { ...state, character: { ...state.character, thirst: METER_MAX } };
}
