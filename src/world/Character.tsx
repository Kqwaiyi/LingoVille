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
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Vector3, type Group } from 'three';
import { GROCERIES_SOLD, jobAt, TOWN_NPC_IDS, TOWN_NPCS } from '../content/index.ts';
import { CLOCK, MOVEMENT, PLACE_IDS, type PlaceId } from '../sim/index.ts';
import {
  selectAppearance,
  selectArrival,
  selectHeldStill,
  selectPlaceId,
  selectShift,
  selectTramArrival,
  selectTramRunning,
  selectWardArrival,
  selectDoctorCall,
  selectWorldKeysOff,
  useGame,
  type Arrival,
  type Interactable,
} from '../store/index.ts';
import { CharacterFigure, JOG_METRES_PER_SECOND } from './CharacterFigure.tsx';
import type { Control } from './controls.ts';
import {
  BATHHOUSE_GYM,
  BEFORE_THE_DOCTOR,
  HOME_BED,
  HOME_STOVE,
  HOME_TAP,
  IN_BED,
  IN_WARD_BED,
  isWaitingForTram,
  NPC_SPOTS,
  placeAt,
  SHELF_SPOTS,
  spawnAt,
  tramStopAt,
  tramStopSpawn,
  type Vec3,
  WORKPLACES,
} from './town.ts';

/**
 * Where the Character appears. A new game starts the First Morning at home
 * (or, in dev, wherever `?spawn=` says); Continue puts the Character at the
 * saved place's entrance, or in bed if that's home.
 */
function spawnPoint(arrival: Arrival, placeId: PlaceId, search: string): Vec3 {
  if (arrival === 'newGame') return spawnAt(devSpawnPlace(search));
  return placeId === 'home' ? IN_BED : spawnAt(placeId);
}

/** Dev only: `?spawn=cafe` starts a new game at the café door, so a smoke test doesn't have to walk across town. */
function devSpawnPlace(search: string): PlaceId {
  const place = new URLSearchParams(search).get('spawn');
  return import.meta.env.DEV && (PLACE_IDS as readonly (string | null)[]).includes(place) ? (place as PlaceId) : 'home';
}

const CAPSULE = { halfHeight: 0.5, radius: 0.35 } as const;
const GRAVITY = 20;
const NO_ROTATION: [boolean, boolean, boolean] = [false, false, false];

type CharacterController = ReturnType<RapierContext['world']['createCharacterController']>;
const CAMERA = { distance: 7, lookHeight: 1.2, minPitch: 0.15, maxPitch: 1.2, dragSensitivity: 0.005, follow: 10 } as const;

/** Where the Character is, updated every frame, for things in the world that need to know how close it is. */
export const characterPosition = new Vector3();

function distanceTo(x: number, z: number, [tx, , tz]: Vec3) {
  return Math.hypot(x - tx, z - tz);
}

/**
 * What the Character standing here could use with E: the tap, the stove or the bed, the gym, a workplace's staff door, the nearest
 * person in talking range, the nearest supermarket shelf, or else the tram stop whose platform this is.
 * Only from inside the same place, so no one is reachable through a wall.
 */
