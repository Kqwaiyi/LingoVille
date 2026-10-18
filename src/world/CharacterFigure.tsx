import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AnimationClip, AnimationMixer, Euler, Quaternion, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AppearancePreset } from '../content/index.ts';
import type { NpcExpression } from '../sim/index.ts';
import {
  ACCENT_MATERIAL,
  APRON,
  APRON_MATERIAL,
  BODY_BONE,
  CHARACTER_ART_URL,
  EYE_SHAPES,
  EYES,
  FIGURE,
  OPTIONAL_PART,
  partsOf,
  SWEAT,
  type CharacterClip,
  type EyeShape,
} from './characterArt.ts';
import { PALETTE, type PaletteColour } from './palette.ts';

// Everyone is Clawd, the Claude Code mascot, modelled, rigged and animated in Blender.
// The Character, Named NPCs, Shift Customers and Passers-by all are; what tells them apart is what they wear.
useGLTF.preload(CHARACTER_ART_URL);

/**
 * How fast the walk carries a figure across the ground at its own pace, in metres per second, so its legs keep up: a
 * little more than its stride strictly covers (about 2 m/s), so a brisk walk scuttles rather than blurs.
 */
export const WALK_METRES_PER_SECOND = 2.4;

/** Scratch space for tilting the body, so a frame allocates nothing. */
const scratch = { parent: new Quaternion(), figure: new Quaternion(), back: new Quaternion(), turn: new Quaternion(), euler: new Euler() };

/** How long one clip blends into the next, in seconds. */
const BLEND_SECONDS = 0.2;

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

/** A node's name as the art gives it: the loader makes names unique, and keeps each node's own in `userData`. */
const artName = (object: Object3D): string | undefined => object.userData.name as string | undefined;

/** The first node under `root` the art gives this name. */
function findInArt(root: Object3D, name: string): Object3D | undefined {
  let found: Object3D | undefined;
  root.traverse((object) => void (found ??= artName(object) === name ? object : undefined));
  return found;
}

/** The part a mesh draws: its own node's, or for a part in several materials (a group of meshes, one each), its group's. */
const partOf = (mesh: Mesh): string => artName(mesh) ?? (mesh.parent ? artName(mesh.parent) : undefined) ?? '';

/**
 * Each expression, as Clawd shows it: Patience shows only like this. The eyes take a shape (none for relaxed, as they
 * are), and the body turns (radians) about the way the figure faces (`tilt`, towards its right side) and across it
 * (`nod`, its top forward). Puzzled is one eye wide and the other squinting, with a tilt; strained is both eyes squeezed
 * shut, > <, with a nod and a drop of sweat.
 */
const EXPRESSIONS: Record<NpcExpression, { eyes: EyeShape | null; tilt: number; nod: number; sweat: boolean }> = {
  relaxed: { eyes: null, tilt: 0, nod: 0, sweat: false },
  puzzled: { eyes: 'puzzled', tilt: 0.14, nod: 0, sweat: false },
  strained: { eyes: 'strained', tilt: 0, nod: 0.1, sweat: true },
};

/** How quickly the body and eyes ease into an expression (per second). */
const EXPRESSION_EASE = 6;

/** Blinks: every few seconds (at random, between these), shut and open again over `seconds`. Not while squeezed shut. */
const BLINK = { everyMin: 2.2, everyMax: 5.5, seconds: 0.16 } as const;

/**
 * Clawd, wearing an Appearance Preset and playing a clip from its library. Stands on its origin, facing +z.
 */
