import { CLOCK, DAYLIGHT } from './tuning.ts';

/** The four keyframed lighting presets a day passes through. */
export type LightingPreset = (typeof DAYLIGHT.keyframes)[number]['preset'];

/** How the town is lit at one moment of the day. */
export type Daylight = {
  /** The preset this moment blends from, the one it blends into, and how far along (0 is all `from`, 1 all `to`). */
  from: LightingPreset;
  to: LightingPreset;
  blend: number;
  /**
   * Where the light that casts shadows comes from: the sun by day, the moon by night. Its azimuth is in radians round
   * the sky from east (0) through south (π/2), west (π) and north (3π/2); its elevation, in radians above the horizon.
   */
  keyLight: { sun: boolean; azimuth: number; elevation: number };
  /** The street lights and the windows of open places: on from dusk until after dawn. */
  lampsOn: boolean;
};

/** The minutes from `from` on to `to`, going forward round the clock. */
const minutesOnFrom = (from: number, to: number) => (((to - from) % CLOCK.minutesPerDay) + CLOCK.minutesPerDay) % CLOCK.minutesPerDay;
/** This minute of the day falls from `from` up to `to`, which may run on past midnight. */
const isBetween = (minuteOfDay: number, from: number, to: number) => minutesOnFrom(from, minuteOfDay) < minutesOnFrom(from, to);

/**
 * The sun rises in the east, crosses the southern sky and sets in the west. The moon carries on from there, round the
 * northern sky and back to the east by sunrise, so the light hands over from one to the other without a jump.
 */
function keyLight(minuteOfDay: number): Daylight['keyLight'] {
  const { sunriseAt, sunsetAt, sunHighestElevation, moonHighestElevation, lowestElevation } = DAYLIGHT;
  const sun = isBetween(minuteOfDay, sunriseAt, sunsetAt);
  const [risesAt, setsAt, highest] = sun ? [sunriseAt, sunsetAt, sunHighestElevation] : [sunsetAt, sunriseAt, moonHighestElevation];
  const across = minutesOnFrom(risesAt, minuteOfDay) / minutesOnFrom(risesAt, setsAt);
  return {
    sun,
    azimuth: Math.PI * (sun ? across : 1 + across),
    elevation: Math.max(lowestElevation, highest * Math.sin(Math.PI * across)),
  };
}

/**
 * The lighting at this minute of the day: the last preset's keyframe passed, how far on towards the next, the key light
 * and whether the lamps are on.
 */
export function daylight(minuteOfDay: number): Daylight {
  const frames = DAYLIGHT.keyframes;
  // The last keyframe at or before now; before the first of the day, that's yesterday's last.
  const index = frames.findLastIndex((k) => k.at <= minuteOfDay);
  const from = frames.at(index)!;
  const to = frames[(index + 1) % frames.length]!;
  const blend = minutesOnFrom(from.at, minuteOfDay) / minutesOnFrom(from.at, to.at);
  const lampsOn = isBetween(minuteOfDay, DAYLIGHT.lampsOnAt, DAYLIGHT.lampsOffAt);
  return { from: from.preset, to: to.preset, blend, keyLight: keyLight(minuteOfDay), lampsOn };
}
