import { KeyboardControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense } from 'react';
import { selectScreen, useGame } from '../store/index.ts';
import { CONTROLS } from './controls.ts';
import { Character } from './Character.tsx';
import { TitleShowcase } from './TitleShowcase.tsx';
import { Town } from './Town.tsx';
import { Lighting } from './Lighting.tsx';

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
        <Lighting />
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
