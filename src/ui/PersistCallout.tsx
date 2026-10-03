import { selectConversation, selectPersistCallout, useGame } from '../store/index.ts';

// English until the i18n module lands (ticket 12).

/**
 * Shown once, until dismissed, when the browser won't promise to keep saves:
 * bottom right, on the title screen or in the game outside conversations.
 */
export function PersistCallout() {
  const shown = useGame(selectPersistCallout);
  const talking = useGame(selectConversation) !== null;
  const dismiss = useGame((s) => s.dismissPersistCallout);

  if (!shown || talking) return null;
  return (
    <aside className="persist-callout" aria-label="Keeping your saves">
      <p>This browser may clear your saves if it runs low on space. Export a backup now and then, from Load a save.</p>
      <button type="button" onClick={dismiss}>
        Got it
      </button>
    </aside>
  );
}
