import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AnimationClip, AnimationMixer, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BODY_PRESETS, HAIR_COLOURS, SKIN_TONES, type AppearancePreset } from '../content/index.ts';
import { CHARACTER_ART_URLS, OPTIONAL_PART, partsOf, type CharacterClip } from './characterArt.ts';

// The shared character rig: Quaternius's base characters and animation library, built by `npm run build:characters`.
// The Character, Named NPCs and Shift Customers all wear it.
useGLTF.preload(CHARACTER_ART_URLS.characters);
useGLTF.preload(CHARACTER_ART_URLS.animations);

/** How fast the jog carries a figure across the ground at its own pace, in metres per second, so its feet keep up. */
export const JOG_METRES_PER_SECOND = 3.1;

/** How long one clip blends into the next, in seconds. */
const BLEND_SECONDS = 0.2;

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

/**
 * Someone on the shared rig, wearing an Appearance Preset and playing a clip from the shared library. Stands on its
 * origin, facing +z.
 */
export function CharacterFigure({ appearance, clip = 'idle', speed = 1 }: { appearance: AppearancePreset; clip?: CharacterClip; speed?: number }) {
  const { scene } = useGLTF(CHARACTER_ART_URLS.characters);
  const { animations } = useGLTF(CHARACTER_ART_URLS.animations);
  // Each build is a scene root of the art, by name; each face a letter on its parts.
  const { build } = BODY_PRESETS[appearance.body];

  const figure = useMemo(() => {
    const figure = clone(scene.getObjectByName(build)!);
    figure.traverse((object) => {
      // The loader numbers names the two builds share; the clips name the bones as the rig does.
      if (typeof object.userData.name === 'string') object.name = object.userData.name;
      if (!isMesh(object)) return;
      // Its own materials, so tinting this figure leaves everyone else as they are.
      object.material = (object.material as Material).clone();
      object.castShadow = true;
    });
    return figure;
  }, [scene, build]);

  useEffect(() => {
    const shown = partsOf(appearance);
    const skin = SKIN_TONES[appearance.skinTone];
    const hair = HAIR_COLOURS[appearance.hairColour];
    figure.traverse((object) => {
      if (!isMesh(object)) return;
      // A mesh with two materials is a group's child: the part is its parent.
      const part = OPTIONAL_PART.test(object.name) ? object.name : object.parent?.name ?? '';
      object.visible = !OPTIONAL_PART.test(part) || shown.has(part);
      const material = object.material as MeshStandardMaterial;
      if (material.name.startsWith('skin')) material.color.set(skin);
      else if (material.name.startsWith('hair')) material.color.set(hair);
    });
  }, [figure, appearance]);

  const mixer = useMemo(() => new AnimationMixer(figure), [figure]);
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  useEffect(() => {
    const action = mixer.clipAction(AnimationClip.findByName(animations, clip)!);
    action.reset().fadeIn(BLEND_SECONDS).play();
    return () => void action.fadeOut(BLEND_SECONDS);
  }, [mixer, animations, clip]);

  useFrame((_, delta) => {
    mixer.timeScale = speed;
    mixer.update(delta);
  });

  return <primitive object={figure} />;
}
