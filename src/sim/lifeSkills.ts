import { LIFE_SKILL_IDS, type GameState, type JobId, type LifeSkillId } from './state.ts';
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

/** Something a Job's Life Skill makes easier at a Shift: the mechanics only, never understanding the customer. */
export type JobAid = { [Job in JobId]: keyof (typeof LIFE_SKILLS.jobAidsFromLevel)[Job] }[JobId];

/** The aids the Character's level in a Job's Life Skill has unlocked. */
export function jobAids(state: GameState, jobId: JobId): JobAid[] {
  const level = lifeSkillLevel(state.progression.lifeSkillXp[jobId]);
  const fromLevel: Partial<Record<JobAid, number>> = LIFE_SKILLS.jobAidsFromLevel[jobId];
  return (Object.keys(fromLevel) as JobAid[]).filter((aid) => level >= fromLevel[aid]!);
}

/** Adds `baseXp` to a Life Skill. XP never decays. */
export function gainLifeSkillXp(state: GameState, skill: LifeSkillId, baseXp: number): GameState {
  const { lifeSkillXp } = state.progression;
  return { ...state, progression: { ...state.progression, lifeSkillXp: { ...lifeSkillXp, [skill]: lifeSkillXp[skill] + baseXp } } };
}
