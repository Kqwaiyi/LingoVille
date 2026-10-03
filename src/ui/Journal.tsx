import { useEffect, useState } from 'react';
import { selectConversation, selectJournal, selectTyping, useGame } from '../store/index.ts';
import { JournalPageView, journalPageTitle, journalPageWhen } from './JournalPage.tsx';

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

/** The full-screen Journal: every entry on the left, newest first, and the selected one on the right. */
export function Journal() {
  useJournalKeys();
  const journal = useGame(selectJournal);
  const closeJournal = useGame((s) => s.closeJournal);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!journal) return null;
  const entries = journal.entries ?? [];
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0];

  return (
    <section className="journal" role="dialog" aria-modal="true" aria-labelledby="journal-title">
      <header className="journal-header">
        <h2 id="journal-title">Journal</h2>
        <button type="button" className="journal-close" onClick={closeJournal}>
          Close <kbd>Esc</kbd>
        </button>
      </header>
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
        <div className="journal-selected">{selected && <JournalPageView page={selected} />}</div>
      </div>
    </section>
  );
}
