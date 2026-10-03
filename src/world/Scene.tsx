import { KeyboardControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense } from 'react';
import { useGame } from '../store/index.ts';
import { CONTROLS } from './controls.ts';
import { Character } from './Character.tsx';
import { Town } from './Town.tsx';

const SKY = '#cfe3f2';

/** Advances game time once per rendered frame. */
function ClockDriver() {
  const advance = useGame((s) => s.advance);
  useFrame((_, delta) => advance(delta * 1000));
  return null;
}

export function Scene() {
  return (
    <KeyboardControls map={CONTROLS}>
      <Canvas shadows="percentage" camera={{ fov: 55, position: [-10, 5, 7] }}>
        <color attach="background" args={[SKY]} />
        <fog attach="fog" args={[SKY, 30, 70]} />
        <hemisphereLight args={['#fff6e5', '#8fa58a', 1.2]} />
        <directionalLight position={[12, 20, 8]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30, 1, 60]} />
        </directionalLight>
        <ClockDriver />
        <Suspense fallback={null}>
          <Physics>
            <Town />
            <Character />
          </Physics>
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}
