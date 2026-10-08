import { fitnessIllnessFactor } from './lifeSkills.ts';
import { nextRandom, randomInt } from './rng.ts';
import { ILLNESS_IDS, type GameState, type IllnessId } from './state.ts';
import { ILLNESS, METER_MAX } from './tuning.ts';

/**
 * How fast an Illness drains Health: slowly, on top of any drain from an empty Hunger or Thirst. Nothing while well,
 * or once the fever reducer has treated a flu.
 */
export function illnessHealthPerMinute({ character }: GameState): number {
  return character.illness && !character.illness.treated ? METER_MAX / ILLNESS.healthFullToEmptyGameMinutes : 0;
}

/** Well-being as one number: the average of Health, Hunger and Thirst, from 0 to 1. */
function wellBeingShare({ health, hunger, thirst }: GameState['character']): number {
  return (health + hunger + thirst) / (3 * METER_MAX);
}

/**
 * The chance of falling ill with something at the end of a day: the base rate, raised as
 * Well-being falls (up to `lowWellBeingMultiplierAtZero` at nothing) and lowered by Fitness.
 */
function dailyIllnessChance(state: GameState): number {
  const lowWellBeing = 1 + (ILLNESS.lowWellBeingMultiplierAtZero - 1) * (1 - wellBeingShare(state.character));
  return ILLNESS.baseDailyChance * lowWellBeing * fitnessIllnessFactor(state);
}

/**
 * The end of `day`: a Character who isn't already ill may fall ill, from the save's RNG,
 * so a reload rolls the same way. First what they ate may give them food poisoning (that
 * risk is then used up), then any Illness may strike at the day's chance. It starts on the new day.
 */
export function rollIllness(state: GameState, day: number): GameState {
  const { character } = state;
  if (character.illness) return { ...state, character: { ...character, foodPoisoningChance: 0 } };
  let { rngState } = state;
  let illnessId: IllnessId | null = null;

  const food = nextRandom(rngState);
  rngState = food.rngState;
  if (food.value < character.foodPoisoningChance) illnessId = 'food-poisoning';
  else {
    const any = nextRandom(rngState);
    rngState = any.rngState;
    if (any.value < dailyIllnessChance(state)) {
      const which = randomInt(rngState, 0, ILLNESS_IDS.length - 1);
      rngState = which.rngState;
      illnessId = ILLNESS_IDS[which.value]!;
    }
  }

  return {
    ...state,
    rngState,
    character: { ...character, foodPoisoningChance: 0, illness: illnessId && { illnessId, onsetDay: day + 1, treated: false } },
  };
}
