import { KeyboardControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Group, Mesh, SkinnedMesh } from 'three';
import { useGame } from '../store/index.ts';
import { CONTROLS } from './controls.ts';
import { Character } from './Character.tsx';
import { Effects } from './Effects.tsx';
import { Town } from './Town.tsx';
import { Lighting } from './Lighting.tsx';

/** Advances game time once per rendered frame. */
function ClockDriver() {
  const advance = useGame((s) => s.advance);
  useFrame((_, delta) => advance(delta * 1000));
  return null;
}

/** How many of the town's materials come into view each frame as it first appears, so each frame compiles only a few. */
const REVEAL_PER_FRAME = 4;

/**
 * Brings what it holds into view a few materials at a time, once their shaders have been compiled (in parallel, off the
 * page's main thread, where the browser can: `compileAsync`). Drawn all at once, the town's first frame would compile
 * every shader it has in one go, holding the page up for a second or more; this way the page opens first and keeps
 * answering while the town comes in, over a few frames. (Figures, which hide parts of themselves, are left as they are.)
 */
function Precompiled({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  const { gl, camera, scene } = useThree();
  const reveal = useRef<{ ready: boolean; waiting: Mesh[][] }>({ ready: false, waiting: [] });
  useLayoutEffect(() => {
    const byMaterial = new Map<unknown, Mesh[]>();
    group.current!.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh || (mesh as SkinnedMesh).isSkinnedMesh || !mesh.visible) return;
      mesh.visible = false;
      (byMaterial.get(mesh.material) ?? byMaterial.set(mesh.material, []).get(mesh.material)!).push(mesh);
    });
    const state = { ready: false, waiting: [...byMaterial.values()] };
    reveal.current = state;
    void gl.compileAsync(group.current!, camera, scene).then(() => void (state.ready = true));
    return () => state.waiting.flat().forEach((mesh) => (mesh.visible = true));
  }, [gl, camera, scene]);
  useFrame(() => {
    const { ready, waiting } = reveal.current;
    if (!ready || waiting.length === 0) return;
    for (const mesh of waiting.splice(0, REVEAL_PER_FRAME).flat()) mesh.visible = true;
  });
  return <group ref={group}>{children}</group>;
}

/** The live town, with the Character in it. */
export function Scene() {
  return (
    <KeyboardControls map={CONTROLS}>
      {/* No multisampling of its own: the frame is drawn into the effects' buffers, which anti-alias it at the end.
          The near plane at 0.3 m, not three's 0.1: depth is three times finer at every distance, so surfaces a few
          millimetres apart (paint on a platform, a path on the lawn) stay apart even from the aerial views. The follow
          camera stands 7 m off the Character, so nothing it looks at comes near the plane. */}
      <Canvas shadows="percentage" gl={{ antialias: false }} camera={{ fov: 55, position: [-10, 5, 7], near: 0.3 }}>
        <Lighting />
        <ClockDriver />
        <Suspense fallback={null}>
          <Physics>
            <Precompiled>
              <Town />
            </Precompiled>
            <Character />
          </Physics>
        </Suspense>
        <Effects />
      </Canvas>
    </KeyboardControls>
  );
}
