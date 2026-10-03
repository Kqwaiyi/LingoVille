import { useKeyboardControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierContext,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { Vector3, type Group } from 'three';
import { CLOCK, MOVEMENT } from '../sim/index.ts';
import { selectArrival, selectPlaceId, selectWorldKeysOff, useGame, type Interactable } from '../store/index.ts';
import type { Control } from './controls.ts';
import { BARISTA, HOME_TAP, placeAt, spawnPoint, type Vec3 } from './town.ts';

const CAPSULE = { halfHeight: 0.5, radius: 0.35 } as const;
const GRAVITY = 20;

type CharacterController = ReturnType<RapierContext['world']['createCharacterController']>;
const CAMERA = { distance: 7, lookHeight: 1.2, minPitch: 0.15, maxPitch: 1.2, dragSensitivity: 0.005, follow: 10 } as const;

function distanceTo(x: number, z: number, [tx, , tz]: Vec3) {
  return Math.hypot(x - tx, z - tz);
}

/** What the Character standing here could use with E. Only from inside, so nothing is reachable through a wall. */
function interactableAt(x: number, z: number): Interactable | null {
  const placeId = placeAt(x, z);
  if (placeId === 'home' && distanceTo(x, z, HOME_TAP) <= MOVEMENT.interactRangeMetres) return 'tap';
  if (placeId === 'cafe' && distanceTo(x, z, BARISTA) <= MOVEMENT.talkRangeMetres) return 'barista';
  return null;
}

/** Orbit angles for the follow camera, changed by dragging with the mouse. */
function useOrbitDrag() {
  const domElement = useThree((s) => s.gl.domElement);
  const orbit = useRef({ yaw: 0, pitch: 0.6 });

  useEffect(() => {
    let dragging = false;
    const down = () => (dragging = true);
    const up = () => (dragging = false);
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      orbit.current.yaw -= e.movementX * CAMERA.dragSensitivity;
      orbit.current.pitch = Math.min(
        CAMERA.maxPitch,
        Math.max(CAMERA.minPitch, orbit.current.pitch + e.movementY * CAMERA.dragSensitivity),
      );
    };
    domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointermove', move);
    return () => {
      domElement.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointermove', move);
    };
  }, [domElement]);

  return orbit;
}

/** The Character: a kinematic capsule moved by Rapier's character controller, with a third-person camera. */
export function Character() {
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const model = useRef<Group>(null);
  const fallSpeed = useRef(0);
  const orbit = useOrbitDrag();
  const arrival = useGame(selectArrival);
  const startPlaceId = useGame(selectPlaceId);
  // Where the Character appeared. Fixed at mount: after that, the Character walks.
  const [spawn] = useState(() => spawnPoint(arrival, startPlaceId, window.location.search));
  const [, getKeys] = useKeyboardControls<Control>();
  const { world } = useRapier();
  const enterPlace = useGame((s) => s.enterPlace);
  const setInteractable = useGame((s) => s.setInteractable);
  // Letters typed into the chat field, or keys pressed in the Journal, must not walk the Character away.
  const keysOff = useGame(selectWorldKeysOff);

  // Created in an effect, not a memo: StrictMode's cleanup frees the controller,
  // and the second effect run must then make a fresh one.
  const controller = useRef<CharacterController>(null);
  useEffect(() => {
    const c = world.createCharacterController(0.02);
    c.enableAutostep(0.3, 0.2, false);
    c.enableSnapToGround(0.3);
    controller.current = c;
    return () => {
      controller.current = null;
      world.removeCharacterController(c);
    };
  }, [world]);

  const scratch = useMemo(() => ({ move: new Vector3(), target: new Vector3(), camera: new Vector3() }), []);

  useFrame(({ camera }, delta) => {
    if (!body.current || !collider.current || !controller.current) return;
    const dt = Math.min(delta, CLOCK.maxRealDeltaMs / 1000);
    const { yaw, pitch } = orbit.current;

    // Walk relative to the camera: forward is away from it, across the ground.
    const keys = keysOff ? { forward: false, back: false, left: false, right: false } : getKeys();
    const ahead = Number(keys.forward) - Number(keys.back);
    const across = Number(keys.right) - Number(keys.left);
    const move = scratch.move.set(
      -Math.sin(yaw) * ahead + Math.cos(yaw) * across,
      0,
      -Math.cos(yaw) * ahead - Math.sin(yaw) * across,
    );
    const walking = move.lengthSq() > 0;
    if (walking) move.normalize().multiplyScalar(MOVEMENT.walkSpeedMetresPerSecond * dt);

    fallSpeed.current = controller.current.computedGrounded() ? 0 : fallSpeed.current + GRAVITY * dt;
    move.y = -Math.max(fallSpeed.current, 1) * dt;

    controller.current.computeColliderMovement(collider.current, move);
    const step = controller.current.computedMovement();
    const at = body.current.translation();
    const next = { x: at.x + step.x, y: at.y + step.y, z: at.z + step.z };
    body.current.setNextKinematicTranslation(next);
    if (walking && model.current) model.current.rotation.y = Math.atan2(move.x, move.z);

    const target = scratch.target.set(next.x, next.y + CAMERA.lookHeight - CAPSULE.halfHeight, next.z);
    const wanted = scratch.camera.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * CAMERA.distance,
      target.y + Math.sin(pitch) * CAMERA.distance,
      target.z + Math.cos(yaw) * Math.cos(pitch) * CAMERA.distance,
    );
    camera.position.lerp(wanted, Math.min(1, CAMERA.follow * dt));
    camera.lookAt(target);

    const placeId = placeAt(next.x, next.z);
    if (placeId) enterPlace(placeId);
    setInteractable(interactableAt(next.x, next.z));
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[...spawn]} enabledRotations={[false, false, false]}>
      <CapsuleCollider ref={collider} args={[CAPSULE.halfHeight, CAPSULE.radius]} />
      <CharacterModel ref={model} rotationY={Math.PI} />
    </RigidBody>
  );
}

/** How high the middle of the Character's body stands above the floor. */
export const STANDING_HEIGHT = CAPSULE.halfHeight + CAPSULE.radius;

/** The Character's placeholder body until the Appearance Presets arrive (ticket 30). At rotation 0 it faces +z. */
export function CharacterModel({ ref, rotationY = 0 }: { ref?: Ref<Group>; rotationY?: number }) {
  return (
    <group ref={ref} rotation-y={rotationY}>
      <mesh castShadow>
        <capsuleGeometry args={[CAPSULE.radius, CAPSULE.halfHeight * 2, 4, 12]} />
        <meshStandardMaterial color="#f2d16b" flatShading />
      </mesh>
      <mesh position={[0, 0.45, CAPSULE.radius]} castShadow>
        <boxGeometry args={[0.18, 0.12, 0.2]} />
        <meshStandardMaterial color="#5b4a3a" />
      </mesh>
    </group>
  );
}
