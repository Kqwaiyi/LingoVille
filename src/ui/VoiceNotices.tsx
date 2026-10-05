import { useEffect } from 'react';
import { formatTime, TOWN_NPCS } from '../content/index.ts';
import { Trans, useTranslation } from '../i18n/index.ts';
import { CLOCK } from '../sim/index.ts';
import { selectToast, selectVoiceUnavailable, useGame } from '../store/index.ts';

const TOAST_MS = 5_000;

/** A notice at the top of the screen that clears itself, such as a network abandonment, a skipped Recap or a load from the backup. */
export function Toast() {
  const { t } = useTranslation();
  const toast = useGame(selectToast);
  const dismissToast = useGame((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <div className="toast" role="status">
      {toast.kind === 'recapSaved' && t('toast.recapSaved')}
      {toast.kind === 'loadedBackup' && t('toast.loadedBackup')}
      {toast.kind === 'tooEarlyForBed' && t('toast.tooEarlyForBed', { time: formatTime(CLOCK.bedUsableFrom) })}
      {toast.kind === 'npcSteppedAway' && t('toast.npcSteppedAway', { who: t(`roles.${toast.npcId}.subject`) })}
      {toast.kind === 'nothingToSay' && t('toast.nothingToSay', { who: t(`roles.${TOWN_NPCS[toast.npcId].role}.subject`) })}
    </div>
  );
}

/** Shown instead of a conversation when the gateway can't mint a token, so voice can't work at all. */
export function VoiceUnavailableScreen() {
  const { t } = useTranslation();
  const unavailable = useGame(selectVoiceUnavailable);
  const dismiss = useGame((s) => s.dismissVoiceUnavailable);

  useEffect(() => {
    if (!unavailable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [unavailable, dismiss]);

  if (!unavailable) return null;
  return (
    <div className="screen-backdrop">
      <section className="voice-unavailable" role="alertdialog" aria-labelledby="voice-unavailable-title">
        <h2 id="voice-unavailable-title">{t('voiceUnavailable.title')}</h2>
        <p>
          <Trans i18nKey="voiceUnavailable.body" components={{ code: <code /> }} />
        </p>
        <button type="button" className="primary" onClick={dismiss} autoFocus>
          {t('voiceUnavailable.back')}
        </button>
      </section>
    </div>
  );
}
