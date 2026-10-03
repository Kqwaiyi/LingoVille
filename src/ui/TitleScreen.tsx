import { useEffect } from 'react';
import { selectTitle, useGame } from '../store/index.ts';

// English until the i18n module lands (ticket 12). The full menu over the live
// town, with slot cards, arrives with ticket 08.

/** The title screen: Continue plays the most recent save; New game starts the First Morning. */
export function TitleScreen() {
  const title = useGame(selectTitle);
  const openTitle = useGame((s) => s.openTitle);
  const continueGame = useGame((s) => s.continueGame);
  const newGame = useGame((s) => s.newGame);

  useEffect(() => openTitle(), [openTitle]);

  if (!title) return null;
  const checking = title.status === 'checking';
  const canContinue = title.status === 'ready' && title.canContinue;
  const canStartNew = title.status !== 'checking' && title.canStartNew;

  return (
    <main className="title-screen">
      <nav className="title-menu" aria-label="Title menu" aria-busy={checking || undefined}>
        <h1>Insomniacs</h1>
        {canContinue && (
          <button type="button" className="primary" onClick={continueGame} autoFocus>
            Continue
          </button>
        )}
        <button type="button" className={canContinue ? undefined : 'primary'} onClick={newGame} disabled={!canStartNew}>
          New game
        </button>
        {title.status !== 'checking' && !title.canStartNew && <p className="title-note">Delete a save to start a new one</p>}
        {title.status === 'failed' && (
          <p className="title-note" role="alert">
            This save couldn’t be loaded. {title.message}
          </p>
        )}
      </nav>
    </main>
  );
}
