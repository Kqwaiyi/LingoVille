import { useFrame } from '@react-three/fiber';
import { selectTitlePlaceId, useGame } from '../store/index.ts';
import { CharacterModel, STANDING_HEIGHT } from './Character.tsx';
import { SPAWN_POINTS } from './town.ts';

/** How the title screen frames the Character: from above the front wall, with a slow side-to-side drift. */
const SHOWCASE = {
  distance: 6,
  cameraHeight: 4.6,
  lookHeight: 1.1,
  /** How far the camera looks to the Character's side, so they stand in the right third of the screen. */
  frameShift: 2.8,
  /** The drift swings this far either side of straight ahead, in radians, */
  swing: 0.15,
  /** this slowly (radians of the swing's phase per second). */
  driftSpeed: 0.08,
} as const;

/**
 * The title screen's view of the live town: the Character standing at the
 * place where the Continue save was left, facing a slowly drifting camera.
 */
export function TitleShowcase() {
  const placeId = useGame(selectTitlePlaceId);
  const [x, , z] = SPAWN_POINTS[placeId];

  useFrame(({ camera, clock }) => {
    const angle = Math.sin(clock.elapsedTime * SHOWCASE.driftSpeed) * SHOWCASE.swing;
    // In front of the Character (+z), facing them.
    camera.position.set(x + Math.sin(angle) * SHOWCASE.distance, SHOWCASE.cameraHeight, z + Math.cos(angle) * SHOWCASE.distance);
    // Looking a little to the camera's left of the Character puts them right of centre.
    camera.lookAt(x - Math.cos(angle) * SHOWCASE.frameShift, SHOWCASE.lookHeight, z + Math.sin(angle) * SHOWCASE.frameShift);
  });

  return (
    <group position={[x, STANDING_HEIGHT, z]}>
      <CharacterModel />
    </group>
  );
}
