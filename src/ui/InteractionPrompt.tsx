import { useEffect } from 'react';
import { selectInteractable, useGame } from '../store/index.ts';

/** "Press E to …" while the Character is close enough to use something, and E to use it. */
export function InteractionPrompt() {
  const interactable = useGame(selectInteractable);
  const drinkWater = useGame((s) => s.drinkWater);

  useEffect(() => {
    if (interactable !== 'tap') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !e.repeat) drinkWater();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactable, drinkWater]);

  if (interactable !== 'tap') return null;
  // English until the i18n module lands (ticket 12).
  return (
    <div className="prompt">
      Press <kbd>E</kbd> to drink tap water
    </div>
  );
}
