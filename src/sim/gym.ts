import { isOpen, type OpeningHours } from './clock.ts';
import { faintedBetween } from './faint.ts';
import { gainLifeSkillXp, todaysCounters } from './lifeSkills.ts';
import { clampMeter } from './meters.ts';
import type { GameState } from './state.ts';
import { ECONOMY, LIFE_SKILLS, MOOD } from './tuning.ts';
import { tick } from './wellBeing.ts';

/** The Character's gym membership: never joined, paid up through today or later, or run out. */
export type GymMembership = 'none' | 'active' | 'expired';

export function gymMembership(state: GameState): GymMembership {
  const until = state.possessions.gymMembershipUntilDay;
  if (until === null) return 'none';
  return state.clock.day <= until ? 'active' : 'expired';
}

/**
 * The last day of gym access once membership is bought now: 30 days from today, or for a membership still running,
 * 30 days on from the day it would have run out, so renewing early loses nothing.
 */
export function membershipBoughtUntil(state: GameState): number {
  const until = state.possessions.gymMembershipUntilDay;
  const from = until !== null && until >= state.clock.day ? until + 1 : state.clock.day;
  return from + ECONOMY.gymMembershipDays - 1;
}

/** Why the gym can't be used now: the bathhouse shut, no membership, one that has run out, or today's session done. */
export type GymRefusal = 'closed' | 'notMember' | 'expired' | 'doneToday';

/** Why a gym session can't start now, given the bathhouse's hours in this pack, or null if it can. */
export function gymRefusal(state: GameState, hours: OpeningHours): GymRefusal | null {
  if (!isOpen(hours, state.clock)) return 'closed';
  const membership = gymMembership(state);
  if (membership === 'none') return 'notMember';
  if (membership === 'expired') return 'expired';
  if (todaysCounters(state).gymSessions >= LIFE_SKILLS.gymSessionsPerDay) return 'doneToday';
  return null;
}

/**
 * A workout at the bathhouse gym, for a member, once a day. It takes about a game hour, and gives Fitness XP
 * (at the Mood the session started in) and a small Mood lift. Fainting on the way through gives nothing.
 * Away from the bathhouse, or when it's refused, the same state comes back.
 */
export function gymSession(state: GameState, hours: OpeningHours): GameState {
  if (state.placeId !== 'bathhouse' || gymRefusal(state, hours)) return state;
  const after = tick(state, LIFE_SKILLS.gymSessionGameMinutes);
  if (faintedBetween(state, after)) return after;
  const { lifeSkillXp } = gainLifeSkillXp(state, 'fitness', LIFE_SKILLS.xpPerGymSession).progression;
  // It counts toward the day it started on, even if it runs past midnight.
  const today = todaysCounters(state);
  return {
    ...after,
    character: { ...after.character, mood: clampMeter(after.character.mood + MOOD.changes.gymSession) },
    progression: { ...after.progression, lifeSkillXp, today: { ...today, gymSessions: today.gymSessions + 1 } },
  };
}
