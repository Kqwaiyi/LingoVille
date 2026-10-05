import { TOWN_NPCS } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import type { LanguageCode } from '../sim/index.ts';
import { selectInPhrasebook, selectReadingAids, useGame, type JournalPage, type NewWord } from '../store/index.ts';
import { formatClock } from './format.ts';
import { ReadingLine, RubyText } from './Ruby.tsx';

/** 🔊: hear a phrase said aloud. On a Journal page, labelled in the page's language. */
export function HearItSaid({ text, language }: { text: string; language?: LanguageCode }) {
  const { t } = useTranslation(undefined, { lng: language });
  const hearItSaid = useGame((s) => s.hearItSaid);
  return (
    <button type="button" className="hear-it-said" aria-label={t('page.hear', { text })} onClick={() => hearItSaid(text)}>
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
  const { t } = usePageTranslation(page);
  return (
    <details className="journal-lines">
      <summary>{t('page.conversation')}</summary>
      <ol>
        {page.lines.map((line, i) => (
          <li key={i} data-speaker={line.speaker}>
            <span className="journal-line-speaker">{line.speaker === 'npc' ? (page.npcName ?? t(`roles.${TOWN_NPCS[page.npcId].role}.name`)) : t('page.you')}</span>
            <ReadingLine language={page.targetLanguage} text={line.text} segments={line.reading} />
          </li>
        ))}
      </ol>
    </details>
  );
}

/** "+ Phrasebook": keeps a new word in the personal phrasebook, glossed in the page's Native Language. */
function AddToPhrasebook({ word, glossLanguage }: { word: NewWord; glossLanguage: JournalPage['nativeLanguage'] }) {
  const { t } = usePageTranslation({ nativeLanguage: glossLanguage });
  const kept = useGame(selectInPhrasebook(word.base, glossLanguage));
  const addToPhrasebook = useGame((s) => s.addToPhrasebook);
  if (kept) return <span className="journal-kept">{t('page.kept')}</span>;
  return (
    <button
      type="button"
      className="journal-keep"
      aria-label={t('page.keepLabel', { word: word.base })}
      onClick={() => addToPhrasebook(word, glossLanguage)}
    >
      {t('page.keep')}
    </button>
  );
}

/** A Journal page stays in the Native Language it was written in, even after the Player changes it. */
function usePageTranslation(page: Pick<JournalPage, 'nativeLanguage'>) {
  return useTranslation(undefined, { lng: page.nativeLanguage });
}

/** Who and where (the NPC by the name the Character knew them by then, or by their role), and when. */
export function usePageHeading(page: JournalPage) {
  const { t } = usePageTranslation(page);
  return {
    title: `${page.npcName ?? t(`roles.${TOWN_NPCS[page.npcId].role}.name`)} · ${page.placeName}`,
    when: t('page.when', { day: page.day, time: formatClock(Math.floor(page.minuteOfDay)) }),
  };
}

/**
 * One Recap as a lined Journal page: the outcome, up to three corrections and
 * new words. The same page shows in the conversation column and in the Journal,
 * where the conversation itself can be read back with its corrected reading aids.
 */
export function JournalPageView({ page, withConversation = false }: { page: JournalPage; withConversation?: boolean }) {
  const { t } = usePageTranslation(page);
  const { title, when } = usePageHeading(page);
  const { recap } = page;
  return (
    <article className="journal-page" lang={page.nativeLanguage} aria-label={t('page.label')}>
      <header className="journal-page-header">
        <h3>{title}</h3>
        <p>{when}</p>
        {page.noHelpNeeded && <span className="journal-sticker">{t('page.noHelpNeeded')}</span>}
      </header>
      {recap ? (
        <>
          <p className="journal-outcome">{recap.outcome}</p>
          {recap.corrections.length > 0 && (
            <section aria-label={t('page.corrections')}>
              <h4>{t('page.trySaying')}</h4>
              <ul className="journal-corrections">
                {recap.corrections.map((correction, i) => (
                  <li key={i}>
                    <p className="journal-said" lang={page.targetLanguage}>
                      <s>{correction.said}</s>
                    </p>
                    <p className="journal-natural" lang={page.targetLanguage}>
                      {correction.natural} <HearItSaid text={correction.natural} language={page.nativeLanguage} />
                    </p>
                    <p className="journal-why">{correction.why}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {recap.newWords.length > 0 && (
            <section aria-label={t('page.newWords')}>
              <h4>{t('page.newWords')}</h4>
              <ul className="journal-words">
                {recap.newWords.map((word, i) => (
                  <li key={i}>
                    <span lang={page.targetLanguage}>
                      <Reading base={word.base} reading={word.reading} language={page.targetLanguage} />
                    </span>{' '}
                    <HearItSaid text={word.base} language={page.nativeLanguage} /> <span className="journal-gloss">{word.gloss}</span>{' '}
                    <AddToPhrasebook word={word} glossLanguage={page.nativeLanguage} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="journal-outcome">{t('page.noRecap')}</p>
      )}
      {withConversation && page.lines.length > 0 && <ConversationLines page={page} />}
    </article>
  );
}
