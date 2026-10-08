import { KeyboardControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense } from 'react';
import { selectScreen, useGame } from '../store/index.ts';
import { CONTROLS } from './controls.ts';
import { Character } from './Character.tsx';
import { TitleShowcase } from './TitleShowcase.tsx';
import { Town } from './Town.tsx';
import { PALETTE } from './palette.ts';

const SKY = PALETTE.sky;
/** Gentle distance fog, into the sky's colour: the street clear, the far end of town softened. No weather. */
const FOG = { near: 35, far: 95 } as const;

/** Advances game time once per rendered frame. */
function ClockDriver() {
  const advance = useGame((s) => s.advance);
  useFrame((_, delta) => advance(delta * 1000));
  return null;
}

/** The live town: behind the title screen, and then the game itself. */
export function Scene() {
  const screen = useGame(selectScreen);
  return (
    <KeyboardControls map={CONTROLS}>
      <Canvas shadows="percentage" camera={{ fov: 55, position: [-10, 5, 7] }}>
        <color attach="background" args={[SKY]} />
        <fog attach="fog" args={[SKY, FOG.near, FOG.far]} />
        <hemisphereLight args={[PALETTE.white, PALETTE.leaf, 1.2]} />
        <directionalLight position={[12, 20, 8]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30, 1, 60]} />
        </directionalLight>
        <ClockDriver />
        <Suspense fallback={null}>
          <Physics>
            <Town />
            {screen === 'playing' ? <Character /> : <TitleShowcase />}
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}
