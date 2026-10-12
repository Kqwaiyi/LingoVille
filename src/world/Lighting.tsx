import { useFrame, useThree, type Camera } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  CubeCamera,
  CubeUVReflectionMapping,
  HalfFloatType,
  MathUtils,
  Mesh,
  PMREMGenerator,
  Scene,
  ShaderChunk,
  SphereGeometry,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderTarget,
  type DirectionalLight,
  type PointLight,
  type Fog,
  type HemisphereLight,
  type WebGLRenderer,
} from 'three';
import type { LightingPreset, SkyPosition } from '../sim/index.ts';
import { gameStore, selectDaylight, selectLampsOn } from '../store/index.ts';
import { characterPosition } from './Character.tsx';
import { LAMP_SPOTS, nearestLamps, type LampKind } from './lamps.ts';
import { setLampGlow, setWaterTime } from './materials.ts';
import { WORLD_COLOURS, type WorldColour } from './palette.ts';
import { createSkyLook, Sky, skyMaterial, updateSky, type SkyLook } from './Sky.tsx';

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
  /** How brightly the sky lights the town from all round (its reflections in glass and water included). */
  skyIntensity: number;
  /** The clouds' sunlit and shaded sides, and how much of the sky they cover. */
  cloudLight: WorldColour;
  cloudShade: WorldColour;
  clouds: number;
  /** How brightly lit windows and street lights glow: faint by day, and bright enough to bloom at night. */
  lampGlow: number;
};

