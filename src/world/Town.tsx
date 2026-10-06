import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, CuboidCollider, RigidBody } from '@react-three/rapier';
import { useState } from 'react';
import { TOWN_NPC_IDS, TOWN_NPCS, TRAM_LINE, type RoleId, type TownNpcId, type TramStopId } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import {
  selectIsOpen,
  selectNpcSpeaking,
  selectShift,
  selectShiftCustomerAtCounter,
  selectShiftCustomerParty,
  selectShiftCustomerSpeaking,
  selectTramRunning,
  useGame,
} from '../store/index.ts';
import { characterPosition } from './Character.tsx';
import { Groceries } from './Groceries.tsx';
import { Props } from './Props.tsx';
import { Signs } from './Signs.tsx';
import {
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

/** Placeholder colours, one per role, until the NPC looks arrive (ticket 30b). */
const ROLE_COLOURS: Record<RoleId, string> = {
  landlord: '#9a8c7a',
  barista: '#7fb3a3',
  cashier: '#c9b458',
  clerk: '#6f9fc8',
  server: '#b5655a',
  receptionist: '#8fc1c9',
  doctor: '#f2f2f2',
  nurse: '#9cc9a8',
  pharmacist: '#b9d0e0',
  regular: '#a3a07c',
  'passer-by': '#8c8fa3',
  shopkeeper: '#9b7fb5',
  attendant: '#5f88a8',
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

/** A greybox NPC: a capsule the Character can't walk through. */
function Npc({ npcId }: { npcId: TownNpcId }) {
  const speaking = useGame(selectNpcSpeaking) === npcId;
  return (
    <group position={NPC_SPOTS[npcId]}>
      <mesh castShadow>
        <capsuleGeometry args={[0.35, 1, 4, 12]} />
        <meshStandardMaterial color={ROLE_COLOURS[TOWN_NPCS[npcId].role]} flatShading />
      </mesh>
      <CapsuleCollider args={[0.5, 0.35]} />
      <SpeakingIndicator speaking={speaking} />
    </group>
  );
}

/** Placeholder colour for Shift Customers, until their Appearance Presets arrive (ticket 30b). */
const SHIFT_CUSTOMER_COLOUR = '#c79a6b';

/**
 * The Shift Customer at the café counter or the supermarket till, from walking up until they leave. At the restaurant,
 * the rest of their table sits with them; the one speaking for the table shows the speaking indicator.
 */
function ShiftCustomer() {
  const atCounter = useGame(selectShiftCustomerAtCounter);
  const party = useGame(selectShiftCustomerParty);
  const speaking = useGame(selectShiftCustomerSpeaking);
  const jobId = useGame((s) => selectShift(s)?.jobId);
  const workplace = jobId && WORKPLACES[jobId];
  if (!atCounter || !workplace) return null;
  const seats = [workplace.customerSpot, ...(workplace.otherSeats ?? [])].slice(0, party);
  return (
    <>
      {seats.map((seat, i) => (
        <group key={i} position={seat}>
          <mesh castShadow>
            <capsuleGeometry args={[0.35, 1, 4, 12]} />
            <meshStandardMaterial color={SHIFT_CUSTOMER_COLOUR} flatShading />
          </mesh>
          {i === 0 && <SpeakingIndicator speaking={speaking} />}
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
    </RigidBody>
  );
}
