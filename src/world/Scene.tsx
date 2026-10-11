import { KeyboardControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense } from 'react';
import { selectScreen, useGame } from '../store/index.ts';
import { CONTROLS } from './controls.ts';
import { Character } from './Character.tsx';
import { Effects } from './Effects.tsx';
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
      {/* No multisampling of its own: the frame is drawn into the effects' buffers, which anti-alias it at the end. */}
      <Canvas shadows="percentage" gl={{ antialias: false }} camera={{ fov: 55, position: [-10, 5, 7] }}>
        <Lighting />
        <ClockDriver />
        <Suspense fallback={null}>
          <Physics>
            <Town />
            {screen === 'playing' ? <Character /> : <TitleShowcase />}
          </Physics>
        </Suspense>
        <Effects />
      </Canvas>
    </KeyboardControls>
  );
}
