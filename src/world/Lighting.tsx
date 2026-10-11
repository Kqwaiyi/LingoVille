import { useFrame, type Camera } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, MathUtils, ShaderChunk, Vector3, type DirectionalLight, type Fog, type HemisphereLight } from 'three';
import type { LightingPreset, SkyPosition } from '../sim/index.ts';
import { gameStore, selectDaylight } from '../store/index.ts';
import { setLampGlow } from './Kit.tsx';
import { WORLD_COLOURS, type WorldColour } from './palette.ts';
import { createSkyLook, Sky } from './Sky.tsx';

/**
 * A light haze, into the haze colour below the horizon: none on the town round the camera, a little on the hills and
 * mountains, and all of the land beyond them by the time it reaches the horizon, so its edge never shows. In metres
 * from the camera; three's fog eases in and out between the two.
 */
const FOG = { near: 80, far: 750 } as const;

/**
 * The key light's shadows: how far round their middle they reach (metres), and how far ahead of the camera that middle
 * is, so they cover what the camera sees rather than what's behind it. The light stands this far back along its
 * direction from there, far enough for a tall building's shadow in a low sun. Its shadow map, how soft the shadows'
 * edges are (in shadow-map texels), how far they're nudged off the surfaces they fall on, and where they fade out
 * towards the map's edges (as a share of it), so where they stop never shows as a line.
 */
const SHADOWS = { reach: 42, ahead: 22, distance: 110, mapSize: 2048, softness: 2.5, normalBias: 0.035, edgeFade: 0.15 } as const;

type Preset = {
  /** The sky overhead and along the horizon, and the haze the far hills, mountains and land fade into. */
  zenith: WorldColour;
  horizon: WorldColour;
  haze: WorldColour;
  /** The sun's disc, the glow round it, and how strong that glow is. */
  sunDisc: WorldColour;
  sunGlow: WorldColour;
  glow: number;
  /** How much of the moon and the stars show, from 0 to 1. */
  moon: number;
  stars: number;
  /** The sun by day or the moon by night: colour and intensity. */
  key: WorldColour;
  keyIntensity: number;
  /** The light from the sky above and bounced from the ground below. */
  skyLight: WorldColour;
  groundLight: WorldColour;
  ambientIntensity: number;
  /** How brightly lit windows and street lights glow: faint by day, and bright enough to bloom at night. */
  lampGlow: number;
};

/** The four keyframed looks of the day, all in palette colours. `daylight` says which two to blend and how far. */
const PRESETS: Record<LightingPreset, Preset> = {
  morning: {
    zenith: 'cornflower', horizon: 'mist', haze: 'mist', sunDisc: 'white', sunGlow: 'butter', glow: 0.6, moon: 0, stars: 0,
    key: 'butter', keyIntensity: 3.4, skyLight: 'sky', groundLight: 'sand', ambientIntensity: 1.6, lampGlow: 1.2,
  },
  midday: {
    zenith: 'azure', horizon: 'mist', haze: 'mist', sunDisc: 'white', sunGlow: 'white', glow: 0.45, moon: 0, stars: 0,
    key: 'sunlight', keyIntensity: 3.1, skyLight: 'sky', groundLight: 'sand', ambientIntensity: 1.35, lampGlow: 1,
  },
  goldenHour: {
    zenith: 'cornflower', horizon: 'peach', haze: 'peach', sunDisc: 'lamplight', sunGlow: 'apricot', glow: 0.85, moon: 0, stars: 0,
    key: 'lamplight', keyIntensity: 3.8, skyLight: 'blush', groundLight: 'peach', ambientIntensity: 1.45, lampGlow: 2,
  },
  night: {
    zenith: 'navy', horizon: 'indigo', haze: 'indigo', sunDisc: 'white', sunGlow: 'mauve', glow: 0, moon: 1, stars: 1,
    key: 'moonlight', keyIntensity: 1.1, skyLight: 'moonlight', groundLight: 'charcoal', ambientIntensity: 0.6, lampGlow: 3.5,
  },
};

/**
 * Sunrise and sunset, on top of the presets: while the sun is near the horizon, a glow along it, warm gold as it rises
 * and rose as it sets, strongest as it crosses the horizon. It shows while the sun is within `above` or `below` of the
 * horizon (radians), tints the haze this much and the sunlight this much.
 */
const TWILIGHT: { rising: WorldColour; setting: WorldColour; above: number; below: number; haze: number; sunlight: number } = {
  rising: 'apricot',
  setting: 'rose',
  above: 0.3,
  below: 0.3,
  haze: 0.45,
  sunlight: 0.35,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const blended = new Color();
/** Sets `target` to the two presets' colours blended. */
function blendColour(target: Color, from: WorldColour, to: WorldColour, t: number) {
  target.set(WORLD_COLOURS[from]).lerp(blended.set(WORLD_COLOURS[to]), t);
}

/** Towards this position in the sky. Azimuth 0 is east (+x) and π/2 south (+z). */
function towards(target: Vector3, { azimuth, elevation }: SkyPosition) {
  return target.set(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation));
}

/** How much of sunrise or sunset shows, from 0 to 1: all of it as the sun crosses the horizon. */
function twilightAt({ elevation }: SkyPosition) {
  return 1 - MathUtils.smoothstep(elevation >= 0 ? elevation / TWILIGHT.above : -elevation / TWILIGHT.below, 0, 1);
}

const WORLD_UP = new Vector3(0, 1, 0);
const scratch = { toLight: new Vector3(), across: new Vector3(), up: new Vector3(), middle: new Vector3(), ahead: new Vector3() };

/**
 * Points the key light down `keyLight` onto the ground ahead of the camera. Its middle is snapped to whole shadow-map
 * texels across the light, so the shadows hold still as the camera moves.
 */