function interactableAt(x: number, z: number, tramRunning: boolean): Interactable | null {
  const placeId = placeAt(x, z);
  if (placeId === 'home' && distanceTo(x, z, HOME_TAP) <= MOVEMENT.interactRangeMetres) return 'tap';
  if (placeId === 'home' && distanceTo(x, z, HOME_STOVE) <= MOVEMENT.interactRangeMetres) return 'stove';
  if (placeId === 'home' && distanceTo(x, z, HOME_BED) <= MOVEMENT.interactRangeMetres) return 'bed';
  if (placeId === 'bathhouse' && distanceTo(x, z, BATHHOUSE_GYM) <= MOVEMENT.interactRangeMetres) return 'gym';
  const job = placeId && jobAt(placeId);
  const workplace = job ? WORKPLACES[job] : undefined;
  if (workplace && distanceTo(x, z, workplace.usedFrom) <= MOVEMENT.interactRangeMetres) return 'staff-door';
  let nearest: Interactable | null = null;
  let nearestDistance: number = MOVEMENT.talkRangeMetres;
  for (const npcId of TOWN_NPC_IDS) {
    if (TOWN_NPCS[npcId].placeId !== placeId || (!tramRunning && isWaitingForTram(npcId))) continue;
    const distance = distanceTo(x, z, NPC_SPOTS[npcId]);
    if (distance <= nearestDistance) [nearest, nearestDistance] = [npcId, distance];
  }
  if (nearest) return nearest;
  if (placeId === 'supermarket') {
    let nearestShelf: number = MOVEMENT.interactRangeMetres;
    for (const itemId of GROCERIES_SOLD) {
      const distance = distanceTo(x, z, SHELF_SPOTS[itemId]);
      if (distance <= nearestShelf) [nearest, nearestShelf] = [itemId, distance];
    }
  }
  return nearest ?? tramStopAt(x, z);
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
  // A copy of its own, the same array every render: a new one would put the body back here each time the Character re-renders.
  const [spawn] = useState((): [number, number, number] => {
    const point = spawnPoint(arrival, startPlaceId, window.location.search);
    characterPosition.set(...point);
    return [...point];
  });
  const [, getKeys] = useKeyboardControls<Control>();
  const { world } = useRapier();
  const enterPlace = useGame((s) => s.enterPlace);
  const setOnStreet = useGame((s) => s.setOnStreet);
  const setInteractable = useGame((s) => s.setInteractable);
  // Letters typed into the chat field, or keys pressed in the Journal, must not walk the Character away.
  const keysOff = useGame(selectWorldKeysOff);
  // An NPC who came up to the Character stopped them: keys held then count only once let go.
  const heldStill = useGame(selectHeldStill);
  const letGoOfWalkKeys = useGame((s) => s.letGoOfWalkKeys);
  const tramArrival = useGame(selectTramArrival);
  const wardArrival = useGame(selectWardArrival);
  const doctorCall = useGame(selectDoctorCall);
  const tramRunning = useGame(selectTramRunning);
  // At work: from the staff door to the end of the Shift, the Character stands behind the counter.
  const atWork = useGame((s) => selectShift(s)?.jobId ?? null);
  const appearance = useGame(selectAppearance);
  // Moving or standing, for the figure's clip. Changes only when the Character starts or stops.
  const [moving, setMoving] = useState(false);
  // The camera jumps with the Character after a tram ride, instead of sweeping across town.
  const snapCamera = useRef(false);

  /** Puts the Character somewhere else at once, with the camera jumping along. */
  const moveTo = ([x, y, z]: Vec3) => {
    if (!body.current) return;
    body.current.setTranslation({ x, y, z }, true);
    characterPosition.set(x, y, z);
    fallSpeed.current = 0;
    snapCamera.current = true;
  };

  // Off the tram: the Character stands on the platform of the stop it rode to.
  useEffect(() => {
    if (tramArrival) moveTo(tramStopSpawn(tramArrival.stopId));
  }, [tramArrival]);

  useEffect(() => {
    const workplace = atWork && WORKPLACES[atWork];
    if (workplace) moveTo(workplace.behindTheCounter);
  }, [atWork]);

  // Fainted: the Character is in the ward bed, beside the nurse, behind the Fainting screen.
  useEffect(() => {
    if (wardArrival) moveTo(IN_WARD_BED);
  }, [wardArrival]);

  // Called in from the waiting room: the Character stands in front of the doctor.
  useEffect(() => {
    if (doctorCall) moveTo(BEFORE_THE_DOCTOR);
  }, [doctorCall]);

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
    const held = getKeys();
    const walkKeyHeld = held.forward || held.back || held.left || held.right;
    if (heldStill && !walkKeyHeld) letGoOfWalkKeys();
    const keys = keysOff || heldStill || atWork ? { forward: false, back: false, left: false, right: false } : held;
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
    characterPosition.set(next.x, next.y, next.z);
    if (walking && model.current) model.current.rotation.y = Math.atan2(move.x, move.z);
    if (walking !== moving) setMoving(walking);

    const target = scratch.target.set(next.x, next.y + CAMERA.lookHeight - CAPSULE.halfHeight, next.z);
    const wanted = scratch.camera.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * CAMERA.distance,
      target.y + Math.sin(pitch) * CAMERA.distance,
      target.z + Math.cos(yaw) * Math.cos(pitch) * CAMERA.distance,
    );
    camera.position.lerp(wanted, snapCamera.current ? 1 : Math.min(1, CAMERA.follow * dt));
    snapCamera.current = false;
    camera.lookAt(target);

    const placeId = placeAt(next.x, next.z);
    if (placeId) enterPlace(placeId);
    setOnStreet(placeId === null);
    setInteractable(interactableAt(next.x, next.z, tramRunning));
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={spawn} enabledRotations={NO_ROTATION}>
      <CapsuleCollider ref={collider} args={[CAPSULE.halfHeight, CAPSULE.radius]} />
      <group ref={model} rotation-y={Math.PI}>
        {/* The figure stands on the floor, below the middle of the capsule. */}
        <group position-y={-STANDING_HEIGHT}>
          <Suspense fallback={null}>
            <CharacterFigure
              appearance={appearance}
              clip={moving ? 'jog' : 'idle'}
              speed={moving ? MOVEMENT.walkSpeedMetresPerSecond / JOG_METRES_PER_SECOND : 1}
            />
          </Suspense>
        </group>
      </group>
    </RigidBody>
  );
}

/** How high the middle of the Character's body stands above the floor. */
const STANDING_HEIGHT = CAPSULE.halfHeight + CAPSULE.radius;
