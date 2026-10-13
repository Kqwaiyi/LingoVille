import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import type { AppearancePreset } from '../content/index.ts';
import type { NpcExpression } from '../sim/index.ts';
import { CharacterFigure } from './CharacterFigure.tsx';
import { PALETTE } from './palette.ts';

/**
 * How the portrait frames the face, Clawd's front with both eyes and the brim of a hat: the camera's height and distance
 * in front of it, where it looks and how wide, in metres and degrees.
 */
const FRAMING = { cameraHeight: 1.0, distance: 3.2, lookHeight: 0.86, fov: 22 } as const;

/**
 * The face of whoever the Player is talking to, close up in a little view of its own: Clawd in their look, with their
 * Patience in its eyes. It's the only way Patience shows.
 */
export function NpcPortrait({ appearance, expression }: { appearance: AppearancePreset; expression: NpcExpression }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: FRAMING.fov, position: [0, FRAMING.cameraHeight, FRAMING.distance] }}
      onCreated={({ camera }) => camera.lookAt(0, FRAMING.lookHeight, 0)}
    >
      <hemisphereLight args={[PALETTE.white, PALETTE.leaf, 1.4]} />
      <directionalLight position={[0.6, 2.2, 1.6]} intensity={1.6} />
      <Suspense fallback={null}>
        <CharacterFigure appearance={appearance} expression={expression} />
      </Suspense>
    </Canvas>
  );
}
