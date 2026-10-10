import { languageEndonym, useTranslation } from '../i18n/index.ts';
import { LANGUAGE_CODES, type LanguageCode } from '../sim/index.ts';
import {
  selectInputMode,
  selectMicRetry,
  selectNativeLanguage,
  selectReadingAids,
  selectScreen,
  selectTalkMode,
  selectTargetLanguage,
  selectTooltipsOn,
  selectVolumes,
  useGame,
  type VolumeBus,
} from '../store/index.ts';
import { CREDITS, type Credit } from './credits.ts';

const VOLUME_BUSES: VolumeBus[] = ['master', 'music', 'ambient', 'voice', 'ui'];

/**
 * Every device setting, kept for this browser whichever save is played: the
 * Native Language, volumes, speaking, reading aids and tooltips. Credits opens
 * from the bottom. On the title screen and in the pause menu.
 */
export function SettingsPanel({ onOpenCredits }: { onOpenCredits: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <h2>{t('settings.heading')}</h2>
      <p>{t('settings.kept')}</p>
      <NativeLanguageSetting />
      <VolumeSettings />
      <SpeakingSettings />
      <ReadingSettings />
      <button type="button" onClick={onOpenCredits}>
        {t('settings.credits')}
      </button>
    </>
  );
}

function NativeLanguageSetting() {
  const { t } = useTranslation();
  const nativeLanguage = useGame(selectNativeLanguage);
  // In a game, never the language it's learning.
  const learning = useGame((s) => (selectScreen(s) === 'playing' ? selectTargetLanguage(s) : null));
  const setNativeLanguage = useGame((s) => s.setNativeLanguage);
  return (
    <label className="settings-row">
      <span>
        {t('settings.language')}
        <small>{t('settings.languageNote')}</small>
      </span>
      <select value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value as LanguageCode)}>
        {LANGUAGE_CODES.map((language) => (
          <option key={language} value={language} lang={language} disabled={language === learning}>
            {languageEndonym(language)}
          </option>
        ))}
      </select>
    </label>
  );
}

function VolumeSettings() {
  const { t } = useTranslation();
  const volumes = useGame(selectVolumes);
  const setVolume = useGame((s) => s.setVolume);
  return (
    <fieldset className="settings-group">
      <legend>{t('settings.volume')}</legend>
      {VOLUME_BUSES.map((bus) => (
        <label key={bus} className="settings-volume">
          <span>{t(`settings.volumes.${bus}`)}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(volumes[bus] * 100)}
            onChange={(e) => setVolume(bus, Number(e.target.value) / 100)}
          />
          <output>{Math.round(volumes[bus] * 100)}%</output>
        </label>
      ))}
    </fieldset>
  );
}

/** The input mode (the mic or the Typed Fallback), Retry microphone, and push-to-talk or open mic. */
function SpeakingSettings() {
  const { t } = useTranslation();
  const inputMode = useGame(selectInputMode);
  const talkMode = useGame(selectTalkMode);
  const micRetry = useGame(selectMicRetry);
  const chooseTypedFallback = useGame((s) => s.chooseTypedFallback);
  const retryMic = useGame((s) => s.retryMic);
  const setTalkMode = useGame((s) => s.setTalkMode);
  return (
    <fieldset className="settings-group">
      <legend>{t('settings.speaking')}</legend>
      <label className="title-toggle">
        <input type="radio" name="input-mode" checked={inputMode === 'mic'} onChange={retryMic} />
        <span>{t('settings.inputMic')}</span>
      </label>
      <label className="title-toggle">
        <input type="radio" name="input-mode" checked={inputMode === 'typed'} onChange={chooseTypedFallback} />
        <span>{t('settings.inputTyped')}</span>
      </label>
      {inputMode === 'typed' && (
        <div className="settings-retry">
          <button type="button" disabled={micRetry === 'trying'} onClick={retryMic}>
            {t('settings.retryMic')}
          </button>
          <span role="status">
            {micRetry === 'trying' && t('settings.retrying')}
            {micRetry === 'failed' && t('settings.retryFailed')}
          </span>
        </div>
      )}
      <label className="title-toggle">
        <input type="radio" name="talk-mode" checked={talkMode === 'push-to-talk'} onChange={() => setTalkMode('push-to-talk')} />
        <span>
          {t('settings.pushToTalk')}
          <small>{t('settings.pushToTalkNote')}</small>
        </span>
      </label>
      <label className="title-toggle">
        <input type="radio" name="talk-mode" checked={talkMode === 'open-mic'} onChange={() => setTalkMode('open-mic')} />
        <span>
          {t('settings.openMic')}
          <small>{t('settings.openMicNote')}</small>
        </span>
      </label>
    </fieldset>
  );
}

function ReadingSettings() {
  const { t } = useTranslation();
  const readingAids = useGame(selectReadingAids);
  const tooltips = useGame(selectTooltipsOn);
  const setReadingAids = useGame((s) => s.setReadingAids);
  const setTooltips = useGame((s) => s.setTooltips);
  return (
    <fieldset className="settings-group">
      <legend>{t('settings.readingHeading')}</legend>
      <label className="title-toggle">
        <input type="checkbox" checked={readingAids.show} onChange={(e) => setReadingAids({ show: e.target.checked })} />
        <span>
          {t('settings.readingAids')}
          <small>{t('settings.readingAidsNote')}</small>
        </span>
      </label>
      <label className="title-toggle">
        <input
          type="checkbox"
          checked={readingAids.show && readingAids.romaji}
          disabled={!readingAids.show}
          onChange={(e) => setReadingAids({ romaji: e.target.checked })}
        />
        <span>
          {t('settings.romaji')}
          <small>{t('settings.romajiNote')}</small>
        </span>
      </label>
      <label className="title-toggle">
        <input type="checkbox" checked={tooltips} onChange={(e) => setTooltips(e.target.checked)} />
        <span>
          {t('settings.tooltips')}
          <small>{t('settings.tooltipsNote')}</small>
        </span>
      </label>
    </fieldset>
  );
}

function CreditList({ credits }: { credits: Credit[] }) {
  const { t } = useTranslation();
  return (
    <ul className="credits-list">
      {credits.map((credit) => (
        <li key={`${credit.creator}/${credit.asset}`}>
          <a href={credit.source} target="_blank" rel="noreferrer">
            {credit.asset}
          </a>{' '}
          {t('credits.by', { creator: credit.creator })}
          <small>
            {credit.licence} · {credit.usedFor}
          </small>
        </li>
      ))}
    </ul>
  );
}

/** The credits screen: every CC-BY asset with its creator, source and licence, then the CC0 ones, all from `CREDITS.md`. */
export function CreditsScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <h2>{t('credits.heading')}</h2>
      <section className="credits-section" aria-label={t('credits.ccBy')}>
        <h3>{t('credits.ccBy')}</h3>
        {CREDITS.ccBy.length === 0 ? <p>{t('credits.ccByNone')}</p> : <CreditList credits={CREDITS.ccBy} />}
      </section>
      <section className="credits-section" aria-label={t('credits.cc0')}>
        <h3>{t('credits.cc0')}</h3>
        <CreditList credits={CREDITS.cc0} />
      </section>
      <button type="button" onClick={onBack}>
        {t('credits.back')}
      </button>
    </>
  );
}
