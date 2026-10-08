import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, CuboidCollider, RigidBody } from '@react-three/rapier';
import { Suspense, useRef, useState, type ReactNode } from 'react';
import type { Group } from 'three';
import { TOWN_NPC_IDS, TOWN_NPCS, townNpcLook, TRAM_LINE, type RoleId, type TownNpcId, type TramStopId } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import {
  selectCulturePackId,
  selectIsOpen,
  selectNpcExpression,
  selectNpcExpressionOf,
  selectNpcSpeaking,
  selectShift,
  selectShiftCustomerLooks,
  selectShiftCustomerSpeaking,
  selectTramRunning,
  useGame,
} from '../store/index.ts';
import { characterPosition } from './Character.tsx';
import { CharacterFigure } from './CharacterFigure.tsx';
import { Groceries } from './Groceries.tsx';
import { RouteMarker } from './Marker.tsx';
import { Props } from './Props.tsx';
import { Signs } from './Signs.tsx';
import {
  BATHHOUSE_GYM,
  BUILDINGS,
  FURNITURE,
  GROUND_HALF_SIZE,
  HOME_BED,
  HOME_STOVE,
  WARD_BED,
  HOME_TAP,
  isWaitingForTram,
  NPC_SPOTS,
  PARK,
  placeAt,
  PLATFORM,
  STREET,
  TRAM_STOPS,
  TREES,
  WALL,
  type Building,
  type Vec3,
  WORKPLACES,
} from './town.ts';

/** How near the doorway the Character can be before a closing door would shut on them. */
const DOORWAY_CLEARANCE = 1.5;

/**
 * Each role's signifier, the same in every Culture Pack: staff wear an apron in their role's colour. The landlord, the
 * park regulars and passers-by wear their everyday clothes.
 */
const APRONS: Partial<Record<RoleId, string>> = {
  barista: '#4f8f7f',
  cashier: '#c9a43a',
  clerk: '#4f7fae',
  server: '#8e3b34',
  receptionist: '#6fa9b3',
  doctor: '#f4f4f0',
  nurse: '#86bf96',
  pharmacist: '#a9c6dc',
  shopkeeper: '#7b5f99',
  attendant: '#3f6f94',
};

const WINDOW = { width: 1.4, height: 0.9, sill: 1.1, lit: '#ffd98a', dark: '#3d4452' } as const;

/** A solid greybox box that the Character collides with. */
function Block({ position, size, colour }: { position: Vec3; size: Vec3; colour: string }) {
  return (
    <>
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={colour} flatShading />
      </mesh>
      <CuboidCollider position={position} args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
    </>
  );
}

/** A small "speaking…" over the NPC while a line of theirs is coming in. The words themselves are in the chat column. */
function SpeakingIndicator({ speaking }: { speaking: boolean }) {
  const { t } = useTranslation();
  if (!speaking) return null;
  return (
    <Html position={[0, 1.2, 0]} center zIndexRange={[10, 0]}>
      <span className="npc-speaking" role="status">
        {t('chat.speaking')}
      </span>
    </Html>
  );
}

/** How near the Character must come before someone turns to face them, in metres. */
const TURN_RANGE = 6;
/** How quickly someone turns to face the Character (per second). */
const TURN_SPEED = 4;

/** Turns what it holds, on the spot, to face the Character once they come near. */
function FacingTheCharacter({ at: [x, , z], children }: { at: Vec3; children: ReactNode }) {
  const turning = useRef<Group>(null);
  useFrame((_, delta) => {
    const group = turning.current;
    const [dx, dz] = [characterPosition.x - x, characterPosition.z - z];
    if (!group || dx * dx + dz * dz > TURN_RANGE * TURN_RANGE) return;
    // The shorter way round.
    const turn = Math.atan2(dx, dz) - group.rotation.y;
    group.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, TURN_SPEED * delta);
  });
  return <group ref={turning}>{children}</group>;
}

/** Someone on the shared rig standing at `at` (a capsule's middle, as the spots are given), feet on the floor, facing the Character. */
function Figure({ at, children }: { at: Vec3; children: ReactNode }) {
  return (
    <group position={at}>
      <FacingTheCharacter at={at}>
        <group position-y={-at[1]}>
          <Suspense fallback={null}>{children}</Suspense>
        </group>
      </FacingTheCharacter>
    </group>
  );
}

