import { useEffect } from 'react';
import { NAMED_NPCS } from '../content/index.ts';
import { selectToast, selectVoiceUnavailable, useGame } from '../store/index.ts';

// English until the i18n module lands (ticket 12).

const TOAST_MS = 5_000;

/** A notice at the top of the screen that clears itself, such as a network abandonment. */
export function Toast() {
  const toast = useGame(selectToast);
  const dismissToast = useGame((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  const { role } = NAMED_NPCS[toast.npcId];
  return (
    <div className="toast" role="status">
      The {role} had to step away. Nothing was lost.
    </div>
  );
}

/** Shown instead of a conversation when the gateway can't mint a token, so voice can't work at all. */
export function VoiceUnavailableScreen() {
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
        <h2 id="voice-unavailable-title">Voice service unavailable: check the local server</h2>
        <p>
          The game couldn’t get a voice connection from the local server. Check that <code>npm run dev</code> is running
          and that <code>.env</code> has a Gemini API key, then try talking again.
        </p>
        <button type="button" className="primary" onClick={dismiss} autoFocus>
          Back to the game
        </button>
      </section>
    </div>
  );
}
