import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { selectSetup, selectShowcaseAppearance, selectTitlePlaceId, useGame } from '../store/index.ts';
import { CharacterFigure } from './CharacterFigure.tsx';
import { spawnAt } from './town.ts';

/** How the title screen frames the Character: from above the front wall. */
const SHOWCASE = {
  distance: 6,
  cameraHeight: 4.6,
  lookHeight: 1.1,
  /** How far the camera looks to the Character's side, so they stand in the right third of the screen. */
  frameShift: 2.8,
} as const;

/** While the Player chooses the look: close up, head to toe, so the face and hair show. */
const PORTRAIT = { distance: 3.4, cameraHeight: 1.7, lookHeight: 1.05, frameShift: 1.15 } as const;

/** The camera's slow side-to-side drift: this far either side of straight ahead, in radians, this slowly (radians of the swing's phase per second). */
const DRIFT = { swing: 0.15, speed: 0.08 } as const;

/** How quickly the camera eases from one framing to the other (per second). */
const EASE = 3;

/**
 * The title screen's view of the live town: the Character standing at the
 * place where the Continue save was left, facing a slowly drifting camera.
 * Behind setup, the Character wears the look being chosen, and on the
 * appearance screen the camera comes in close.
 */
export function TitleShowcase() {
  const placeId = useGame(selectTitlePlaceId);
  const appearance = useGame(selectShowcaseAppearance);
  const choosingLook = useGame((s) => selectSetup(s)?.step === 'appearance');
  const [x, , z] = spawnAt(placeId);
  // How far into the portrait framing the camera is, from 0 to 1.
  const closeUp = useRef(0);

  useFrame(({ camera, clock }, delta) => {
    closeUp.current += ((choosingLook ? 1 : 0) - closeUp.current) * Math.min(1, EASE * delta);
    const t = closeUp.current;
    const mix = (key: keyof typeof SHOWCASE) => SHOWCASE[key] + (PORTRAIT[key] - SHOWCASE[key]) * t;
    const [distance, cameraHeight, lookHeight, frameShift] = [mix('distance'), mix('cameraHeight'), mix('lookHeight'), mix('frameShift')];
    const angle = Math.sin(clock.elapsedTime * DRIFT.speed) * DRIFT.swing;
    // In front of the Character (+z), facing them.
    camera.position.set(x + Math.sin(angle) * distance, cameraHeight, z + Math.cos(angle) * distance);
    // Looking a little to the camera's left of the Character puts them right of centre.
    camera.lookAt(x - Math.cos(angle) * frameShift, lookHeight, z + Math.sin(angle) * frameShift);
  });

  return (
    <group position={[x, 0, z]}>
      <CharacterFigure appearance={appearance} />
    </group>
  );
}