export function CharacterFigure({
  appearance,
  clip = 'idle',
  speed = 1,
  expression = 'relaxed',
  apron,
}: {
  appearance: AppearancePreset;
  clip?: CharacterClip;
  speed?: number;
  /** What the face shows: an NPC's Patience. */
  expression?: NpcExpression;
  /** The role signifier staff wear: an apron of this colour, or none. */
  apron?: string;
}) {
  const { scene, animations } = useGLTF(CHARACTER_ART_URL);

  const figure = useMemo(() => {
    const figure = clone(findInArt(scene, FIGURE)!);
    figure.traverse((object) => {
      if (!isMesh(object)) return;
      object.castShadow = true;
      // Its own tinted materials, so tinting this figure leaves everyone else as they are.
      const material = object.material as Material;
      if (material.name === ACCENT_MATERIAL || material.name === APRON_MATERIAL) object.material = material.clone();
    });
    return figure;
  }, [scene]);

  // The eyes, with their shape keys, and the body, which an expression turns.
  const eyes = useMemo(() => findInArt(figure, EYES), [figure]);
  const body = useMemo(() => findInArt(figure, BODY_BONE), [figure]);

  useEffect(() => {
    const worn = partsOf(appearance);
    figure.traverse((object) => {
      if (!isMesh(object)) return;
      const part = partOf(object);
      if (OPTIONAL_PART.test(part)) object.visible = worn.has(part) || (part === APRON && !!apron) || (part === SWEAT && EXPRESSIONS[expression].sweat);
      const material = object.material as MeshStandardMaterial;
      if (material.name === ACCENT_MATERIAL) material.color.set(PALETTE[appearance.colour satisfies PaletteColour]);
      else if (material.name === APRON_MATERIAL && apron) material.color.set(apron);
    });
  }, [figure, appearance, apron, expression]);

  const mixer = useMemo(() => new AnimationMixer(figure), [figure]);
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  useEffect(() => {
    const action = mixer.clipAction(AnimationClip.findByName(animations, clip)!);
    action.reset().fadeIn(BLEND_SECONDS).play();
    return () => void action.fadeOut(BLEND_SECONDS);
  }, [mixer, animations, clip]);

  // How far the body has turned and the eyes have changed towards the expression, eased; and the next blink.
  const shown = useRef({ tilt: 0, nod: 0, eyes: Object.fromEntries(EYE_SHAPES.map((shape) => [shape, 0])) as Record<EyeShape, number> });
  // The first blink at random too, so the town doesn't blink as one.
  const blink = useRef<{ in: number; at: number }>({ in: Math.random() * BLINK.everyMax, at: -1 });

  // The turn last put on the body, taken off again before the clip moves it, so turns never pile up.
  const bodyTurned = useMemo(() => new Quaternion(), []);

  useFrame((_, delta) => {
    body?.quaternion.premultiply(scratch.back.copy(bodyTurned).invert());
    bodyTurned.identity();
    mixer.timeScale = speed;
    mixer.update(delta);

    const now = shown.current;
    const wanted = EXPRESSIONS[expression];
    const ease = Math.min(1, EXPRESSION_EASE * delta);
    now.tilt += (wanted.tilt - now.tilt) * ease;
    now.nod += (wanted.nod - now.nod) * ease;

    // A blink is a quick shut and open: up to 1 and back over its time.
    const blinking = blink.current;
    blinking.in -= delta;
    if (blinking.in <= 0 && blinking.at < 0 && wanted.eyes !== 'strained') blinking.at = 0;
    let shut = 0;
    if (blinking.at >= 0) {
      blinking.at += delta;
      shut = Math.max(0, 1 - Math.abs(blinking.at / BLINK.seconds - 0.5) * 2);
      if (blinking.at >= BLINK.seconds) {
        blinking.at = -1;
        blinking.in = BLINK.everyMin + Math.random() * (BLINK.everyMax - BLINK.everyMin);
      }
    }
    for (const shape of EYE_SHAPES) {
      const target = shape === 'blink' ? shut : wanted.eyes === shape ? 1 : 0;
      now.eyes[shape] = shape === 'blink' ? target : now.eyes[shape] + (target - now.eyes[shape]) * ease;
    }
    if (eyes) setEyes(eyes, now.eyes);

    // The expression's turn goes on top of the clip's, about the figure's own axes.
    if (!body?.parent || (now.tilt === 0 && now.nod === 0)) return;
    const toParent = body.parent.getWorldQuaternion(scratch.parent).invert().multiply(figure.getWorldQuaternion(scratch.figure));
    scratch.turn.setFromEuler(scratch.euler.set(now.nod, 0, now.tilt));
    // The turn as the figure has it, carried into the body's parent's space.
    bodyTurned.copy(scratch.turn.premultiply(toParent).multiply(scratch.back.copy(toParent).invert()));
    body.quaternion.premultiply(bodyTurned);
  });

  return <primitive object={figure} />;
}

/** Sets the eyes' shape keys, on each of their meshes (one for each material). */
function setEyes(eyes: Object3D, shapes: Record<EyeShape, number>) {
  eyes.traverse((object) => {
    if (!isMesh(object) || !object.morphTargetDictionary || !object.morphTargetInfluences) return;
    for (const shape of EYE_SHAPES) {
      const index = object.morphTargetDictionary[shape];
      if (index !== undefined) object.morphTargetInfluences[index] = shapes[shape];
    }
  });
}
