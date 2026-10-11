import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useRef, useState } from 'react';
import { afterWindow, GRAPHICS_LEVELS, GRAPHICS_TUNING, START } from './graphicsLevel.ts';
import { WORLD_COLOURS, type WorldColour } from './palette.ts';

/**
 * Ambient occlusion: the soft darkening where walls meet the ground, under eaves and round furniture. How far round
 * each point it looks (metres), how quickly it fades with distance, how dark it gets and in what colour.
 */
const AO: { radius: number; falloff: number; intensity: number; colour: WorldColour } = { radius: 1.4, falloff: 0.6, intensity: 2.4, colour: 'navy' };

/**
 * Bloom, on lamplight alone: only what's brighter than `threshold` glows, and nothing in the town is lit that bright
 * but the lamplight material once night falls (`lampGlow` in `Lighting`). Sunlit walls and the sky stay under it.
 */
const BLOOM = { threshold: 1.3, smoothing: 0.25, intensity: 0.6, radius: 0.6, levels: 6 } as const;

/** The part of N8AO's pass used here (`n8ao` ships no types). */
type AmbientOcclusionPass = { autoDetectTransparency: boolean };

/**
 * Nothing see-through needs ambient occlusion of its own (the pools of light under the lamps, the stars), so N8AO
 * needn't switch to drawing the scene twice more each frame for them.
 */
function ignoreTransparency(pass: AmbientOcclusionPass | null) {
  if (pass) pass.autoDetectTransparency = false;
}

/**
 * The graphics level for this computer (`graphicsLevel.ts`): the frames are timed in windows, and each window's frame
 * rate may move the level down. The pixel ratio follows the level.
 */
function useGraphicsLevel() {
  const [tuner, setTuner] = useState(START);
  const setDpr = useThree((s) => s.setDpr);
  const frames = useRef({ from: performance.now() + GRAPHICS_TUNING.warmUpMs, times: [] as number[] });
  useFrame(() => {
    const now = performance.now();
    const timing = frames.current;
    if (tuner.settled || now < timing.from) return;
    if (now - (timing.times.at(-1) ?? now) > GRAPHICS_TUNING.hitchMs) timing.times = [];
    timing.times.push(now);
    const span = now - timing.times[0]!;
    if (span < GRAPHICS_TUNING.windowMs) return;
    const fps = ((timing.times.length - 1) * 1000) / span;
    const next = afterWindow(tuner, fps);
    timing.times = [];
    if (next === tuner) return;
    if (next.level !== tuner.level) {
      timing.from = now + GRAPHICS_TUNING.settleMs;
      if (import.meta.env.DEV) console.info(`[graphics] ${Math.round(fps)} fps at level ${tuner.level}: level ${next.level} now`);
    }
    setTuner(next);
  });
  const level = GRAPHICS_LEVELS[tuner.level]!;
  useEffect(() => setDpr([1, level.maxPixelRatio]), [setDpr, level.maxPixelRatio]);
  return level;
}

/**
 * What the camera does with the light: ambient occlusion, bloom on the lamps, then tone mapping (Khronos PBR Neutral,
 * which keeps the palette's colours as they are and only rolls off the brightest) and anti-aliasing. On a graphics card
 * that can't keep up, ambient occlusion and then resolution give way.
 */
export function Effects() {
  const { ambientOcclusion } = useGraphicsLevel();
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {ambientOcclusion ? (
        <N8AO ref={ignoreTransparency} quality="medium" aoRadius={AO.radius} distanceFalloff={AO.falloff} intensity={AO.intensity} color={WORLD_COLOURS[AO.colour]} />
      ) : (
        <></>
      )}
      <Bloom mipmapBlur luminanceThreshold={BLOOM.threshold} luminanceSmoothing={BLOOM.smoothing} intensity={BLOOM.intensity} radius={BLOOM.radius} levels={BLOOM.levels} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
}