function aimKeyLight(light: DirectionalLight, camera: Camera, keyLight: SkyPosition) {
  const { toLight, across, up, middle, ahead } = scratch;
  towards(toLight, keyLight);
  camera.getWorldDirection(ahead).setY(0);
  if (ahead.lengthSq() < 1e-6) ahead.set(0, 0, -1);
  middle.set(camera.position.x, 0, camera.position.z).addScaledVector(ahead.normalize(), SHADOWS.ahead);
  // The shadow camera's own axes: across the light, and up it.
  across.crossVectors(WORLD_UP, toLight).normalize();
  up.crossVectors(toLight, across);
  const texel = (2 * SHADOWS.reach) / SHADOWS.mapSize;
  const snapped = (v: number) => Math.round(v / texel) * texel;
  const [x, y, along] = [snapped(middle.dot(across)), snapped(middle.dot(up)), middle.dot(toLight)];
  middle.copy(across).multiplyScalar(x).addScaledVector(up, y).addScaledVector(toLight, along);
  light.target.position.copy(middle);
  light.target.updateMatrixWorld();
  light.position.copy(middle).addScaledVector(toLight, SHADOWS.distance);
}

/**
 * Fades shadows out towards the edges of the shadow map, where three would otherwise stop them dead in a line across
 * the town. A change to three's own shadow shader, made once before anything is drawn; three is pinned at r186, and a
 * different shader fails here loudly rather than silently losing the fade.
 */
function fadeShadowsAtTheEdges() {
  const marker = '// Faded at the shadow map edges.';
  const chunk = ShaderChunk.shadowmap_pars_fragment;
  if (chunk.includes(marker)) return;
  const pcf = chunk.indexOf('float getShadow( sampler2DShadow');
  const giveBack = 'return mix( 1.0, shadow, shadowIntensity );';
  const at = chunk.indexOf(giveBack, pcf);
  if (pcf < 0 || at < 0) throw new Error('three’s shadow shader has changed: update fadeShadowsAtTheEdges in Lighting.tsx.');
  const faded = `${marker}
			vec2 fromEdges = min( shadowCoord.xy, 1.0 - shadowCoord.xy );
			float fade = smoothstep( 0.0, ${SHADOWS.edgeFade.toFixed(3)}, min( fromEdges.x, fromEdges.y ) );
			return mix( 1.0, shadow, shadowIntensity * fade );`;
  ShaderChunk.shadowmap_pars_fragment = chunk.slice(0, at) + faded + chunk.slice(at + giveBack.length);
}
fadeShadowsAtTheEdges();

/**
 * The sky, haze and lights, following the game clock through morning, midday, golden hour and night, with sunrise and
 * sunset glowing between them.
 */
export function Lighting() {
  const fog = useRef<Fog>(null);
  const ambient = useRef<HemisphereLight>(null);
  const key = useRef<DirectionalLight>(null);
  const look = useMemo(createSkyLook, []);
  const twilight = useMemo(() => new Color(), []);
  useFrame(({ camera }) => {
    const { from, to, blend, keyLight, sun, moon } = selectDaylight(gameStore.getState());
    const [a, b] = [PRESETS[from], PRESETS[to]];

    // Sunrise in the east, sunset in the west: their glow, and how much of it shows.
    const dusk = (1 - Math.cos(sun.azimuth)) / 2;
    blendColour(twilight, TWILIGHT.rising, TWILIGHT.setting, dusk);
    const twilightAmount = twilightAt(sun);

    blendColour(look.zenith, a.zenith, b.zenith, blend);
    blendColour(look.horizon, a.horizon, b.horizon, blend);
    blendColour(look.haze, a.haze, b.haze, blend);
    look.haze.lerp(twilight, twilightAmount * TWILIGHT.haze);
    look.twilight.copy(twilight);
    look.twilightAmount = twilightAmount;
    blendColour(look.sunDisc, a.sunDisc, b.sunDisc, blend);
    blendColour(look.sunGlow, a.sunGlow, b.sunGlow, blend);
    look.glow = lerp(a.glow, b.glow, blend);
    look.moon = lerp(a.moon, b.moon, blend);
    look.stars = lerp(a.stars, b.stars, blend);
    towards(look.sunDirection, sun);
    towards(look.moonDirection, moon);
    fog.current!.color.copy(look.haze);

    blendColour(ambient.current!.color, a.skyLight, b.skyLight, blend);
    blendColour(ambient.current!.groundColor, a.groundLight, b.groundLight, blend);
    ambient.current!.intensity = lerp(a.ambientIntensity, b.ambientIntensity, blend);
    blendColour(key.current!.color, a.key, b.key, blend);
    if (keyLight.sun) key.current!.color.lerp(twilight, twilightAmount * TWILIGHT.sunlight);
    key.current!.intensity = lerp(a.keyIntensity, b.keyIntensity, blend);
    aimKeyLight(key.current!, camera, keyLight);
    setLampGlow(lerp(a.lampGlow, b.lampGlow, blend));
  });
  const { reach, distance, mapSize, softness, normalBias } = SHADOWS;
  return (
    <>
      <fog ref={fog} attach="fog" args={[WORLD_COLOURS.mist, FOG.near, FOG.far]} />
      <Sky look={look} />
      <hemisphereLight ref={ambient} />
      <directionalLight ref={key} castShadow shadow-mapSize={[mapSize, mapSize]} shadow-radius={softness} shadow-normalBias={normalBias}>
        <orthographicCamera attach="shadow-camera" args={[-reach, reach, reach, -reach, 1, distance + reach * 2]} />
      </directionalLight>
    </>
  );
}
