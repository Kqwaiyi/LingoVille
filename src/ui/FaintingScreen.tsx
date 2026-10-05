import { formatLocalMoney, formatTime } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import { CLOCK } from '../sim/index.ts';
import { selectCulturePackId, selectFainting, useGame } from '../store/index.ts';

/** Shown when Health runs out: what happened and what the bill came to, until the Player wakes the Character in the ward. */
export function FaintingScreen() {
  const { t } = useTranslation();
  const fainting = useGame(selectFainting);
  const packId = useGame(selectCulturePackId);
  const wakeInWard = useGame((s) => s.wakeInWard);

  if (!fainting) return null;
  const amount = formatLocalMoney(fainting.billInShifts, packId);
  return (
    <div className="screen-backdrop fainting-backdrop">
      <section className="fainting" role="alertdialog" aria-labelledby="fainting-title">
        <h2 id="fainting-title">{t('fainting.title')}</h2>
        <p>{t('fainting.body', { time: formatTime(CLOCK.faintWakeAt) })}</p>
        <p>{t(fainting.paid ? 'fainting.paid' : 'fainting.debt', { amount })}</p>
        <p className="fainting-mood">{t('fainting.moodDown')}</p>
        <button type="button" className="primary" onClick={wakeInWard} autoFocus>
          {t('fainting.wake')}
        </button>
      </section>
    </div>
  );
}
