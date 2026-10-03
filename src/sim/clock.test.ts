import { describe, expect, it } from 'vitest';
import { CLOCK, gameMinutesFor, weekdayOf } from './index.ts';

describe('gameMinutesFor', () => {
  it('turns one real minute into one game hour at normal speed', () => {
    // Fed in frame-sized steps, since a single delta is capped.
    let minutes = 0;
    for (let i = 0; i < 60 * 4; i++) minutes += gameMinutesFor(250, CLOCK.timeScale.normal);
    expect(minutes).toBeCloseTo(60);
  });

  it('caps a long real delta, so a stalled frame never jumps the clock', () => {
    expect(gameMinutesFor(5_000, CLOCK.timeScale.normal)).toBe(
      gameMinutesFor(CLOCK.maxRealDeltaMs, CLOCK.timeScale.normal),
    );
  });

  it('stops time at scale 0', () => {
    expect(gameMinutesFor(100, CLOCK.timeScale.paused)).toBe(0);
  });

  it('scales time by the given scale', () => {
    expect(gameMinutesFor(100, CLOCK.timeScale.conversation)).toBeCloseTo(
      gameMinutesFor(100, CLOCK.timeScale.normal) * CLOCK.timeScale.conversation,
    );
  });
});

describe('weekdayOf', () => {
  it('starts day 1 on a Monday and repeats every week', () => {
    expect(weekdayOf(1)).toBe('monday');
    expect(weekdayOf(7)).toBe('sunday');
    expect(weekdayOf(8)).toBe('monday');
  });
});
