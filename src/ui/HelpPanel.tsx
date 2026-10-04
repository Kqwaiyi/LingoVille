import { CULTURE_PACKS } from '../content/index.ts';
import {
  selectCulturePackId,
  selectHints,
  selectNativeLanguage,
  selectPhrasebook,
  selectPlacePhrasebook,
  useGame,
} from '../store/index.ts';
import { HearItSaid, Reading } from './JournalPage.tsx';

// English until the i18n module lands (ticket 12).

function Hints() {
  const hints = useGame(selectHints);
  const packId = useGame(selectCulturePackId);
  return (
    <section className="help-section" aria-label="Hints" aria-busy={hints?.status === 'loading'}>
      <h4>Try saying</h4>
      {hints?.status === 'loading' && <p className="help-note">Thinking of something to say…</p>}
      {hints?.status === 'failed' && <p className="help-note">No hints this time. The phrasebooks below can still help.</p>}
      {hints?.status === 'ready' && (
        <ul className="help-list">
          {hints.hints.map((hint) => (
            <li key={hint.text}>
              <p className="help-phrase" lang={packId}>
                {hint.text} <HearItSaid text={hint.text} />
              </p>
              <p className="help-gloss">{hint.translation}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PlacePhrasebook() {
  const phrases = useGame(selectPlacePhrasebook);
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  if (phrases.length === 0) return null;
  return (
    <section className="help-section" aria-label="Phrasebook for this place">
      {/* The café is the only staffed place until the whole town lands (ticket 13). */}
      <h4>At {CULTURE_PACKS[packId].cafe.name}</h4>
      <ul className="help-list">
        {phrases.map((phrase) => (
          <li key={phrase.text}>
            <p className="help-phrase" lang={packId}>
              <Reading base={phrase.text} reading={phrase.reading} language={packId} /> <HearItSaid text={phrase.text} />
            </p>
            {phrase.glosses[nativeLanguage] && <p className="help-gloss">{phrase.glosses[nativeLanguage]}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MyPhrasebook() {
  const phrasebook = useGame(selectPhrasebook);
  const packId = useGame(selectCulturePackId);
  return (
    <section className="help-section" aria-label="My phrasebook">
      <h4>My phrasebook</h4>
      {phrasebook.length === 0 ? (
        <p className="help-note">Words you keep from your Recaps with + Phrasebook show here.</p>
      ) : (
        <ul className="help-list">
          {phrasebook.map((entry) => (
            <li key={`${entry.text}-${entry.glossLanguage}`}>
              <p className="help-phrase" lang={packId}>
                <Reading base={entry.text} reading={entry.reading} language={packId} /> <HearItSaid text={entry.text} />
              </p>
              <p className="help-gloss" lang={entry.glossLanguage}>
                {entry.gloss}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The Help tab: hints for this moment, the place's phrasebook, then the Player's own. The conversation waits meanwhile. */
export function HelpPanel() {
  return (
    <div className="help" role="tabpanel" aria-label="Help">
      <p className="help-waits" role="status">
        The conversation waits while Help is open
      </p>
      <Hints />
      <PlacePhrasebook />
      <MyPhrasebook />
    </div>
  );
}
