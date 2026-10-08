import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  BufferAttribute,
  Euler,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  type Material,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BODY_PRESETS, HAIR_COLOURS, SKIN_TONES, type AppearancePreset, type Build } from '../content/index.ts';
import type { NpcExpression } from '../sim/index.ts';
import { CHARACTER_ART_URLS, HEAD_BONE, OPTIONAL_PART, partsOf, type CharacterBone, type CharacterClip } from './characterArt.ts';

// The shared character rig: Quaternius's base characters and animation library, built by `npm run build:characters`.
// The Character, Named NPCs and Shift Customers all wear it.
useGLTF.preload(CHARACTER_ART_URLS.characters);
useGLTF.preload(CHARACTER_ART_URLS.animations);

/** How fast the jog carries a figure across the ground at its own pace, in metres per second, so its feet keep up. */
export const JOG_METRES_PER_SECOND = 3.1;

/** Scratch space for turning heads, so a frame allocates nothing. */
const scratch = { parent: new Quaternion(), figure: new Quaternion(), back: new Quaternion(), turn: new Quaternion(), euler: new Euler() };

/** How long one clip blends into the next, in seconds. */
const BLEND_SECONDS = 0.2;

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true;

/**
 * How one eyebrow moves for an expression, from where the art has it: raised (metres), its inner end lifted by turning
 * it about its middle (radians; below 0 arches it), and drawn in towards the nose (metres).
 */
type BrowPose = { raise: number; innerUp: number; inward: number };
const STILL: BrowPose = { raise: 0, innerUp: 0, inward: 0 };

/**
 * Each expression, as the face shows it: Patience shows only like this. Puzzled is one brow up and the other down, with
 * the head tilted; strained is both brows knitted, inner ends up, with the chin dropped. The figure's left brow is on its
 * +x side. The head turns (radians) about the way the figure faces (`tilt`, towards its right shoulder) and across it (`nod`, chin down).
 */
const EXPRESSIONS: Record<NpcExpression, { left: BrowPose; right: BrowPose; tilt: number; nod: number }> = {
  relaxed: { left: STILL, right: STILL, tilt: 0, nod: 0 },
  puzzled: { left: { raise: 0.009, innerUp: -0.25, inward: 0 }, right: { raise: -0.003, innerUp: 0.15, inward: 0.002 }, tilt: 0.18, nod: 0 },
  strained: { left: { raise: -0.002, innerUp: 0.55, inward: 0.005 }, right: { raise: -0.002, innerUp: 0.55, inward: 0.005 }, tilt: 0, nod: 0.12 },
};

/** How quickly the head eases into an expression's pose (per second). */
const HEAD_EASE = 4;

/** The eyebrows as the art has them, kept to move from. */
const REST = 'restPositions';

/**
 * A bib apron, as each build wears it: the bib on the chest and the skirt from the waist, each a thin panel (centre
 * height, width and height, in metres) just in front of the clothes (`front`), moving with the bone it hangs from.
 */
const APRON: Record<Build, { bone: CharacterBone; y: number; width: number; height: number; front: number }[]> = {
  masculine: [
    { bone: 'spine_03', y: 1.2, width: 0.24, height: 0.36, front: 0.135 },
    { bone: 'pelvis', y: 0.8, width: 0.32, height: 0.44, front: 0.13 },
  ],
  feminine: [
    { bone: 'spine_03', y: 1.22, width: 0.22, height: 0.32, front: 0.145 },
    { bone: 'pelvis', y: 0.8, width: 0.3, height: 0.44, front: 0.12 },
  ],
};
const APRON_THICKNESS = 0.008;

/** Hangs an apron of this colour on a figure of this build, each panel on its bone as the figure stood when it was bound. */
function putOnApron(figure: Object3D, build: Build, colour: string): Mesh[] {
  let skinned: SkinnedMesh | undefined;
  figure.traverse((object) => void (skinned ??= (object as SkinnedMesh).isSkinnedMesh ? (object as SkinnedMesh) : undefined));
  const { bones, boneInverses } = skinned!.skeleton;
  const material = new MeshStandardMaterial({ color: colour, roughness: 0.9 });
  return APRON[build].map(({ bone, y, width, height, front }) => {
    const panel = new Mesh(new BoxGeometry(width, height, APRON_THICKNESS), material);
    const i = bones.findIndex((b) => b.name === bone);
    // From where the panel sits on the bound figure to where it sits on its bone.
    panel.matrix.multiplyMatrices(boneInverses[i]!, new Matrix4().makeTranslation(0, y, front));
    panel.matrixAutoUpdate = false;
    panel.castShadow = true;
    bones[i]!.add(panel);
    return panel;
  });
}

type Side = 'left' | 'right';
const sideOf = (x: number): Side => (x > 0 ? 'left' : 'right');

