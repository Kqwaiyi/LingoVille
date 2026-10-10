import { advanceClock, isOpen, type OpeningHours } from './clock.ts';
import { leaveClinic } from './clinic.ts';
import { faint } from './faint.ts';
import { completeFirstMorningStep } from './firstMorning.ts';
import { illnessHealthPerMinute } from './illness.ts';
import { throwOutSpoiled } from './inventory.ts';
import { lifeSkillShare } from './lifeSkills.ts';
import { clampMeter } from './meters.ts';
import { endDaysSince } from './days.ts';
import { leaveTable } from './restaurant.ts';
import type { GameState, PlaceId } from './state.ts';
import { CLOCK, LIFE_SKILLS, METER_MAX, MINUTES_PER_HOUR, MOOD, WELL_BEING } from './tuning.ts';

const hungerPerMinute = METER_MAX / WELL_BEING.hungerFullToEmptyGameMinutes;
const thirstPerMinute = METER_MAX / WELL_BEING.thirstFullToEmptyGameMinutes;
const deprivedHealthPerMinuteAtFitnessZero = METER_MAX / WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes;

/** How fast Health falls while Hunger or Thirst is at 0: slower the fitter the Character, linearly by Fitness level. */
function deprivedHealthPerMinute(state: GameState): number {
  return deprivedHealthPerMinuteAtFitnessZero * (1 - (1 - LIFE_SKILLS.fitnessDeprivedDrainAtMax) * lifeSkillShare(state, 'fitness'));
}

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

/**
 * Game minutes until Health runs out at the current rates: never, while the Character is well and their needs are met.
 * An Illness drains it from now, and an empty Hunger or Thirst drains it as well from the moment one runs out.
 */
function minutesUntilFainting(state: GameState): number {
  const { character } = state;
  if (character.health <= 0) return 0;
  const ill = illnessHealthPerMinute(state);
  const untilDeprived = minutesUntilDeprived(character);
  const healthAtDeprived = character.health - ill * untilDeprived;
  if (healthAtDeprived <= 0) return character.health / ill;
  return untilDeprived + healthAtDeprived / (ill + deprivedHealthPerMinute(state));
}

/**
 * Advances the game by `dtGameMinutes`. Hunger and Thirst empty steadily, and
 * Health falls only during an Illness and from the moment one of them reaches 0 (slower with Fitness),
 * so one long tick gives the same result as many short ones. Mood falls while a need is unmet, while ill
 * and, faster, while the Character is up late at night. The moment Health
 * reaches 0, the Character faints, and the rest of the tick is lost.
 * Each day ends at midnight, where the tick pauses: rent falls due, and the Character may fall ill
 * for the rest of the tick. Groceries that have been off too long are thrown out.
 */
export function tick(state: GameState, dtGameMinutes: number): GameState {
  let after = state;
  for (let left = dtGameMinutes; left > 0; ) {
    const step = Math.min(left, CLOCK.minutesPerDay - after.clock.minuteOfDay);
    const { day } = after.clock;
    const untilFainting = minutesUntilFainting(after);
    if (untilFainting <= step) return faint(endDaysSince(day, decay(after, untilFainting)));
    after = endDaysSince(day, decay(after, step));
    left -= step;
  }
  return after === state ? state : throwOutSpoiled(after);
}

function decay(state: GameState, dtGameMinutes: number): GameState {
  const { character } = state;
  const deprivedMinutes = Math.max(0, dtGameMinutes - minutesUntilDeprived(character));
  const moodChange =
    (MOOD.changes.unmetNeedPerGameHour * deprivedMinutes +
      MOOD.changes.lateNightPerGameHour * lateNightMinutes(state.clock.minuteOfDay, dtGameMinutes) +
      (character.illness ? MOOD.changes.illnessPerGameHour * dtGameMinutes : 0)) /
    MINUTES_PER_HOUR;

  return {
    ...state,
    clock: advanceClock(state.clock, dtGameMinutes),
    character: {
      ...character,
      hunger: clampMeter(character.hunger - hungerPerMinute * dtGameMinutes),
      thirst: clampMeter(character.thirst - thirstPerMinute * dtGameMinutes),
      health: clampMeter(character.health - illnessHealthPerMinute(state) * dtGameMinutes - deprivedHealthPerMinute(state) * deprivedMinutes),
      mood: clampMeter(character.mood + moodChange),
    },
  };
}

/** The Character walks into a place, given its hours in this pack. A closed place can't be entered. The café is where the First Morning leads. */
export function enterPlace(state: GameState, placeId: PlaceId, hours: OpeningHours): GameState {
  if (state.placeId === placeId || !isOpen(hours, state.clock)) return state;
  // Walking out of the restaurant gives up the table, and any unpaid bill becomes debt. Walking out of the clinic gives up a place in its queue.
  const entered: GameState = { ...leaveClinic(leaveTable(state)), placeId };
  return placeId === 'cafe' ? completeFirstMorningStep(entered, 'walkToCafe') : entered;
}

/** Tap water at home: refills Thirst for free, and is the First Morning's drink. There's no tap anywhere else. */
export function drinkWater(state: GameState): GameState {
  if (state.placeId !== 'home') return state;
  return completeFirstMorningStep({ ...state, character: { ...state.character, thirst: METER_MAX } }, 'drink');
}
