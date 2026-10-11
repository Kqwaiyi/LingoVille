// How hard the graphics work, tuned to the computer they run on. The town starts with its full look; while the frames
// come slow, it tries the next cheaper level (`Effects` says what each one drops) and keeps it if the frames come
// faster for it. If they don't, what holds them up isn't the graphics card, so it goes back and stops trying.

/**
 * What each level draws, from the full look (0) down. Ambient occlusion costs a weak graphics card the most, so it
 * goes first; then the pixel ratio comes down to one pixel per CSS pixel.
 */
export const GRAPHICS_LEVELS = [
  { ambientOcclusion: true, maxPixelRatio: 2 },
  { ambientOcclusion: false, maxPixelRatio: 2 },
  { ambientOcclusion: false, maxPixelRatio: 1 },
] as const;

export const GRAPHICS_TUNING = {
  /** Frames slower than this, on average over a window, are too slow. */
  slowBelowFps: 50,
  /** A cheaper level is kept only if the frames come at least this much faster for it. */
  mustSpeedUpBy: 1.15,
  /**
   * How the frames are timed, in milliseconds: not until the town has loaded and settled, nor straight after a change
   * of level; over windows this long; starting a window afresh after a frame this late (a hidden tab, a hitch).
   */
  warmUpMs: 5000,
  settleMs: 1500,
  windowMs: 2500,
  hitchMs: 250,
} as const;

/**
 * Which level the graphics are at; the frame rate of a slow window just before, waiting to see if the next is slow too;
 * while a cheaper level is on trial, the level and frame rate it came from; and whether it has settled, having found a
 * cheaper level no faster.
 */
export type GraphicsLevel = { level: number; slowFps: number | null; trying: { from: number; fps: number } | null; settled: boolean };

export const START: GraphicsLevel = { level: 0, slowFps: null, trying: null, settled: false };

/**
 * The level after a window of frames came at this many frames a second, on average. Two slow windows in a row put the
 * next cheaper level on trial, against the faster of the two, so a single slow one (the town loading) moves nothing.
 */
export function afterWindow(tuner: GraphicsLevel, fps: number): GraphicsLevel {
  const { slowBelowFps, mustSpeedUpBy } = GRAPHICS_TUNING;
  if (tuner.settled) return tuner;
  if (tuner.trying) {
    if (fps < tuner.trying.fps * mustSpeedUpBy) return { level: tuner.trying.from, slowFps: null, trying: null, settled: true };
    return { level: tuner.level, slowFps: null, trying: null, settled: false };
  }
  if (fps >= slowBelowFps || tuner.level === GRAPHICS_LEVELS.length - 1) return tuner.slowFps === null ? tuner : { ...tuner, slowFps: null };
  if (tuner.slowFps === null) return { ...tuner, slowFps: fps };
  return { level: tuner.level + 1, slowFps: null, trying: { from: tuner.level, fps: Math.max(tuner.slowFps, fps) }, settled: false };
}
