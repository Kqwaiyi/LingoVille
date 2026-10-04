import { useEffect, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { APPEARANCE_PRESET_IDS } from '../content/index.ts';
import { languageEndonym, Trans, useTranslation } from '../i18n/index.ts';
import { LANGUAGE_CODES, STARTING_STEPS } from '../sim/index.ts';
import {
  selectNativeLanguage,
  selectSetup,
  selectSetupCanGoOn,
  selectTargetLanguages,
  SETUP_STEPS,
  useGame,
  type Setup,
} from '../store/index.ts';

/**
 * New game setup, one screen at a time: the Native Language, the Target
 * Language, the self-assessment and name, then the Appearance Preset. ↑ ↓
 * choose, Enter goes on and Esc goes back (from the first screen, to the title).
 */
export function SetupScreen() {
  const { t } = useTranslation();
  const setup = useGame(selectSetup);
  const canGoOn = useGame(selectSetupCanGoOn);
  const setupNext = useGame((s) => s.setupNext);
  const setupBack = useGame((s) => s.setupBack);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setupBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setupBack]);

  if (!setup) return null;
  const last = setup.step === SETUP_STEPS.at(-1);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setupNext();
  };
  // Enter on a choice goes on, as it does on a button.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement) || e.target.type !== 'radio') return;
    e.preventDefault();
    setupNext();
  };

  return (
    <div className="title-screen setup-screen">
      {/* Keyed by screen, so each one starts with its own choice focused. */}
      <form key={setup.step} className="title-panel setup-panel" aria-labelledby="setup-title" onSubmit={submit} onKeyDown={onKeyDown}>
        {setup.step === 'nativeLanguage' && <NativeLanguage />}
        {setup.step === 'targetLanguage' && <TargetLanguage setup={setup} />}
        {setup.step === 'aboutYou' && <AboutYou setup={setup} />}
        {setup.step === 'appearance' && <Appearance setup={setup} />}
        <div className="setup-actions">
          <button type="button" onClick={setupBack}>
            {t('setup.back')}
          </button>
          <button type="submit" className="primary" disabled={!canGoOn}>
            {last ? t('setup.start') : t('setup.next')}
          </button>
        </div>
      </form>
      <p className="title-keys" aria-hidden>
        <Trans i18nKey="title.keys" components={{ kbd: <kbd /> }} />
      </p>
    </div>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h2 id="setup-title">{title}</h2>
      <p>{body}</p>
    </>
  );
}

/** A radio choice in a setup grid. */
function Choice(props: { name: string; checked: boolean; autoFocus: boolean; onChoose: () => void; children: ReactNode }) {
  return (
    <label className="setup-choice">
      <input type="radio" name={props.name} checked={props.checked} autoFocus={props.autoFocus} onChange={props.onChoose} />
      {props.children}
    </label>
  );
}

/** Screen 1: the Native Language, pre-selected from the device settings. Choosing one switches the whole UI to it at once. */
function NativeLanguage() {
  const { t } = useTranslation();
  const nativeLanguage = useGame(selectNativeLanguage);
  const setNativeLanguage = useGame((s) => s.setNativeLanguage);

  return (
    <>
      <Heading title={t('setup.nativeLanguage.heading')} body={t('setup.nativeLanguage.body')} />
      <fieldset className="setup-choices">
        <legend className="visually-hidden">{t('setup.nativeLanguage.choices')}</legend>
        {LANGUAGE_CODES.map((language) => (
          <Choice
            key={language}
            name="native-language"
            checked={language === nativeLanguage}
            autoFocus={language === nativeLanguage}
            onChoose={() => setNativeLanguage(language)}
          >
            <span lang={language}>{languageEndonym(language)}</span>
            {/* The language's name in the one chosen, unless that's the same word. */}
            {language !== nativeLanguage && <small>{t(`languages.${language}`)}</small>}
          </Choice>
        ))}
      </fieldset>
    </>
  );
}

/** Screen 2: the three other languages, each naming the Culture Pack it's set in. */
function TargetLanguage({ setup }: { setup: Setup }) {
  const { t } = useTranslation();
  const targetLanguages = useGame(selectTargetLanguages);
  const chooseTargetLanguage = useGame((s) => s.chooseTargetLanguage);

  return (
    <>
      <Heading title={t('setup.targetLanguage.heading')} body={t('setup.targetLanguage.body')} />
      <fieldset className="setup-choices setup-choices-single">
        <legend className="visually-hidden">{t('setup.targetLanguage.choices')}</legend>
        {targetLanguages.map((language, i) => (
          <Choice
            key={language}
            name="target-language"
            checked={language === setup.targetLanguage}
            autoFocus={setup.targetLanguage ? language === setup.targetLanguage : i === 0}
            onChoose={() => chooseTargetLanguage(language)}
          >
            <span lang={language}>{languageEndonym(language)}</span>
            <small>{t(`setup.targetLanguage.packs.${language}`)}</small>
          </Choice>
        ))}
      </fieldset>
    </>
  );
}

/** Screen 3: the self-assessment, four plain sentences for A1 to B2, and the Character's name. */
function AboutYou({ setup }: { setup: Setup }) {
  const { t } = useTranslation();
  const chooseStartingStep = useGame((s) => s.chooseStartingStep);
  const nameCharacter = useGame((s) => s.nameCharacter);
  const language = t(`languages.${setup.targetLanguage!}`);

  return (
    <>
      <Heading title={t('setup.aboutYou.heading', { language })} body={t('setup.aboutYou.body')} />
      <fieldset className="setup-choices setup-choices-single">
        <legend className="visually-hidden">{t('setup.aboutYou.levels')}</legend>
        {STARTING_STEPS.map((step, i) => (
          <Choice
            key={step}
            name="starting-step"
            checked={step === setup.startingStep}
            autoFocus={setup.startingStep ? step === setup.startingStep : i === 0}
            onChoose={() => chooseStartingStep(step)}
          >
            <span className="setup-sentence">{t(`setup.aboutYou.level.${step}`)}</span>
          </Choice>
        ))}
      </fieldset>
      <label className="setup-name">
        {t('setup.aboutYou.name')}
        <input
          type="text"
          value={setup.characterName}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => nameCharacter(e.target.value)}
        />
      </label>
    </>
  );
}

/** Screen 4: an Appearance Preset from the pool, drawn as placeholders until the characters arrive (ticket 30a). */
function Appearance({ setup }: { setup: Setup }) {
  const { t } = useTranslation();
  const chooseAppearance = useGame((s) => s.chooseAppearance);

  return (
    <>
      <Heading title={t('setup.appearance.heading', { name: setup.characterName.trim() })} body={t('setup.appearance.body')} />
      <fieldset className="setup-choices setup-choices-presets">
        <legend className="visually-hidden">{t('setup.appearance.choices')}</legend>
        {APPEARANCE_PRESET_IDS.map((presetId, i) => (
          <Choice
            key={presetId}
            name="appearance"
            checked={presetId === setup.appearancePresetId}
            autoFocus={presetId === setup.appearancePresetId}
            onChoose={() => chooseAppearance(presetId)}
          >
            <span className="appearance-placeholder" data-preset={presetId} aria-hidden />
            <small>{t('setup.appearance.preset', { number: i + 1 })}</small>
          </Choice>
        ))}
      </fieldset>
    </>
  );
}
