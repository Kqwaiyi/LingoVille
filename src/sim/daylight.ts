import { CLOCK, DAYLIGHT } from './tuning.ts';

/** The four keyframed lighting presets a day passes through. */
export type LightingPreset = (typeof DAYLIGHT.keyframes)[number]['preset'];

/** Where something stands in the sky: in radians round from east (0) through south (π/2), and above the horizon (below it if negative). */
export type SkyPosition = { azimuth: number; elevation: number };

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
  /** Where the sun stands, for drawing it: where the key light is by day, but free to sink below the horizon. */
  sun: SkyPosition;
  /** Where the moon stands, for drawing it: where the key light is at night, but free to sink below the horizon. */
  moon: SkyPosition;
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
 * The sun and the moon, for drawing the sky. The sun rises in the east, crosses the southern sky and sets in the west,
 * then carries on round below the northern horizon. The moon rides above it all night, where the key light is, and
 * below it all day.
 */
function sunAndMoon(minuteOfDay: number): Pick<Daylight, 'sun' | 'moon'> {
  const { sunriseAt, sunsetAt, sunHighestElevation, moonHighestElevation } = DAYLIGHT;
  const day = isBetween(minuteOfDay, sunriseAt, sunsetAt);
  const [from, to] = day ? [sunriseAt, sunsetAt] : [sunsetAt, sunriseAt];
  // Half a turn round the sky by day, and the other half by night.
  const round = Math.PI * ((day ? 0 : 1) + minutesOnFrom(from, minuteOfDay) / minutesOnFrom(from, to));
  return {
    sun: { azimuth: round, elevation: sunHighestElevation * Math.sin(round) },
    moon: { azimuth: round, elevation: -moonHighestElevation * Math.sin(round) },
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
  return { from: from.preset, to: to.preset, blend, keyLight: keyLight(minuteOfDay), ...sunAndMoon(minuteOfDay), lampsOn };
}
