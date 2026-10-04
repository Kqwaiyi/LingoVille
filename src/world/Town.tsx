import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, CuboidCollider, RigidBody } from '@react-three/rapier';
import { useState } from 'react';
import type { NamedNpcId } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import { selectIsOpen, selectNpcSpeaking, useGame } from '../store/index.ts';
import { characterPosition } from './Character.tsx';
import { Props } from './Props.tsx';
import { Signs } from './Signs.tsx';
import {
  BARISTA,
  BUILDINGS,
  CAFE_COUNTER,
  GROUND_HALF_SIZE,
  HOME_BED,
  HOME_TAP,
  placeAt,
  STREET,
  WALL,
  type Building,
  type Vec3,
} from './town.ts';

/** How near the doorway the Character can be before a closing door would shut on them. */
const DOORWAY_CLEARANCE = 1.5;

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
function SpeakingIndicator({ npcId }: { npcId: NamedNpcId }) {
  const { t } = useTranslation();
  const speaking = useGame(selectNpcSpeaking) === npcId;
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
function Npc({ npcId, position, colour }: { npcId: NamedNpcId; position: Vec3; colour: string }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <capsuleGeometry args={[0.35, 1, 4, 12]} />
        <meshStandardMaterial color={colour} flatShading />
      </mesh>
      <CapsuleCollider args={[0.5, 0.35]} />
      <SpeakingIndicator npcId={npcId} />
    </group>
  );
}

/**
 * The door of a closed place: shut, so no one can walk in. It never shuts on
 * the Character, though. Inside at closing time (or in the doorway), they can
 * still walk out, and only then does the door close behind them.
 */
function ClosedDoor({ building, position }: { building: Building; position: Vec3 }) {
  const open = useGame(selectIsOpen(building.placeId));
  const [clear, setClear] = useState(false);

  useFrame(() => {
    const { x, z } = characterPosition;
    const nowClear = placeAt(x, z) !== building.placeId && Math.hypot(x - position[0], z - position[2]) > DOORWAY_CLEARANCE;
    if (nowClear !== clear) setClear(nowClear);
  });

  if (open || !clear) return null;
  return <Block position={position} size={[WALL.doorWidth, WALL.height, WALL.thickness / 2]} colour="#6b5b4d" />;
}

/** Four walls with a doorway in the front (+z) wall, and a floor. No roof, so the camera can see in. */
function BuildingShell({ building }: { building: Building }) {
  const [cx, cz] = building.centre;
  const [w, d] = building.size;
  const { height: h, thickness: t, doorWidth } = WALL;
  const y = h / 2;
  const frontSegment = (w - doorWidth) / 2;

  return (
    <>
      <mesh position={[cx, 0.01, cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#efe6d6" />
      </mesh>
      <Block position={[cx, y, cz - d / 2 + t / 2]} size={[w, h, t]} colour={building.colour} />
      <Block position={[cx - w / 2 + t / 2, y, cz]} size={[t, h, d]} colour={building.colour} />
      <Block position={[cx + w / 2 - t / 2, y, cz]} size={[t, h, d]} colour={building.colour} />
      <Block position={[cx - w / 2 + frontSegment / 2, y, cz + d / 2 - t / 2]} size={[frontSegment, h, t]} colour={building.colour} />
      <Block position={[cx + w / 2 - frontSegment / 2, y, cz + d / 2 - t / 2]} size={[frontSegment, h, t]} colour={building.colour} />
      <ClosedDoor building={building} position={[cx, y, cz + d / 2 - t / 2]} />
    </>
  );
}

export function Town() {
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

      {BUILDINGS.map((building) => (
        <BuildingShell key={building.placeId} building={building} />
      ))}

      <Block position={HOME_TAP} size={[1.2, 1, 0.6]} colour="#8fa3b8" />
      <Block position={HOME_BED} size={[1.4, 0.5, 2.2]} colour="#d8a7b1" />
      <Block position={CAFE_COUNTER} size={[4, 1.1, 0.8]} colour="#8b6a4f" />
      <Npc npcId="barista" position={BARISTA} colour="#7fb3a3" />
      <Signs />
      <Props />
    </RigidBody>
  );
}
