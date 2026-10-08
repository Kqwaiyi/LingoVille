import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Color, type DirectionalLight, type Fog, type HemisphereLight } from 'three';
import type { LightingPreset } from '../sim/index.ts';
import { gameStore, selectDaylight } from '../store/index.ts';
import { setLampGlow } from './Kit.tsx';
import { PALETTE, type PaletteColour } from './palette.ts';

/** Gentle distance fog, into the sky's colour: the street clear, the far end of town softened. No weather. */
const FOG = { near: 35, far: 95 } as const;
/** How far from the middle of town the key light shines from: its shadow camera reaches 60 m from there. */
const KEY_LIGHT_DISTANCE = 26;

type Preset = {
  /** The sky, and the fog that fades into it. */
  sky: PaletteColour;
  /** The sun by day or the moon by night: colour and intensity. */
  key: PaletteColour;
  keyIntensity: number;
  /** The light from the sky above and bounced from the ground below. */
  skyLight: PaletteColour;
  groundLight: PaletteColour;
  ambientIntensity: number;
  /** How brightly lit windows and street lights glow: faint by day, standing out at night. */
  lampGlow: number;
};

/** The four keyframed looks of the day, all in palette colours. `daylight` says which two to blend and how far. */
const PRESETS: Record<LightingPreset, Preset> = {
  morning: { sky: 'blush', key: 'butter', keyIntensity: 1.4, skyLight: 'cream', groundLight: 'grass', ambientIntensity: 1.2, lampGlow: 0.5 },
  midday: { sky: 'sky', key: 'white', keyIntensity: 1.6, skyLight: 'white', groundLight: 'leaf', ambientIntensity: 1.2, lampGlow: 0.4 },
  goldenHour: { sky: 'peach', key: 'lamplight', keyIntensity: 1.3, skyLight: 'peach', groundLight: 'grass', ambientIntensity: 1.1, lampGlow: 0.9 },
  night: { sky: 'denim', key: 'sky', keyIntensity: 0.7, skyLight: 'lavender', groundLight: 'slate', ambientIntensity: 1, lampGlow: 1.6 },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const blended = new Color();
/** Sets `target` to the two presets' colours blended. */
function blendColour(target: Color, from: PaletteColour, to: PaletteColour, t: number) {
  target.set(PALETTE[from]).lerp(blended.set(PALETTE[to]), t);
}

/** The sky, fog and lights, following the game clock through morning, midday, golden hour and night. */
export function Lighting() {
  const background = useRef<Color>(null);
  const fog = useRef<Fog>(null);
  const ambient = useRef<HemisphereLight>(null);
  const key = useRef<DirectionalLight>(null);
  useFrame(() => {
    const { from, to, blend, keyLight } = selectDaylight(gameStore.getState());
    const [a, b] = [PRESETS[from], PRESETS[to]];
    blendColour(background.current!, a.sky, b.sky, blend);
    fog.current!.color.copy(background.current!);
    blendColour(ambient.current!.color, a.skyLight, b.skyLight, blend);
    blendColour(ambient.current!.groundColor, a.groundLight, b.groundLight, blend);
    ambient.current!.intensity = lerp(a.ambientIntensity, b.ambientIntensity, blend);
    blendColour(key.current!.color, a.key, b.key, blend);
    key.current!.intensity = lerp(a.keyIntensity, b.keyIntensity, blend);
    // Azimuth 0 is east (+x) and π/2 south (+z).
    const { azimuth, elevation } = keyLight;
    const across = Math.cos(elevation) * KEY_LIGHT_DISTANCE;
    key.current!.position.set(Math.cos(azimuth) * across, Math.sin(elevation) * KEY_LIGHT_DISTANCE, Math.sin(azimuth) * across);
    setLampGlow(lerp(a.lampGlow, b.lampGlow, blend));
  });
  return (
    <>
      <color ref={background} attach="background" args={[PALETTE.sky]} />
      <fog ref={fog} attach="fog" args={[PALETTE.sky, FOG.near, FOG.far]} />
      <hemisphereLight ref={ambient} />
      <directionalLight ref={key} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30, 1, 60]} />
      </directionalLight>
    </>
  );
}
