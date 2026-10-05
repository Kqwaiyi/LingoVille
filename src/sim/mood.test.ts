import { describe, expect, it } from 'vitest';
import { METER_MAX, MOOD, MOOD_FACES, moodFace, moodModifier } from './index.ts';

describe('moodModifier', () => {
  it('runs from the low end at Mood 0 to the high end at full Mood', () => {
    expect(moodModifier(0)).toBe(MOOD.modifier.atZero);
    expect(moodModifier(METER_MAX)).toBe(MOOD.modifier.atMax);
  });

  it('is linear in between', () => {
    expect(moodModifier(METER_MAX / 2)).toBeCloseTo((MOOD.modifier.atZero + MOOD.modifier.atMax) / 2);
    expect(moodModifier(METER_MAX / 4)).toBeCloseTo((3 * MOOD.modifier.atZero + MOOD.modifier.atMax) / 4);
  });

  it('cuts pay and XP when Mood is low and adds to them when it is high', () => {
    expect(moodModifier(0)).toBeLessThan(1);
    expect(moodModifier(METER_MAX)).toBeGreaterThan(1);
  });
});

describe('moodFace', () => {
  it('shows the worst face at Mood 0 and the best at full Mood', () => {
    expect(moodFace(0)).toBe(MOOD_FACES[0]);
    expect(moodFace(METER_MAX)).toBe(MOOD_FACES.at(-1));
  });

  it('shows the middle face at neutral Mood, as on the First Morning', () => {
    expect(moodFace(MOOD.neutral)).toBe('okay');
  });

  it('changes face exactly at each threshold', () => {
    for (const face of MOOD_FACES) {
      expect(moodFace(MOOD.faceFrom[face])).toBe(face);
    }
    expect(moodFace(MOOD.faceFrom.good - 0.01)).toBe('okay');
  });

  it('never looks worse as Mood rises', () => {
    let previousRank = 0;
    for (let mood = 0; mood <= METER_MAX; mood += 0.5) {
      const rank = MOOD_FACES.indexOf(moodFace(mood));
      expect(rank).toBeGreaterThanOrEqual(previousRank);
      previousRank = rank;
    }
  });
});
