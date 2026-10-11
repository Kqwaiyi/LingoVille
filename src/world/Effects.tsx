import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
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
 * What the camera does with the light: ambient occlusion, bloom on the lamps, then tone mapping (Khronos PBR Neutral,
 * which keeps the palette's colours as they are and only rolls off the brightest) and anti-aliasing.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO ref={ignoreTransparency} quality="medium" aoRadius={AO.radius} distanceFalloff={AO.falloff} intensity={AO.intensity} color={WORLD_COLOURS[AO.colour]} />
      <Bloom mipmapBlur luminanceThreshold={BLOOM.threshold} luminanceSmoothing={BLOOM.smoothing} intensity={BLOOM.intensity} radius={BLOOM.radius} levels={BLOOM.levels} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  );
}
