import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n/index.ts';
import { selectPauseMenuOpen, selectSkippableFirstMorning, useGame } from '../store/index.ts';
import { CreditsScreen, SettingsPanel } from './SettingsPanel.tsx';

type PauseView = 'menu' | 'settings' | 'credits';

/** Esc outside a conversation opens the pause menu, and time stands still while it is open. */
export function PauseMenu() {
  const open = useGame(selectPauseMenuOpen);
  const openPauseMenu = useGame((s) => s.openPauseMenu);

  useEffect(() => {
    if (open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !e.repeat) openPauseMenu();
    };
    // In the capture phase, so the store still shows what was open before this Esc closes it (a conversation, the
    // Journal, the tram): the pause menu opens only on an Esc that closes nothing else.
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open, openPauseMenu]);

  // Each pause starts on the menu.
  return open ? <PauseDialog /> : null;
}

/** Resume, Settings and, during the First Morning, Skip tutorial, with Settings and the credits opening in its place. Esc steps back, and from the menu resumes. */
function PauseDialog() {
  const { t } = useTranslation();
  const closePauseMenu = useGame((s) => s.closePauseMenu);
  const skippable = useGame(selectSkippableFirstMorning);
  const skipFirstMorning = useGame((s) => s.skipFirstMorning);
  const [view, setView] = useState<PauseView>('menu');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' || e.repeat) return;
      if (view === 'credits') setView('settings');
      else if (view === 'settings') setView('menu');
      else closePauseMenu();
    };
    // Also in the capture phase: the Esc that opened the menu has passed it by then, but would still bubble up to here.
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [view, closePauseMenu]);

  return (
    <div className="screen-backdrop">
      <section className="pause-panel" role="dialog" aria-modal="true" aria-label={t('pause.heading')}>
        {view === 'menu' && (
          <>
            <h2>{t('pause.heading')}</h2>
            <ul className="pause-actions">
              <li>
                <button type="button" className="primary" autoFocus onClick={closePauseMenu}>
                  {t('pause.resume')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setView('settings')}>
                  {t('pause.settings')}
                </button>
              </li>
              {skippable && (
                <li>
                  <button type="button" onClick={skipFirstMorning}>
                    {t('pause.skipTutorial')}
                  </button>
                </li>
              )}
            </ul>
          </>
        )}
        {view === 'settings' && (
          <>
            <SettingsPanel onOpenCredits={() => setView('credits')} />
            <button type="button" onClick={() => setView('menu')}>
              {t('pause.back')}
            </button>
          </>
        )}
        {view === 'credits' && <CreditsScreen onBack={() => setView('settings')} />}
      </section>
    </div>
  );
}
