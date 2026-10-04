import type { ReactNode } from 'react';
import { CULTURE_PACKS, type PropId } from '../content/index.ts';
import { selectCulturePackId, useGame } from '../store/index.ts';
import { SPOT_FOR_PROP, PROP_SPOTS, type Vec3 } from './town.ts';

// Greybox stand-ins for each pack's small set dressing, until the art pass
// (ticket 31). Door props hang centred on the café door; counter props sit on
// the counter top, origin at their base.

const SHAPES: Record<PropId, ReactNode> = {
  noren: (
    <group>
      {[-0.6, 0, 0.6].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.56, 0.5, 0.02]} />
          <meshStandardMaterial color="#2c3e6b" />
        </mesh>
      ))}
    </group>
  ),
  'red-lantern': (
    <group>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, -0.1, 0.15]} scale={[1, 1.25, 1]}>
          <sphereGeometry args={[0.2, 12, 10]} />
          <meshStandardMaterial color="#c8322a" emissive="#5a0e0a" />
        </mesh>
      ))}
    </group>
  ),
  bunting: (
    <group>
      {[-1.6, -1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6].map((x, i) => (
        <mesh key={x} position={[x, 0.05, 0.05]} rotation-z={Math.PI}>
          <coneGeometry args={[0.14, 0.26, 3]} />
          <meshStandardMaterial color={['#c8322a', '#f4f1ea', '#2c4f9e'][i % 3]} />
        </mesh>
      ))}
    </group>
  ),
  'lucky-cat': (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.18, 0.24, 0.14]} />
        <meshStandardMaterial color="#fbf8f2" />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshStandardMaterial color="#fbf8f2" />
      </mesh>
      <mesh position={[0.08, 0.34, 0.04]}>
        <boxGeometry args={[0.04, 0.1, 0.04]} />
        <meshStandardMaterial color="#d9a441" />
      </mesh>
    </group>
  ),
  'tea-set': (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.11, 12, 10]} />
        <meshStandardMaterial color="#7a4b2a" />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.04, 0.05]}>
          <cylinderGeometry args={[0.04, 0.03, 0.07, 10]} />
          <meshStandardMaterial color="#efe6d6" />
        </mesh>
      ))}
    </group>
  ),
  teapot: (
    <group>
      <mesh position={[0, 0.11, 0]}>
        <sphereGeometry args={[0.12, 12, 10]} />
        <meshStandardMaterial color="#7fa7c9" />
      </mesh>
      <mesh position={[0.15, 0.12, 0]} rotation-z={-Math.PI / 3}>
        <cylinderGeometry args={[0.015, 0.025, 0.12, 8]} />
        <meshStandardMaterial color="#7fa7c9" />
      </mesh>
    </group>
  ),
  'cake-stand': (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
        <meshStandardMaterial color="#efe6d6" />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.1, 16]} />
        <meshStandardMaterial color="#c98f5d" />
      </mesh>
    </group>
  ),
  'pretzel-basket': (
    <group>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.2, 0.15, 0.1, 14]} />
        <meshStandardMaterial color="#b78a55" />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 0.13, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.07, 0.025, 6, 14]} />
          <meshStandardMaterial color="#8a4f22" />
        </mesh>
      ))}
    </group>
  ),
};

/** The Culture Pack's props at the café. */
export function Props() {
  const packId = useGame(selectCulturePackId);
  const props = CULTURE_PACKS[packId].props;
  let counterProps = 0;
  return props.map((propId) => {
    const position: Vec3 = SPOT_FOR_PROP[propId] === 'door' ? PROP_SPOTS.door : PROP_SPOTS.counter[counterProps++ % PROP_SPOTS.counter.length]!;
    return (
      <group key={propId} position={[...position]}>
        {SHAPES[propId]}
      </group>
    );
  });
}
