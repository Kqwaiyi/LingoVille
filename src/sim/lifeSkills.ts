import { moodModifier } from './mood.ts';
import { LIFE_SKILL_IDS, type GameState, type LifeSkillId } from './state.ts';
import { LIFE_SKILLS } from './tuning.ts';

/** The level, 0–5 stars, that this much XP has reached on the tuning curve. */
export function lifeSkillLevel(xp: number): number {
  return LIFE_SKILLS.xpToReachLevel.findLastIndex((needed) => xp >= needed);
}

/** Every Life Skill's level. */
export function lifeSkillLevels(state: GameState): Record<LifeSkillId, number> {
  const { lifeSkillXp } = state.progression;
  return Object.fromEntries(LIFE_SKILL_IDS.map((skill) => [skill, lifeSkillLevel(lifeSkillXp[skill])])) as Record<LifeSkillId, number>;
}

/** Adds `baseXp` to a Life Skill, multiplied by the Mood modifier. XP never decays. */
export function gainLifeSkillXp(state: GameState, skill: LifeSkillId, baseXp: number): GameState {
  const { lifeSkillXp } = state.progression;
  const gained = baseXp * moodModifier(state.character.mood);
  return { ...state, progression: { ...state.progression, lifeSkillXp: { ...lifeSkillXp, [skill]: lifeSkillXp[skill] + gained } } };
}

/** Today's counters, started afresh when the day they count has passed. */
export function todaysCounters(state: GameState): GameState['progression']['today'] {
  const { today } = state.progression;
  return today.day === state.clock.day ? today : { day: state.clock.day, homeMeals: 0, gymSessions: 0 };
}
