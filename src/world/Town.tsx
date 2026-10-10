import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody } from '@react-three/rapier';
import { Suspense, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { TOWN_NPC_IDS, TOWN_NPCS, townNpcLook, type RoleId, type TownNpcId } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import {
  selectCulturePackId,
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
import { Buildings } from './Buildings.tsx';
import { Groceries } from './Groceries.tsx';
import { Piece } from './Kit.tsx';
import { FirstMorningMarker, RouteMarker } from './Marker.tsx';
import { Outdoors } from './Outdoors.tsx';
import { PALETTE, type PaletteColour } from './palette.ts';
import { Props } from './Props.tsx';
import { Signs } from './Signs.tsx';
import { isWaitingForTram, NPC_SPOTS, type Vec3, WORKPLACES } from './town.ts';

/**
 * Each role's signifier, the same in every Culture Pack: staff wear an apron in their role's colour. The landlord, the
 * park regulars and passers-by wear their everyday clothes.
 */
const APRONS: Partial<Record<RoleId, PaletteColour>> = {
  barista: 'teal',
  cashier: 'mustard',
  clerk: 'denim',
  server: 'brick',
  receptionist: 'slate',
  doctor: 'white',
  nurse: 'leaf',
  pharmacist: 'sky',
  shopkeeper: 'plum',
  attendant: 'denim',
};

const apronOf = (role: RoleId) => {
  const colour = APRONS[role];
  return colour && PALETTE[colour];
};

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
          apron={apronOf(TOWN_NPCS[npcId].role)}
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

/** The staff doors at the café, the supermarket and the restaurant: each a door set flat against the inside of the west wall. */
function StaffDoors() {
  return Object.values(WORKPLACES).map(({ door: [x, , z] }) => <Piece key={`${x},${z}`} piece="door" position={[x, 0, z]} rotation={Math.PI / 2} />);
}

export function Town() {
  const tramRunning = useGame(selectTramRunning);
  return (
    <RigidBody type="fixed" colliders={false}>
      <Outdoors />
      <Buildings />
      <StaffDoors />
      <ShiftCustomer />
      {TOWN_NPC_IDS.filter((npcId) => tramRunning || !isWaitingForTram(npcId)).map((npcId) => (
        <Npc key={npcId} npcId={npcId} />
      ))}
      <Signs />
      <Props />
      <Groceries />
      <RouteMarker />
      <FirstMorningMarker />
    </RigidBody>
  );
}