/** A town NPC in their look for this Culture Pack, whose face shows their Patience while the Player talks to them. Solid to the Character. */
function Npc({ npcId }: { npcId: TownNpcId }) {
  const speaking = useGame(selectNpcSpeaking) === npcId;
  const packId = useGame(selectCulturePackId);
  const expression = useGame(selectNpcExpressionOf(npcId));
  return (
    <>
      <Figure at={NPC_SPOTS[npcId]}>
        <CharacterFigure
          appearance={townNpcLook(npcId, packId)}
          clip={speaking ? 'talk' : 'idle'}
          expression={expression ?? 'relaxed'}
          apron={APRONS[TOWN_NPCS[npcId].role]}
        />
      </Figure>
      <group position={NPC_SPOTS[npcId]}>
        <CapsuleCollider args={[0.5, 0.35]} />
        <SpeakingIndicator speaking={speaking} />
      </group>
    </>
  );
}

/**
 * The Shift Customer at the café counter or the supermarket till, from walking up until they leave, in the look drawn
 * for them. At the restaurant, the rest of their table stands with them; the one speaking for the table shows the
 * speaking indicator, and their Patience.
 */
function ShiftCustomer() {
  const looks = useGame(selectShiftCustomerLooks);
  const speaking = useGame(selectShiftCustomerSpeaking);
  const expression = useGame(selectNpcExpression);
  const jobId = useGame((s) => selectShift(s)?.jobId);
  const workplace = jobId && WORKPLACES[jobId];
  if (!workplace) return null;
  const seats = [workplace.customerSpot, ...(workplace.otherSeats ?? [])];
  return (
    <>
      {looks.map((look, i) => (
        <group key={i}>
          <Figure at={seats[i]!}>
            <CharacterFigure
              appearance={look}
              clip={i === 0 && speaking ? 'talk' : 'idle'}
              expression={i === 0 ? (expression ?? 'relaxed') : 'relaxed'}
            />
          </Figure>
          {i === 0 && (
            <group position={seats[i]}>
              <SpeakingIndicator speaking={speaking} />
            </group>
          )}
        </group>
      ))}
    </>
  );
}

/** Where the middle of a building's door is, in its front wall. */
function doorPosition({ centre: [cx, cz], size: [, d], facing }: Building): Vec3 {
  return [cx, WALL.height / 2, cz + facing * (d / 2 - WALL.thickness / 2)];
}

/**
 * The door of a closed place: shut, so no one can walk in. It never shuts on
 * the Character, though. Inside at closing time (or in the doorway), they can
 * still walk out, and only then does the door close behind them.
 */
function ClosedDoor({ building }: { building: Building }) {
  const open = useGame(selectIsOpen(building.placeId));
  const [clear, setClear] = useState(false);
  const position = doorPosition(building);

  useFrame(() => {
    const { x, z } = characterPosition;
    const nowClear = placeAt(x, z) !== building.placeId && Math.hypot(x - position[0], z - position[2]) > DOORWAY_CLEARANCE;
    if (nowClear !== clear) setClear(nowClear);
  });

  if (open || !clear) return null;
  return <Block position={position} size={[WALL.doorWidth, WALL.height, WALL.thickness / 2]} colour="#6b5b4d" />;
}

/** Two windows in the front wall, either side of the door: lit while the place is open, dark while it's closed. */
function Windows({ building }: { building: Building }) {
  const open = useGame(selectIsOpen(building.placeId));
  const [cx, cz] = building.centre;
  const [w, d] = building.size;
  const z = cz + building.facing * (d / 2 + 0.01);
  const offset = (WALL.doorWidth + w / 2) / 2;
  const colour = open ? WINDOW.lit : WINDOW.dark;
  return (
    <>
      {[cx - offset, cx + offset].map((x) => (
        <mesh key={x} position={[x, WINDOW.sill + WINDOW.height / 2, z]} rotation-y={building.facing === 1 ? 0 : Math.PI}>
          <planeGeometry args={[WINDOW.width, WINDOW.height]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={open ? 0.9 : 0} />
        </mesh>
      ))}
    </>
  );
}

/** Four walls with a doorway in the front wall (facing the street), and a floor. No roof, so the camera can see in. */
function BuildingShell({ building }: { building: Building }) {
  const [cx, cz] = building.centre;
  const [w, d] = building.size;
  const { height: h, thickness: t, doorWidth } = WALL;
  const y = h / 2;
  const frontSegment = (w - doorWidth) / 2;
  const front = cz + building.facing * (d / 2 - t / 2);
  const back = cz - building.facing * (d / 2 - t / 2);

  return (
    <>
      <mesh position={[cx, 0.01, cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#efe6d6" />
      </mesh>
      <Block position={[cx, y, back]} size={[w, h, t]} colour={building.colour} />
      <Block position={[cx - w / 2 + t / 2, y, cz]} size={[t, h, d]} colour={building.colour} />
      <Block position={[cx + w / 2 - t / 2, y, cz]} size={[t, h, d]} colour={building.colour} />
      <Block position={[cx - w / 2 + frontSegment / 2, y, front]} size={[frontSegment, h, t]} colour={building.colour} />
      <Block position={[cx + w / 2 - frontSegment / 2, y, front]} size={[frontSegment, h, t]} colour={building.colour} />
      <Windows building={building} />
      <ClosedDoor building={building} />
    </>
  );
}

/** An island platform in the middle of the street, with a pole and a shelter roof. Walked onto, not stepped up. */
function TramStop({ stopId }: { stopId: TramStopId }) {
  const [x, z] = TRAM_STOPS[stopId].centre;
  const [length, width] = PLATFORM.size;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, PLATFORM.height / 2, 0]} receiveShadow>
        <boxGeometry args={[length, PLATFORM.height, width]} />
        <meshStandardMaterial color="#a7a29a" />
      </mesh>
      <Block position={[0, 1.3, 0]} size={[0.12, 2.6, 0.12]} colour="#2f6d8f" />
      <mesh position={[0, 2.7, 0]} castShadow>
        <boxGeometry args={[0.7, 0.45, 0.06]} />
        <meshStandardMaterial color="#f2c14e" />
      </mesh>
      <mesh position={[-2, 2.4, 0]} castShadow>
        <boxGeometry args={[2.6, 0.08, width]} />
        <meshStandardMaterial color="#5d7380" />
      </mesh>
    </group>
  );
}

