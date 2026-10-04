import { useEffect, useState } from 'react';
import { selectConversation, selectCulturePackId, selectJournal, selectPhrasebook, selectTyping, useGame } from '../store/index.ts';
import { HearItSaid, JournalPageView, journalPageTitle, journalPageWhen, Reading } from './JournalPage.tsx';

// English until the i18n module lands (ticket 12).

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
  const phrasebook = useGame(selectPhrasebook);
  const packId = useGame(selectCulturePackId);
  return (
    <section className="journal-phrasebook" aria-label="My phrasebook">
      {phrasebook.length === 0 ? (
        <p className="journal-empty">No words yet. Press + Phrasebook on a Recap’s new words to keep them here.</p>
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
              <span className="journal-added">Day {entry.dayAdded}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The full-screen Journal: every entry on the left, newest first, and the selected one on the right; or the phrasebook. */
export function Journal() {
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
        <h2 id="journal-title">Journal</h2>
        <div className="journal-views" role="tablist" aria-label="Journal views">
          <button type="button" role="tab" aria-selected={view === 'entries'} onClick={() => setView('entries')}>
            Entries
          </button>
          <button type="button" role="tab" aria-selected={view === 'phrasebook'} onClick={() => setView('phrasebook')}>
            Phrasebook
          </button>
        </div>
        <button type="button" className="journal-close" onClick={closeJournal}>
          Close <kbd>Esc</kbd>
        </button>
      </header>
      {view === 'phrasebook' ? (
        <PhrasebookView />
      ) : (
        <div className="journal-panes">
          <nav className="journal-list" aria-label="Journal entries">
            {journal.entries === null && <p className="journal-empty">Opening your Journal…</p>}
            {journal.failed && <p className="journal-empty">Your Journal couldn’t be read.</p>}
            {journal.entries?.length === 0 && !journal.failed && (
              <p className="journal-empty">No entries yet. Talk to someone in town, and your Recap will be kept here.</p>
            )}
            <ul>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-current={entry === selected || undefined}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <strong>{journalPageTitle(entry)}</strong>
                    <span>{journalPageWhen(entry)}</span>
                  </button>
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
