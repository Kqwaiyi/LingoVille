import { describe, expect, it } from 'vitest';
import { INTERACTIONS } from '../content/index.ts';
import {
  applyInteractionOutcome,
  createSave,
  LIFE_SKILLS,
  lifeSkillLevel,
  lifeSkillLevels,
  METER_MAX,
  sleep,
  tick,
  type GameState,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const withXp = (xp: Partial<GameState['progression']['lifeSkillXp']>): GameState => {
  const state = createSave(TEST_SETUP);
  return { ...state, progression: { ...state.progression, lifeSkillXp: { ...state.progression.lifeSkillXp, ...xp } } };
};

describe('Life Skill levels', () => {
  it('start at 0 and reach each level at the XP the tuning curve sets', () => {
    expect(lifeSkillLevel(0)).toBe(0);
    LIFE_SKILLS.xpToReachLevel.forEach((xp, level) => {
      expect(lifeSkillLevel(xp)).toBe(level);
      if (level > 0) expect(lifeSkillLevel(xp - 1)).toBe(level - 1);
    });
  });

  it('need more XP for each level than the one before', () => {
    const steps = LIFE_SKILLS.xpToReachLevel.slice(1).map((xp, i) => xp - LIFE_SKILLS.xpToReachLevel[i]!);
    steps.slice(1).forEach((step, i) => expect(step).toBeGreaterThan(steps[i]!));
  });

  it('stop at the top level however much XP there is', () => {
    expect(lifeSkillLevel(LIFE_SKILLS.xpToReachLevel[LIFE_SKILLS.maxLevel]! * 10)).toBe(LIFE_SKILLS.maxLevel);
  });

  it('are read for all five skills', () => {
    const state = withXp({ cooking: LIFE_SKILLS.xpToReachLevel[2]!, server: LIFE_SKILLS.xpToReachLevel[5]! });
    expect(lifeSkillLevels(state)).toEqual({ cooking: 2, fitness: 0, barista: 0, cashier: 0, server: 5 });
  });

  it('never decay: days passing and sleep leave XP alone', () => {
    const state = withXp({ cooking: 123, fitness: 45 });
    const days = tick({ ...state, character: { ...state.character, hunger: METER_MAX, thirst: METER_MAX } }, 60 * 10);
    const slept = sleep({ ...days, clock: { ...days.clock, minuteOfDay: 22 * 60 } });
    expect(slept.progression.lifeSkillXp).toEqual(state.progression.lifeSkillXp);
  });

  it('are never raised by a Goal Interaction, whatever its outcome', () => {
    const state = { ...withXp({ barista: 10 }), placeId: 'cafe' as const };
    const order = { items: [{ item: 'latte', quantity: 1 }] };
    for (const outcome of [{ kind: 'success', args: order }, { kind: 'failure' }, { kind: 'abandon' }] as const) {
      const { state: after } = applyInteractionOutcome(state, INTERACTIONS.orderDrink, outcome);
      expect(after.progression.lifeSkillXp).toEqual(state.progression.lifeSkillXp);
    }
  });
});