/** The tram rails down the middle of the street. */
function Rails() {
  return (
    <>
      {[-0.4, 0.4].map((offset) => (
        <mesh key={offset} position={[0, 0.015, STREET.z + offset]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[GROUND_HALF_SIZE * 2, 0.08]} />
          <meshStandardMaterial color="#6d6a66" />
        </mesh>
      ))}
    </>
  );
}

function Park() {
  return (
    <>
      <mesh position={[PARK.centre[0], 0.008, PARK.centre[1]]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[...PARK.size]} />
        <meshStandardMaterial color="#8fc27a" />
      </mesh>
      {TREES.map(([x, z]) => (
        <group key={`${x},${z}`}>
          <Block position={[x, 0.9, z]} size={[0.35, 1.8, 0.35]} colour="#7a5a3c" />
          <mesh position={[x, 2.4, z]} castShadow>
            <icosahedronGeometry args={[1.2, 0]} />
            <meshStandardMaterial color="#5f9b55" flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function Town() {
  const tramRunning = useGame(selectTramRunning);
  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[GROUND_HALF_SIZE * 2, GROUND_HALF_SIZE * 2]} />
        <meshStandardMaterial color="#b9d6a3" />
      </mesh>
      <mesh position={[0, 0.005, STREET.z]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[GROUND_HALF_SIZE * 2, STREET.width]} />
        <meshStandardMaterial color="#c9c4bd" />
      </mesh>
      <CuboidCollider position={[0, -0.5, 0]} args={[GROUND_HALF_SIZE, 0.5, GROUND_HALF_SIZE]} />
      <Rails />
      <Park />

      {BUILDINGS.map((building) => (
        <BuildingShell key={building.placeId} building={building} />
      ))}
      {TRAM_LINE.map((stopId) => (
        <TramStop key={stopId} stopId={stopId} />
      ))}
      {FURNITURE.map(({ position, size, colour }) => (
        <Block key={position.join()} position={position} size={size} colour={colour} />
      ))}

      <Block position={HOME_TAP} size={[1.2, 1, 0.6]} colour="#8fa3b8" />
      <Block position={HOME_STOVE} size={[1.2, 1, 0.6]} colour="#5b6170" />
      <Block position={HOME_BED} size={[1.4, 0.5, 2.2]} colour="#d8a7b1" />
      <Block position={WARD_BED} size={[1.4, 0.5, 2.2]} colour="#f4f6f7" />
      <Block position={BATHHOUSE_GYM} size={[1, 1, 2]} colour="#4d5a66" />
      {/* The staff doors at the café, the supermarket and the restaurant: each a door set flat against the inside of the west wall. */}
      {Object.values(WORKPLACES).map(({ door }) => (
        <mesh key={door.join()} position={door}>
          <boxGeometry args={[0.06, 2.2, 1]} />
          <meshStandardMaterial color="#6b5b4d" />
        </mesh>
      ))}
      <ShiftCustomer />
      {TOWN_NPC_IDS.filter((npcId) => tramRunning || !isWaitingForTram(npcId)).map((npcId) => (
        <Npc key={npcId} npcId={npcId} />
      ))}
      <Signs />
      <Props />
      <Groceries />
      <RouteMarker />
    </RigidBody>
  );
}
