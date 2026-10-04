import { useEffect, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { languageEndonym, Trans, useTranslation } from '../i18n/index.ts';
import { LANGUAGE_CODES } from '../sim/index.ts';
import { selectNativeLanguage, useGame } from '../store/index.ts';

/**
 * Setup screen 1: the Native Language, pre-selected from the browser's
 * languages. Choosing one switches the whole UI to it at once. ↑ ↓ choose,
 * Enter goes on and Esc goes back to the title screen.
 */
export function NativeLanguageScreen() {
  const { t } = useTranslation();
  const nativeLanguage = useGame(selectNativeLanguage);
  const setNativeLanguage = useGame((s) => s.setNativeLanguage);
  const finishSetup = useGame((s) => s.finishSetup);
  const leaveSetup = useGame((s) => s.leaveSetup);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leaveSetup();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaveSetup]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    finishSetup();
  };
  // Enter on a choice goes on, as it does on a button.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
    e.preventDefault();
    finishSetup();
  };

  return (
    <div className="title-screen setup-screen">
      <form className="title-panel setup-panel" aria-labelledby="setup-title" onSubmit={submit} onKeyDown={onKeyDown}>
        <h2 id="setup-title">{t('setup.nativeLanguage.heading')}</h2>
        <p>{t('setup.nativeLanguage.body')}</p>
        <fieldset className="language-choices">
          <legend className="visually-hidden">{t('setup.nativeLanguage.choices')}</legend>
          {LANGUAGE_CODES.map((language) => (
            <label key={language} className="language-choice">
              <input
                type="radio"
                name="native-language"
                value={language}
                checked={language === nativeLanguage}
                autoFocus={language === nativeLanguage}
                onChange={() => setNativeLanguage(language)}
              />
              <span lang={language}>{languageEndonym(language)}</span>
              {/* The language's name in the one chosen, unless that's the same word. */}
              {language !== nativeLanguage && <small>{t(`languages.${language}`)}</small>}
            </label>
          ))}
        </fieldset>
        <div className="setup-actions">
          <button type="button" onClick={leaveSetup}>
            {t('setup.back')}
          </button>
          <button type="submit" className="primary">
            {t('setup.next')}
          </button>
        </div>
      </form>
      <p className="title-keys" aria-hidden>
        <Trans i18nKey="title.keys" components={{ kbd: <kbd /> }} />
      </p>
    </div>
  );
}
