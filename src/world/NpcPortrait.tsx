import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import type { AppearancePreset } from '../content/index.ts';
import type { NpcExpression } from '../sim/index.ts';
import { CharacterFigure } from './CharacterFigure.tsx';

/** How the portrait frames the face: the camera's height and distance in front of it, where it looks and how wide, in metres and degrees. */
const FRAMING = { cameraHeight: 1.6, distance: 0.9, lookHeight: 1.6, fov: 22 } as const;

/**
 * The face of whoever the Player is talking to, close up in a little view of its own: their look on the shared rig,
 * with their Patience on it. It's the only way Patience shows.
 */
export function NpcPortrait({ appearance, expression }: { appearance: AppearancePreset; expression: NpcExpression }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: FRAMING.fov, position: [0, FRAMING.cameraHeight, FRAMING.distance] }}
      onCreated={({ camera }) => camera.lookAt(0, FRAMING.lookHeight, 0)}
    >
      <hemisphereLight args={['#fff6e5', '#8fa58a', 1.4]} />
      <directionalLight position={[0.6, 2.2, 1.6]} intensity={1.6} />
      <Suspense fallback={null}>
        <CharacterFigure appearance={appearance} expression={expression} />
      </Suspense>
    </Canvas>
  );
}
