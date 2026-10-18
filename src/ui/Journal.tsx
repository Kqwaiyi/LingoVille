import { useEffect, useState } from 'react';
import { playUiSound } from '../audio/index.ts';
import { useTranslation } from '../i18n/index.ts';
import {
  selectConversation,
  selectCulturePackId,
  selectJournal,
  selectPhrasebook,
  selectTyping,
  useGame,
  type JournalPage,
} from '../store/index.ts';
import { HearItSaid, JournalPageView, Reading, usePageHeading } from './JournalPage.tsx';

/** J opens the Journal outside conversations; Esc closes it. */
function useJournalKeys() {
  const open = useGame(selectJournal) !== null;
  const talking = useGame(selectConversation) !== null;
  const typing = useGame(selectTyping);
  const openJournal = useGame((s) => s.openJournal);
  const closeJournal = useGame((s) => s.closeJournal);

  useEffect(() => {
    if (talking || typing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyJ') (open ? closeJournal : openJournal)();
      else if (e.code === 'Escape' && open) closeJournal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, talking, typing, openJournal, closeJournal]);
}

/** The personal phrasebook: every word kept with + Phrasebook, newest first. */
function PhrasebookView() {
  const { t } = useTranslation();
  const phrasebook = useGame(selectPhrasebook);
  const packId = useGame(selectCulturePackId);
  return (
    <section className="journal-phrasebook" aria-label={t('help.myPhrasebook')}>
      {phrasebook.length === 0 ? (
        <p className="journal-empty">{t('journal.phrasebookEmpty')}</p>
      ) : (
        <ul>
          {[...phrasebook].reverse().map((entry) => (
            <li key={`${entry.text}-${entry.glossLanguage}`}>
              <span className="journal-phrase" lang={packId}>
                <Reading base={entry.text} reading={entry.reading} language={packId} />
              </span>{' '}
              <HearItSaid text={entry.text} />{' '}
              <span className="journal-gloss" lang={entry.glossLanguage}>
                {entry.gloss}
              </span>
              <span className="journal-added">{t('journal.dayAdded', { day: entry.dayAdded })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** An entry in the list, by who and where, and when. */
function EntryButton({ page, selected, onSelect }: { page: JournalPage; selected: boolean; onSelect: () => void }) {
  const { title, when } = usePageHeading(page);
  return (
    <button type="button" aria-current={selected || undefined} onClick={onSelect}>
      <strong>{title}</strong>
      <span>{when}</span>
    </button>
  );
}

/** The full-screen Journal: every entry on the left, newest first, and the selected one on the right; or the phrasebook. */
export function Journal() {
  const { t } = useTranslation();
  useJournalKeys();
  const journal = useGame(selectJournal);
  const closeJournal = useGame((s) => s.closeJournal);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'entries' | 'phrasebook'>('entries');

  if (!journal) return null;
  const entries = journal.entries ?? [];
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0];

  return (
    <section className="journal" role="dialog" aria-modal="true" aria-labelledby="journal-title">
      <header className="journal-header">
        <h2 id="journal-title">{t('journal.title')}</h2>
        <div className="journal-views" role="tablist" aria-label={t('journal.views')}>
          <button type="button" role="tab" aria-selected={view === 'entries'} onClick={() => setView('entries')}>
            {t('journal.entries')}
          </button>
          <button type="button" role="tab" aria-selected={view === 'phrasebook'} onClick={() => setView('phrasebook')}>
            {t('journal.phrasebook')}
          </button>
        </div>
        <button type="button" className="journal-close" onClick={closeJournal}>
          {t('journal.close')} <kbd>Esc</kbd>
        </button>
      </header>
      {view === 'phrasebook' ? (
        <PhrasebookView />
      ) : (
        <div className="journal-panes">
          <nav className="journal-list" aria-label={t('journal.entriesLabel')}>
            {journal.entries === null && <p className="journal-empty">{t('journal.opening')}</p>}
            {journal.failed && <p className="journal-empty">{t('journal.failed')}</p>}
            {journal.entries?.length === 0 && !journal.failed && <p className="journal-empty">{t('journal.empty')}</p>}
            <ul>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <EntryButton
                    page={entry}
                    selected={entry === selected}
                    onSelect={() => {
                      if (entry !== selected) playUiSound('pageTurn');
                      setSelectedId(entry.id);
                    }}
                  />
                </li>
              ))}
            </ul>
          </nav>
          <div className="journal-selected">{selected && <JournalPageView page={selected} withConversation />}</div>
        </div>
      )}
    </section>
  );
}
