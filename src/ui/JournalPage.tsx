import { NAMED_NPCS } from '../content/index.ts';
import { useGame, type JournalPage } from '../store/index.ts';
import { formatClock } from './format.ts';

// English until the i18n module lands (ticket 12).

/** 🔊: hear a phrase said aloud. */
function HearItSaid({ text }: { text: string }) {
  const hearItSaid = useGame((s) => s.hearItSaid);
  return (
    <button type="button" className="hear-it-said" aria-label={`Hear “${text}” said`} onClick={() => hearItSaid(text)}>
      🔊
    </button>
  );
}

/** A word with its reading over it, when it has one. */
function Reading({ base, reading }: { base: string; reading: string }) {
  if (!reading || reading === base) return <>{base}</>;
  return (
    <ruby>
      {base}
      <rt>{reading}</rt>
    </ruby>
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
 * new words. The same page shows in the conversation column and in the Journal.
 */
export function JournalPageView({ page }: { page: JournalPage }) {
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
                      <Reading base={word.base} reading={word.reading} />
                    </span>{' '}
                    <HearItSaid text={word.base} /> <span className="journal-gloss">{word.gloss}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="journal-outcome">No Recap could be written for this conversation.</p>
      )}
    </article>
  );
}
