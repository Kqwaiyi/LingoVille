import { describe, expect, it } from 'vitest';
import { CLOCK, daylight, DAYLIGHT } from './index.ts';

const keyframe = (preset: string) => DAYLIGHT.keyframes.find((k) => k.preset === preset)!.at;
/** Halfway from one minute of the day on to another, round midnight if need be. */
const halfwayOn = (from: number, to: number) => {
  const span = (to - from + CLOCK.minutesPerDay) % CLOCK.minutesPerDay;
  return (from + span / 2) % CLOCK.minutesPerDay;
};
const [dusk, beforeDawn] = DAYLIGHT.keyframes.filter((k) => k.preset === 'night').map((k) => k.at).sort((a, b) => b - a);
const deepNight = halfwayOn(dusk!, beforeDawn!);

describe('daylight', () => {
  it('shows each of the four presets in full at its own time of day', () => {
    for (const preset of ['morning', 'midday', 'goldenHour'] as const) {
      expect(daylight(keyframe(preset))).toMatchObject({ from: preset, blend: 0 });
    }
    expect(daylight(deepNight)).toMatchObject({ from: 'night', to: 'night' });
  });

  it('blends from one preset to the next between their times', () => {
    const halfway = halfwayOn(keyframe('morning'), keyframe('midday'));
    expect(daylight(halfway)).toMatchObject({ from: 'morning', to: 'midday' });
    expect(daylight(halfway).blend).toBeCloseTo(0.5);
  });

  it('has the sun rise in the east, stand highest at midday and set in the west', () => {
    const east = 0;
    const west = Math.PI;
    expect(daylight(DAYLIGHT.sunriseAt).keyLight.azimuth).toBeCloseTo(east);
    expect(daylight(DAYLIGHT.sunsetAt).keyLight.azimuth).toBeCloseTo(west);
    const middle = halfwayOn(DAYLIGHT.sunriseAt, DAYLIGHT.sunsetAt);
    expect(daylight(middle).keyLight.elevation).toBeCloseTo(DAYLIGHT.sunHighestElevation);
    expect(daylight(middle).keyLight.sun).toBe(true);
  });

  it('has the moon carry on from where the sun set, round the north and back to where it rises', () => {
    const north = (3 * Math.PI) / 2;
    const middle = halfwayOn(DAYLIGHT.sunsetAt, DAYLIGHT.sunriseAt);
    expect(daylight(middle).keyLight).toMatchObject({ sun: false, elevation: DAYLIGHT.moonHighestElevation });
    expect(daylight(middle).keyLight.azimuth).toBeCloseTo(north);
  });

  it('switches the lamps on at dusk and off after dawn', () => {
    const { lampsOnAt, lampsOffAt } = DAYLIGHT;
    expect(daylight(lampsOnAt - 1).lampsOn).toBe(false);
    expect(daylight(lampsOnAt).lampsOn).toBe(true);
    expect(daylight(halfwayOn(lampsOnAt, lampsOffAt)).lampsOn).toBe(true);
    expect(daylight(lampsOffAt - 1).lampsOn).toBe(true);
    expect(daylight(lampsOffAt).lampsOn).toBe(false);
    expect(daylight(keyframe('midday')).lampsOn).toBe(false);
  });

  it('moves the key light smoothly all day, never down to the ground', () => {
    const smallStep = 0.02;
    let last = daylight(0).keyLight;
    for (let minute = 1; minute <= CLOCK.minutesPerDay; minute++) {
      const now = daylight(minute % CLOCK.minutesPerDay).keyLight;
      expect(now.elevation).toBeGreaterThanOrEqual(DAYLIGHT.lowestElevation);
      expect(Math.abs(now.elevation - last.elevation)).toBeLessThan(smallStep);
      const turned = Math.abs(now.azimuth - last.azimuth) % (2 * Math.PI);
      expect(Math.min(turned, 2 * Math.PI - turned)).toBeLessThan(smallStep);
      last = now;
    }
  });
});
