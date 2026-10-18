import { useEffect, useRef, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ACCESSORY_COLOUR_IDS, ACCESSORY_COLOURS, EYEWEAR_IDS, HAT_IDS, NECKWEAR_IDS } from '../content/index.ts';
import { languageEndonym, Trans, useTranslation } from '../i18n/index.ts';
import { LANGUAGE_CODES, STARTING_STEPS } from '../sim/index.ts';
import {
  selectMicLevel,
  selectNativeLanguage,
  selectSetup,
  selectSetupCanGoOn,
  selectSetupIsLast,
  selectTargetLanguages,
  useGame,
  type Setup,
} from '../store/index.ts';

/**
 * New game setup, one screen at a time: the Native Language, the Target
 * Language, the self-assessment and name, the Appearance Preset, then the mic
 * check (unless this browser has passed it). ↑ ↓ choose, Enter goes on and Esc
 * goes back (from the first screen, to the title).
 */
export function SetupScreen() {
  const { t } = useTranslation();
  const setup = useGame(selectSetup);
  const canGoOn = useGame(selectSetupCanGoOn);
  const last = useGame(selectSetupIsLast);
  const setupNext = useGame((s) => s.setupNext);
  const setupBack = useGame((s) => s.setupBack);
  const skipMicCheck = useGame((s) => s.skipMicCheck);
  const start = useRef<HTMLButtonElement>(null);
  const micCheckDone = setup?.step === 'micCheck' && canGoOn;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setupBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setupBack]);

  // Once the mic check is done, Enter starts rather than skips.
  useEffect(() => {
    if (micCheckDone) start.current?.focus();
  }, [micCheckDone]);

  if (!setup) return null;

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
        {setup.step === 'micCheck' && <MicCheck setup={setup} />}
        <div className="setup-actions">
          <button type="button" onClick={setupBack}>
            {t('setup.back')}
          </button>
          {setup.step === 'micCheck' && (
            // Focused, so Enter skips until the check is done.
            <button type="button" className="setup-skip" onClick={skipMicCheck} autoFocus>
              {t('setup.micCheck.skip')}
            </button>
          )}
          <button ref={start} type="submit" className="primary" disabled={!canGoOn}>
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

/**
 * Screen 4: the Appearance Preset, part by part: what the Character wears (a hat, glasses, something round the neck) and
 * its colour. Everyone in town is Clawd; this is what makes the Character theirs. The Character stands in the live
 * scene beside the panel, wearing the look as it's chosen.
 */
function Appearance({ setup }: { setup: Setup }) {
  const { t } = useTranslation();
  const chooseAppearance = useGame((s) => s.chooseAppearance);
  const { appearance } = setup;

  return (
    <>
      <Heading title={t('setup.appearance.heading', { name: setup.characterName.trim() })} body={t('setup.appearance.body')} />
      <AppearancePart legend={t('setup.appearance.hat')} className="setup-choices-hats">
        {HAT_IDS.map((hat) => (
          <Choice key={hat} name="hat" checked={hat === appearance.hat} autoFocus={hat === appearance.hat} onChoose={() => chooseAppearance({ hat })}>
            <small>{t(`setup.appearance.hats.${hat}`)}</small>
          </Choice>
        ))}
      </AppearancePart>
      <AppearancePart legend={t('setup.appearance.eyewear')} className="setup-choices-eyewear">
        {EYEWEAR_IDS.map((eyewear) => (
          <Choice key={eyewear} name="eyewear" checked={eyewear === appearance.eyewear} autoFocus={false} onChoose={() => chooseAppearance({ eyewear })}>
            <small>{t(`setup.appearance.eyewears.${eyewear}`)}</small>
          </Choice>
        ))}
      </AppearancePart>
      <AppearancePart legend={t('setup.appearance.neckwear')} className="setup-choices-neckwear">
        {NECKWEAR_IDS.map((neckwear) => (
          <Choice key={neckwear} name="neckwear" checked={neckwear === appearance.neckwear} autoFocus={false} onChoose={() => chooseAppearance({ neckwear })}>
            <small>{t(`setup.appearance.neckwears.${neckwear}`)}</small>
          </Choice>
        ))}
      </AppearancePart>
      <AppearancePart legend={t('setup.appearance.colour')} className="setup-choices-swatches">
        {ACCESSORY_COLOUR_IDS.map((colour) => (
          <Swatch
            key={colour}
            name="colour"
            colour={ACCESSORY_COLOURS[colour]}
            label={t(`setup.appearance.colours.${colour}`)}
            checked={colour === appearance.colour}
            onChoose={() => chooseAppearance({ colour })}
          />
        ))}
      </AppearancePart>
    </>
  );
}

/** One part of the look, as a row of choices under its name. */
function AppearancePart({ legend, className, children }: { legend: string; className: string; children: ReactNode }) {
  return (
    <fieldset className={`setup-choices setup-appearance-part ${className}`}>
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

/** A colour to choose, named for screen readers and on hover. */
function Swatch(props: { name: string; colour: string; label: string; checked: boolean; onChoose: () => void }) {
  return (
    <label className="setup-swatch" title={props.label} style={{ '--swatch': props.colour } as CSSProperties}>
      <input type="radio" name={props.name} aria-label={props.label} checked={props.checked} onChange={props.onChoose} />
    </label>
  );
}

/**
 * Screen 5: the mic check. A live level meter while the mic listens; it passes
 * once it hears the Player. Without a mic the game goes on in the Typed
 * Fallback. Skip goes on at any time.
 */
function MicCheck({ setup }: { setup: Setup }) {
  const { t } = useTranslation();
  const level = useGame(selectMicLevel);
  const percent = Math.round(level * 100);

  return (
    <>
      <Heading title={t('setup.micCheck.heading')} body={t('setup.micCheck.body')} />
      <p className="setup-tip">{t('setup.micCheck.headphones')}</p>
      {setup.mic !== 'unavailable' && (
        <div
          className="mic-meter"
          role="meter"
          aria-label={t('setup.micCheck.level')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          data-heard={setup.mic === 'heard' || undefined}
          style={{ '--level': level } as CSSProperties}
        />
      )}
      <p className="setup-mic-status" role="status" data-status={setup.mic}>
        {setup.mic && t(`setup.micCheck.status.${setup.mic}`)}
      </p>
    </>
  );
}
