import { useEffect } from 'react';
import { NAMED_NPCS } from '../content/index.ts';
import { selectConversation, selectInteractable, selectWorldKeysOff, useGame } from '../store/index.ts';

/** "Press E to …" while the Character is close enough to use something, and E to use it. */
export function InteractionPrompt() {
  const interactable = useGame(selectInteractable);
  const talking = useGame(selectConversation) !== null;
  const keysOff = useGame(selectWorldKeysOff);
  const drinkWater = useGame((s) => s.drinkWater);
  const talk = useGame((s) => s.talk);
  const active = interactable !== null && !talking && !keysOff;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || e.repeat) return;
      if (interactable === 'tap') drinkWater();
      else talk();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, interactable, drinkWater, talk]);

  if (!active) return null;
  // English until the i18n module lands (ticket 12).
  return (
    <div className="prompt">
      Press <kbd>E</kbd> {interactable === 'tap' ? 'to drink tap water' : `to talk — ${NAMED_NPCS[interactable].role}`}
    </div>
  );
}
