import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS, INTERACTIONS, menuPrice } from '../content/index.ts';
import {
  applyInteractionOutcome,
  createSave,
  ECONOMY,
  fitnessIllnessFactor,
  gymMembership,
  gymRefusal,
  gymSession,
  LIFE_SKILLS,
  METER_MAX,
  MOOD,
  moodModifier,
  tick,
  WELL_BEING,
  type GameState,
  type OpeningHours,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const HOUR = 60;
const DAY = 5;
/** The bathhouse's hours in these tests: 10:00–24:00. */
const BATHHOUSE: OpeningHours = { opensAt: 10 * HOUR, closesAt: 24 * HOUR, closedOn: [] };
const fitnessXp = (state: GameState) => state.progression.lifeSkillXp.fitness;

/** In the bathhouse at 18:00 on day 5, well fed, with gym membership until `memberUntilDay` (null: never joined). */
function atTheGym(memberUntilDay: number | null = DAY + 10, mood: number = MOOD.neutral): GameState {
  const state = createSave(TEST_SETUP);
  return {
    ...state,
    clock: { day: DAY, minuteOfDay: 18 * HOUR },
    placeId: 'bathhouse',
    character: { ...state.character, hunger: METER_MAX, thirst: METER_MAX, mood },
    progression: { ...state.progression, today: { day: DAY, homeMeals: 0, gymSessions: 0 } },
    possessions: { ...state.possessions, gymMembershipUntilDay: memberUntilDay },
  };
}

/** A Character with Fitness at `level`. */
function fitAt(level: number, character: Partial<GameState['character']> = {}): GameState {
  const state = createSave(TEST_SETUP);
  return {
    ...state,
    character: { ...state.character, ...character },
    progression: { ...state.progression, lifeSkillXp: { ...state.progression.lifeSkillXp, fitness: LIFE_SKILLS.xpToReachLevel[level]! } },
  };
}

describe('Fitness: the Health drain at zero Hunger or Thirst', () => {
  const quarterOfTheDrain = WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes / 4;
  const starving = { health: METER_MAX, hunger: 0, thirst: METER_MAX };

  it('drains at the full rate at Fitness 0', () => {
    expect(tick(fitAt(0, starving), quarterOfTheDrain).character.health).toBeCloseTo(METER_MAX * 0.75);
  });

  it('drains at fitnessDeprivedDrainAtMax of the rate at Fitness 5, and part of the way between', () => {
    const atMax = tick(fitAt(LIFE_SKILLS.maxLevel, starving), quarterOfTheDrain).character.health;
    expect(atMax).toBeCloseTo(METER_MAX * (1 - 0.25 * LIFE_SKILLS.fitnessDeprivedDrainAtMax));
    const between = tick(fitAt(2, starving), quarterOfTheDrain).character.health;
    expect(between).toBeGreaterThan(METER_MAX * 0.75);
    expect(between).toBeLessThan(atMax);
  });

  it('keeps a fit Character on their feet longer before they faint', () => {
    const minutes = WELL_BEING.healthFullToEmptyWhileDeprivedGameMinutes + 60;
    expect(tick(fitAt(0, starving), minutes).wokeInWardOnDay).not.toBeNull();
    expect(tick(fitAt(LIFE_SKILLS.maxLevel, starving), minutes).wokeInWardOnDay).toBeNull();
  });
});

describe('Fitness: the chance of Illness', () => {
  it('leaves the chance as it is at Fitness 0', () => {
    expect(fitnessIllnessFactor(fitAt(0))).toBe(1);
  });

  it('takes fitnessIllnessReductionAtMax off it at max Fitness, and less at the levels between', () => {
    const atMax = 1 - LIFE_SKILLS.fitnessIllnessReductionAtMax;
    expect(fitnessIllnessFactor(fitAt(LIFE_SKILLS.maxLevel))).toBeCloseTo(atMax);
    expect(fitnessIllnessFactor(fitAt(2))).toBeLessThan(1);
    expect(fitnessIllnessFactor(fitAt(2))).toBeGreaterThan(atMax);
  });
});

describe('gymSession', () => {
  it('takes about a game hour, and gives Fitness XP and a small Mood lift', () => {
    const before = atTheGym();
    const after = gymSession(before, BATHHOUSE);
    expect(after.clock).toEqual({ day: DAY, minuteOfDay: 18 * HOUR + LIFE_SKILLS.gymSessionGameMinutes });
    expect(after.character.hunger).toBeLessThan(METER_MAX);
    expect(fitnessXp(after)).toBeCloseTo(LIFE_SKILLS.xpPerGymSession);
    expect(after.character.mood).toBeCloseTo(MOOD.neutral + MOOD.changes.gymSession);
  });

  it('multiplies the XP by the Mood modifier the session started in', () => {
    const low = 0.1 * METER_MAX;
    expect(fitnessXp(gymSession(atTheGym(DAY, low), BATHHOUSE))).toBeCloseTo(LIFE_SKILLS.xpPerGymSession * moodModifier(low));
    expect(fitnessXp(gymSession(atTheGym(DAY, METER_MAX), BATHHOUSE))).toBeCloseTo(LIFE_SKILLS.xpPerGymSession * moodModifier(METER_MAX));
  });

  it('allows one session a day', () => {
    const once = gymSession(atTheGym(), BATHHOUSE);
    expect(gymRefusal(once, BATHHOUSE)).toBe('doneToday');
    expect(gymSession(once, BATHHOUSE)).toBe(once);
    const tomorrow: GameState = { ...once, clock: { day: DAY + 1, minuteOfDay: 11 * HOUR } };
    expect(gymRefusal(tomorrow, BATHHOUSE)).toBeNull();
    expect(fitnessXp(gymSession(tomorrow, BATHHOUSE))).toBeGreaterThan(fitnessXp(once));
  });

  it('is refused without membership, and once it has run out', () => {
    const neverJoined = atTheGym(null);
    expect(gymRefusal(neverJoined, BATHHOUSE)).toBe('notMember');
    expect(gymSession(neverJoined, BATHHOUSE)).toBe(neverJoined);
    expect(gymRefusal(atTheGym(DAY), BATHHOUSE)).toBeNull();
    const expired = atTheGym(DAY - 1);
    expect(gymRefusal(expired, BATHHOUSE)).toBe('expired');
    expect(gymSession(expired, BATHHOUSE)).toBe(expired);
  });

  it('is refused while the bathhouse is closed, member or not, and away from it', () => {
    const lateAtNight: GameState = { ...atTheGym(), clock: { day: DAY, minuteOfDay: 2 * HOUR } };
    expect(gymRefusal(lateAtNight, BATHHOUSE)).toBe('closed');
    expect(gymRefusal({ ...lateAtNight, possessions: { ...lateAtNight.possessions, gymMembershipUntilDay: null } }, BATHHOUSE)).toBe('closed');
    expect(gymSession(lateAtNight, BATHHOUSE)).toBe(lateAtNight);
    const atHome: GameState = { ...atTheGym(), placeId: 'home' };
    expect(gymSession(atHome, BATHHOUSE)).toBe(atHome);
  });

  it('gives nothing if the Character faints during it', () => {
    const starving: GameState = { ...atTheGym(), character: { ...atTheGym().character, hunger: 0, thirst: 0, health: 1 } };
    const after = gymSession(starving, BATHHOUSE);
    expect(after.wokeInWardOnDay).not.toBeNull();
    expect(fitnessXp(after)).toBe(0);
  });
});

describe('gym membership (#22): register_member', () => {
  const { joinTheGym, renewGymMembership } = INTERACTIONS;
  const membershipPrice = menuPrice('gym-membership', 'ja');
  const joined = (state: GameState) => applyInteractionOutcome(state, joinTheGym, { kind: 'success', args: { kind: 'join' } });
  const renewed = (state: GameState) => applyInteractionOutcome(state, renewGymMembership, { kind: 'success', args: { kind: 'renew' } });

  it('costs about half a Shift in every pack', () => {
    for (const packId of ['ja', 'zh', 'en', 'de'] as const) {
      expect(menuPrice('gym-membership', packId)).toBeCloseTo(ECONOMY.gymMembershipInShifts, 1);
    }
  });

  it('charges the membership, gives 30 days of gym access from today and lifts Mood', () => {
    const before = atTheGym(null);
    const { state: after, result } = joined(before);
    expect(after.character.moneyInShifts).toBeCloseTo(before.character.moneyInShifts - membershipPrice);
    expect(after.possessions.gymMembershipUntilDay).toBe(DAY + ECONOMY.gymMembershipDays - 1);
    expect(after.character.mood).toBe(before.character.mood + MOOD.changes.goalInteractionSuccess);
    expect(result).toMatchObject({ kind: 'success', paidInShifts: membershipPrice, served: [{ name: CULTURE_PACKS.ja.goods['gym-membership'].name }] });
    expect(after.possessions.inventory).toEqual([]);
  });

  it('lasts 30 days: the last day still lets the Character in, and the day after does not', () => {
    const { state } = joined(atTheGym(null));
    const lastDay: GameState = { ...state, clock: { day: DAY + ECONOMY.gymMembershipDays - 1, minuteOfDay: 18 * HOUR } };
    expect(gymMembership(lastDay)).toBe('active');
    expect(gymRefusal(lastDay, BATHHOUSE)).toBeNull();
    const dayAfter: GameState = { ...state, clock: { day: DAY + ECONOMY.gymMembershipDays, minuteOfDay: 18 * HOUR } };
    expect(gymMembership(dayAfter)).toBe('expired');
    expect(gymRefusal(dayAfter, BATHHOUSE)).toBe('expired');
  });

  it('is never charged automatically and never becomes debt when it runs out', () => {
    const lastEvening: GameState = { ...atTheGym(DAY), clock: { day: DAY, minuteOfDay: 23 * HOUR } };
    const after = tick(lastEvening, 2 * HOUR);
    expect(gymMembership(after)).toBe('expired');
    expect(after.character.moneyInShifts).toBe(lastEvening.character.moneyInShifts);
    expect(after.debts).toEqual([]);
  });

  it('renewed once run out, gives 30 days from today again', () => {
    const { state: after } = renewed(atTheGym(DAY - 3));
    expect(after.possessions.gymMembershipUntilDay).toBe(DAY + ECONOMY.gymMembershipDays - 1);
    expect(gymRefusal(after, BATHHOUSE)).toBeNull();
  });

  it('renewed early, adds the 30 days on after the days already paid for', () => {
    const { state: after } = renewed(atTheGym(DAY + 4));
    expect(after.possessions.gymMembershipUntilDay).toBe(DAY + 4 + ECONOMY.gymMembershipDays);
  });

  it('the Character cannot afford changes nothing and owes nothing', () => {
    const broke: GameState = { ...atTheGym(DAY - 1), character: { ...atTheGym().character, moneyInShifts: membershipPrice / 2 } };
    const { state: after, result } = renewed(broke);
    expect(result).toEqual({ kind: 'cannot_afford' });
    expect(after).toBe(broke);
  });
});

describe('the bathhouse (#21): admit', () => {
  const { buyBathEntry } = INTERACTIONS;
  const atTheBath = (): GameState => ({ ...atTheGym(null), clock: { day: DAY, minuteOfDay: 12 * HOUR } });

  it('charges the entry price and lifts Mood by the bathhouse Comfort Purchase, on top of the success', () => {
    const before = atTheBath();
    const { state: after, result } = applyInteractionOutcome(before, buyBathEntry, { kind: 'success', args: { options: ['towel'] } });
    const entry = menuPrice('bath-entry', 'ja');
    expect(after.character.moneyInShifts).toBeCloseTo(before.character.moneyInShifts - entry);
    expect(after.character.mood).toBe(before.character.mood + MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.bathhouse);
    expect(result).toMatchObject({ kind: 'success', paidInShifts: entry, served: [{ name: CULTURE_PACKS.ja.goods['bath-entry'].name }] });
    expect(after.possessions.inventory).toEqual([]);
  });

  it('is the biggest Mood lift of the Comfort Purchases', () => {
    const { bathhouse, ...others } = MOOD.changes.comfortPurchase;
    expect(bathhouse).toBeGreaterThan(Math.max(...Object.values(others)));
  });

  it('the Character cannot afford changes nothing', () => {
    const broke: GameState = { ...atTheBath(), character: { ...atTheBath().character, moneyInShifts: 0 } };
    expect(applyInteractionOutcome(broke, buyBathEntry, { kind: 'success', args: { options: [] } }).result).toEqual({ kind: 'cannot_afford' });
  });
});
