import { useTranslation } from '../i18n/index.ts';
import {
  selectCulturePackId,
  selectHints,
  selectNativeLanguage,
  selectPhrasebook,
  selectPlaceId,
  selectPlacePhrasebook,
  useGame,
} from '../store/index.ts';
import { HearItSaid, Reading } from './JournalPage.tsx';
import { usePlaceName } from './placeName.ts';

function Hints() {
  const { t } = useTranslation();
  const hints = useGame(selectHints);
  const packId = useGame(selectCulturePackId);
  return (
    <section className="help-section" aria-label={t('help.hints')} aria-busy={hints?.status === 'loading'}>
      <h4>{t('help.trySaying')}</h4>
      {hints?.status === 'loading' && <p className="help-note">{t('help.thinking')}</p>}
      {hints?.status === 'failed' && <p className="help-note">{t('help.noHints')}</p>}
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
  const { t } = useTranslation();
  const phrases = useGame(selectPlacePhrasebook);
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const placeId = useGame(selectPlaceId);
  const placeName = usePlaceName();
  if (phrases.length === 0) return null;
  return (
    <section className="help-section" aria-label={t('help.placePhrasebook')}>
      <h4>{t('help.at', { place: placeName(placeId, packId) })}</h4>
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
  const { t } = useTranslation();
  const phrasebook = useGame(selectPhrasebook);
  const packId = useGame(selectCulturePackId);
  return (
    <section className="help-section" aria-label={t('help.myPhrasebook')}>
      <h4>{t('help.myPhrasebook')}</h4>
      {phrasebook.length === 0 ? (
        <p className="help-note">{t('help.myPhrasebookEmpty')}</p>
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
  const { t } = useTranslation();
  return (
    <div className="help" role="tabpanel" aria-label={t('help.label')}>
      <p className="help-waits" role="status">
        {t('help.waits')}
      </p>
      <Hints />
      <PlacePhrasebook />
      <MyPhrasebook />
    </div>
  );
}
