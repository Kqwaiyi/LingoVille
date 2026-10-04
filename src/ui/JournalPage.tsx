import { NAMED_NPCS } from '../content/index.ts';
import type { LanguageCode } from '../sim/index.ts';
import { selectInPhrasebook, selectReadingAids, useGame, type JournalPage, type NewWord } from '../store/index.ts';
import { formatClock } from './format.ts';
import { ReadingLine, RubyText } from './Ruby.tsx';

// English until the i18n module lands (ticket 12).

/** 🔊: hear a phrase said aloud. */
export function HearItSaid({ text }: { text: string }) {
  const hearItSaid = useGame((s) => s.hearItSaid);
  return (
    <button type="button" className="hear-it-said" aria-label={`Hear “${text}” said`} onClick={() => hearItSaid(text)}>
      🔊
    </button>
  );
}

/** A word with its reading over it, when it has one and reading aids show. */
export function Reading({ base, reading, language }: { base: string; reading: string; language: LanguageCode }) {
  const { show } = useGame(selectReadingAids);
  if (!show || !reading || reading === base) return <>{base}</>;
  return <RubyText language={language} segments={[{ base, reading }]} />;
}

/** The conversation as it was said, with the NPC's lines as corrected by the time the page was written. */
function ConversationLines({ page }: { page: JournalPage }) {
  const { role } = NAMED_NPCS[page.npcId];
  return (
    <details className="journal-lines">
      <summary>The conversation</summary>
      <ol>
        {page.lines.map((line, i) => (
          <li key={i} data-speaker={line.speaker}>
            <span className="journal-line-speaker">{line.speaker === 'npc' ? (page.npcName ?? role) : 'You'}</span>
            <ReadingLine language={page.targetLanguage} text={line.text} segments={line.reading} />
          </li>
        ))}
      </ol>
    </details>
  );
}

/** "+ Phrasebook": keeps a new word in the personal phrasebook, glossed in the page's Native Language. */
function AddToPhrasebook({ word, glossLanguage }: { word: NewWord; glossLanguage: JournalPage['nativeLanguage'] }) {
  const kept = useGame(selectInPhrasebook(word.base, glossLanguage));
  const addToPhrasebook = useGame((s) => s.addToPhrasebook);
  if (kept) return <span className="journal-kept">✓ In my phrasebook</span>;
  return (
    <button
      type="button"
      className="journal-keep"
      aria-label={`Add “${word.base}” to my phrasebook`}
      onClick={() => addToPhrasebook(word, glossLanguage)}
    >
      + Phrasebook
    </button>
  );
}

/** The NPC by the name the Character knew them by then, or by their role. */
export function journalPageTitle(page: Pick<JournalPage, 'npcId' | 'npcName' | 'placeName'>) {
  const { role } = NAMED_NPCS[page.npcId];
  return `${page.npcName ?? `${role.charAt(0).toUpperCase()}${role.slice(1)}`} · ${page.placeName}`;
}

export function journalPageWhen(page: Pick<JournalPage, 'day' | 'minuteOfDay'>) {
  return `Day ${page.day} · ${formatClock(Math.floor(page.minuteOfDay))}`;
}

/**
 * One Recap as a lined Journal page: the outcome, up to three corrections and
 * new words. The same page shows in the conversation column and in the Journal,
 * where the conversation itself can be read back with its corrected reading aids.
 */
export function JournalPageView({ page, withConversation = false }: { page: JournalPage; withConversation?: boolean }) {
  const { recap } = page;
  return (
    <article className="journal-page" lang={page.nativeLanguage} aria-label="Journal page">
      <header className="journal-page-header">
        <h3>{journalPageTitle(page)}</h3>
        <p>{journalPageWhen(page)}</p>
        {page.noHelpNeeded && <span className="journal-sticker">No Help needed</span>}
      </header>
      {recap ? (
        <>
          <p className="journal-outcome">{recap.outcome}</p>
          {recap.corrections.length > 0 && (
            <section aria-label="Corrections">
              <h4>Try saying</h4>
              <ul className="journal-corrections">
                {recap.corrections.map((correction, i) => (
                  <li key={i}>
                    <p className="journal-said" lang={page.targetLanguage}>
                      <s>{correction.said}</s>
                    </p>
                    <p className="journal-natural" lang={page.targetLanguage}>
                      {correction.natural} <HearItSaid text={correction.natural} />
                    </p>
                    <p className="journal-why">{correction.why}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {recap.newWords.length > 0 && (
            <section aria-label="New words">
              <h4>New words</h4>
              <ul className="journal-words">
                {recap.newWords.map((word, i) => (
                  <li key={i}>
                    <span lang={page.targetLanguage}>
                      <Reading base={word.base} reading={word.reading} language={page.targetLanguage} />
                    </span>{' '}
                    <HearItSaid text={word.base} /> <span className="journal-gloss">{word.gloss}</span>{' '}
                    <AddToPhrasebook word={word} glossLanguage={page.nativeLanguage} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="journal-outcome">No Recap could be written for this conversation.</p>
      )}
      {withConversation && page.lines.length > 0 && <ConversationLines page={page} />}
    </article>
  );
}