/** The middle of each eyebrow: the mean of its half of the vertices, as x and y. */
function browMiddles(rest: Float32Array): Record<Side, [number, number]> {
  const sums = { left: [0, 0, 0], right: [0, 0, 0] };
  for (let i = 0; i < rest.length; i += 3) {
    const sum = sums[sideOf(rest[i]!)];
    sums[sideOf(rest[i]!)] = [sum[0]! + rest[i]!, sum[1]! + rest[i + 1]!, sum[2]! + 1];
  }
  const middle = ([x, y, count]: number[]): [number, number] => [x! / count!, y! / count!];
  return { left: middle(sums.left), right: middle(sums.right) };
}

/** Moves a figure's eyebrows into an expression, each about its own middle. */
function poseBrows(brows: Mesh, expression: NpcExpression) {
  const rest = brows.userData[REST] as Float32Array;
  const middles = browMiddles(rest);
  const positions = brows.geometry.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < rest.length; i += 3) {
    const side = sideOf(rest[i]!);
    const { raise, innerUp, inward } = EXPRESSIONS[expression][side];
    const [cx, cy] = middles[side];
    // Towards the nose is -x for the left brow and +x for the right. Its inner end goes up as it turns that way round.
    const towardsNose = side === 'left' ? -1 : 1;
    const angle = towardsNose * innerUp;
    const [dx, dy] = [rest[i]! - cx, rest[i + 1]! - cy];
    positions.setXY(
      i / 3,
      cx + dx * Math.cos(angle) - dy * Math.sin(angle) + towardsNose * inward,
      cy + dx * Math.sin(angle) + dy * Math.cos(angle) + raise,
    );
  }
  positions.needsUpdate = true;
}

/**
 * Someone on the shared rig, wearing an Appearance Preset and playing a clip from the shared library. Stands on its
 * origin, facing +z.
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
      // Eyebrows of its own to move, too, kept as the art has them. The art interleaves its vertex data, so the
      // positions come out into an attribute of their own.
      if (object.name.startsWith('brows')) {
        const shared = object.geometry.getAttribute('position');
        const rest = new Float32Array(shared.count * 3);
        for (let i = 0; i < shared.count; i++) rest.set([shared.getX(i), shared.getY(i), shared.getZ(i)], i * 3);
        object.geometry = object.geometry.clone();
        object.geometry.setAttribute('position', new BufferAttribute(rest.slice(), 3));
        object.userData[REST] = rest;
      }
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

  useEffect(() => {
    figure.traverse((object) => {
      if (isMesh(object) && object.name.startsWith('brows')) poseBrows(object, expression);
    });
  }, [figure, expression]);

  useEffect(() => {
    if (!apron) return;
    const panels = putOnApron(figure, build, apron);
    return () => {
      for (const panel of panels) {
        panel.removeFromParent();
        panel.geometry.dispose();
      }
      (panels[0]!.material as Material).dispose();
    };
  }, [figure, build, apron]);

  const mixer = useMemo(() => new AnimationMixer(figure), [figure]);
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  useEffect(() => {
    const action = mixer.clipAction(AnimationClip.findByName(animations, clip)!);
    action.reset().fadeIn(BLEND_SECONDS).play();
    return () => void action.fadeOut(BLEND_SECONDS);
  }, [mixer, animations, clip]);

  // How far the head has turned towards the expression's pose: the tilt and the nod, eased.
  const headTurn = useRef({ tilt: 0, nod: 0 });
  const head = useMemo(() => figure.getObjectByName(HEAD_BONE), [figure]);

  // The turn last put on the head, taken off again before the clip moves it, so turns never pile up.
  const headTurned = useMemo(() => new Quaternion(), []);

  useFrame((_, delta) => {
    head?.quaternion.premultiply(scratch.back.copy(headTurned).invert());
    headTurned.identity();
    mixer.timeScale = speed;
    mixer.update(delta);
    // The expression's turn goes on top of the clip's, about the figure's own axes.
    const turn = headTurn.current;
    const { tilt, nod } = EXPRESSIONS[expression];
    const ease = Math.min(1, HEAD_EASE * delta);
    turn.tilt += (tilt - turn.tilt) * ease;
    turn.nod += (nod - turn.nod) * ease;
    if (!head?.parent || (turn.tilt === 0 && turn.nod === 0)) return;
    const toParent = head.parent.getWorldQuaternion(scratch.parent).invert().multiply(figure.getWorldQuaternion(scratch.figure));
    scratch.turn.setFromEuler(scratch.euler.set(turn.nod, 0, turn.tilt));
    // The turn as the figure has it, carried into the head's parent's space.
    headTurned.copy(scratch.turn.premultiply(toParent).multiply(scratch.back.copy(toParent).invert()));
    head.quaternion.premultiply(headTurned);
  });

  return <primitive object={figure} />;
}