/** The four keyframed looks of the day, all in palette colours. `daylight` says which two to blend and how far. */
const PRESETS: Record<LightingPreset, Preset> = {
  morning: {
    zenith: 'cornflower', horizon: 'mist', haze: 'mist', sunDisc: 'white', sunGlow: 'butter', glow: 0.6, moon: 0, stars: 0,
    key: 'butter', keyIntensity: 4.2, skyLight: 'sky', groundLight: 'sand', ambientIntensity: 0.25, skyIntensity: 0.6,
    cloudLight: 'white', cloudShade: 'mauve', clouds: 0.45, lampGlow: 1.2,
  },
  midday: {
    zenith: 'azure', horizon: 'mist', haze: 'mist', sunDisc: 'white', sunGlow: 'white', glow: 0.45, moon: 0, stars: 0,
    key: 'sunlight', keyIntensity: 4.4, skyLight: 'sky', groundLight: 'sand', ambientIntensity: 0.2, skyIntensity: 0.65,
    cloudLight: 'white', cloudShade: 'cornflower', clouds: 0.5, lampGlow: 1,
  },
  goldenHour: {
    zenith: 'cornflower', horizon: 'peach', haze: 'peach', sunDisc: 'lamplight', sunGlow: 'apricot', glow: 0.85, moon: 0, stars: 0,
    key: 'lamplight', keyIntensity: 4.6, skyLight: 'blush', groundLight: 'peach', ambientIntensity: 0.2, skyIntensity: 0.6,
    cloudLight: 'apricot', cloudShade: 'mauve', clouds: 0.55, lampGlow: 2,
  },
  night: {
    zenith: 'navy', horizon: 'indigo', haze: 'indigo', sunDisc: 'white', sunGlow: 'mauve', glow: 0, moon: 1, stars: 1,
    key: 'moonlight', keyIntensity: 0.9, skyLight: 'moonlight', groundLight: 'charcoal', ambientIntensity: 0.12, skyIntensity: 0.55,
    cloudLight: 'indigo', cloudShade: 'navy', clouds: 0.35, lampGlow: 4,
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

/**
 * The sky as the town's surfaces see it: drawn without the sun's and moon's discs (the key light is the sun) into a
 * small cube round the town every few frames, then prefiltered so rough surfaces take the sky's light from all round it
 * and smooth ones (glass, water, polish) mirror it. How many frames between, and the cube's size. The prefiltering's
 * shader is slow to compile, so it waits until the town has been on screen a moment (`startAfterFrames`), and its light
 * comes up over `fadeSeconds`; till then the town's materials see a dark stand-in of the same shape, so they're
 * compiled for it once, from the start.
 */
const ENVIRONMENT = { everyFrames: 45, size: 64, startAfterFrames: 150, fadeSeconds: 1.5 } as const;

/** A stand-in for the prefiltered sky, shaped as `PMREMGenerator` shapes its own (r186): dark until the sky's ready. */
function prefilteredStandIn(size: number) {
  const target = new WebGLRenderTarget(3 * Math.max(size, 16 * 7), 4 * size, { type: HalfFloatType, generateMipmaps: false, depthBuffer: false });
  target.texture.mapping = CubeUVReflectionMapping;
  target.texture.name = 'PMREM.cubeUv';
  return target;
}

/** Keeps the scene's environment light (`scene.environment`) to the sky `look` shows. */
function useSkyEnvironment(look: SkyLook) {
  const gl = useThree((state) => state.gl) as WebGLRenderer;
  const scene = useThree((state) => state.scene);
  const environment = useMemo(() => {
    const sky = skyMaterial(look, false);
    const world = new Scene().add(new Mesh(new SphereGeometry(1, 32, 16), sky));
    const cube = new WebGLCubeRenderTarget(ENVIRONMENT.size, { type: HalfFloatType });
    const camera = new CubeCamera(0.1, 10, cube);
    const standIn = prefilteredStandIn(ENVIRONMENT.size);
    return { sky, world, cube, camera, standIn, pmrem: null as PMREMGenerator | null, target: null as WebGLRenderTarget | null, frame: 0, fade: 0 };
  }, [look]);
  useEffect(() => {
    scene.environment = environment.standIn.texture;
    return () => {
      scene.environment = null;
      environment.standIn.dispose();
      environment.target?.dispose();
      environment.cube.dispose();
      environment.pmrem?.dispose();
    };
  }, [scene, environment]);
  return (time: number, intensity: number, delta: number) => {
    const frame = environment.frame++;
    if (frame < ENVIRONMENT.startAfterFrames) {
      scene.environmentIntensity = 0;
      return;
    }
    environment.fade = Math.min(1, environment.fade + delta / ENVIRONMENT.fadeSeconds);
    scene.environmentIntensity = intensity * environment.fade;
    if ((frame - ENVIRONMENT.startAfterFrames) % ENVIRONMENT.everyFrames !== 0) return;
    updateSky(environment.sky, look, time);
    environment.camera.update(gl, environment.world);
    if (!environment.pmrem) {
      environment.pmrem = new PMREMGenerator(gl);
      environment.target = environment.pmrem.fromCubemap(environment.cube.texture);
      scene.environment = environment.target.texture;
    } else environment.pmrem.fromCubemap(environment.cube.texture, environment.target);
  };
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
 * Real light from the lamps nearest the Character, from dusk: this many at once (the rest only glow), how bright each
 * kind is (candela) and how far it reaches (metres), and how often the nearest are found again (frames). They come up
 * and go down over a second or so as the lamps go on and off, and as the Character walks from one to the next.
 */
const LAMPLIGHT: { count: number; everyFrames: number; fade: number; kinds: Record<LampKind, { intensity: number; distance: number }> } = {
  count: 4,
  everyFrames: 12,
  fade: 2.5,
  kinds: {
    street: { intensity: 14, distance: 11 },
    door: { intensity: 3, distance: 6 },
    shelter: { intensity: 6, distance: 7 },
    room: { intensity: 9, distance: 9 },
    lamp: { intensity: 3, distance: 5 },
  },
};

/** The pool of lamplights, moved to the lamps nearest the Character. */
function Lamplight() {
  const lights = useRef<(PointLight | null)[]>([]);
  const state = useMemo(() => ({ frame: 0, targets: [] as number[] }), []);
  useFrame((_, delta) => {
    const on = selectLampsOn(gameStore.getState());
    if (state.frame++ % LAMPLIGHT.everyFrames === 0) {
      const nearest = nearestLamps(LAMP_SPOTS, [characterPosition.x, characterPosition.y, characterPosition.z], LAMPLIGHT.count);
      nearest.forEach(({ at, kind }, i) => {
        const light = lights.current[i];
        if (!light) return;
        if (light.position.distanceToSquared(scratch.ahead.set(...at)) > 0.01) light.intensity = 0;
        light.position.set(...at);
        light.distance = LAMPLIGHT.kinds[kind].distance;
        state.targets[i] = LAMPLIGHT.kinds[kind].intensity;
      });
    }
    lights.current.forEach((light, i) => {
      if (!light) return;
      const wanted = on ? (state.targets[i] ?? 0) : 0;
      light.intensity += (wanted - light.intensity) * Math.min(1, LAMPLIGHT.fade * delta);
    });
  });
  return Array.from({ length: LAMPLIGHT.count }, (_, i) => (
    <pointLight key={i} ref={(light) => void (lights.current[i] = light)} color={WORLD_COLOURS.lamplight} intensity={0} decay={2} />
  ));
}

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
  const lightTheTown = useSkyEnvironment(look);
  useFrame(({ camera, clock }, delta) => {
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
    blendColour(look.cloudLight, a.cloudLight, b.cloudLight, blend);
    blendColour(look.cloudShade, a.cloudShade, b.cloudShade, blend);
    look.clouds = lerp(a.clouds, b.clouds, blend);
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
    setWaterTime(clock.elapsedTime);
    lightTheTown(clock.elapsedTime, lerp(a.skyIntensity, b.skyIntensity, blend), delta);
  });
  const { reach, distance, mapSize, softness, normalBias } = SHADOWS;
  return (
    <>
      <fog ref={fog} attach="fog" args={[WORLD_COLOURS.mist, FOG.near, FOG.far]} />
      <Sky look={look} />
      <hemisphereLight ref={ambient} />
      <Lamplight />
      <directionalLight ref={key} castShadow shadow-mapSize={[mapSize, mapSize]} shadow-radius={softness} shadow-normalBias={normalBias}>
        <orthographicCamera attach="shadow-camera" args={[-reach, reach, reach, -reach, 1, distance + reach * 2]} />
      </directionalLight>
    </>
  );
}
