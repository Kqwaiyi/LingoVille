import { formatLocalMoney } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import {
  selectCanServe,
  selectCanTapMenu,
  selectCulturePackId,
  selectNativeLanguage,
  selectShiftEnd,
  selectShiftMenu,
  selectTray,
  useGame,
} from '../store/index.ts';
import { itemLabel } from './itemLabel.ts';
import { JournalPageView } from './JournalPage.tsx';

/**
 * The barista's menu grid, between the chat and the input bar while a Shift Customer is at the counter:
 * tap what they ordered onto the tray, then Serve. What's served is checked exactly against their order.
 */
export function MenuGrid() {
  const { t } = useTranslation();
  const menu = useGame(selectShiftMenu);
  const tray = useGame(selectTray);
  const canServe = useGame(selectCanServe);
  const canTap = useGame(selectCanTapMenu);
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const tapMenuItem = useGame((s) => s.tapMenuItem);
  const clearTray = useGame((s) => s.clearTray);
  const serveTray = useGame((s) => s.serveTray);

  return (
    <section className="menu-grid" aria-label={t('shift.menu')}>
      <div className="menu-grid-items">
        {menu.map((itemId) => (
          <button key={itemId} type="button" onClick={() => tapMenuItem(itemId)} disabled={!canTap}>
            {itemLabel(itemId, packId, nativeLanguage)}
          </button>
        ))}
      </div>
      <div className="menu-grid-tray">
        <p role="status" aria-label={t('shift.tray')}>
          {tray.length === 0
            ? t('shift.trayEmpty')
            : tray.map(({ itemId, quantity }) => `${itemLabel(itemId, packId, nativeLanguage)} ×${quantity}`).join(', ')}
        </p>
        <button type="button" onClick={clearTray} disabled={!canTap || tray.length === 0}>
          {t('shift.clear')}
        </button>
        <button type="button" className="primary" onClick={serveTray} disabled={!canServe}>
          {t('shift.serve')}
        </button>
      </div>
    </section>
  );
}

/** Shown when a Shift ends: how many customers were served, what it paid, and the Shift's one combined Recap, until the Player closes it. */
export function ShiftEndCard() {
  const { t } = useTranslation();
  const shiftEnd = useGame(selectShiftEnd);
  const packId = useGame(selectCulturePackId);
  const closeShiftEnd = useGame((s) => s.closeShiftEnd);

  if (!shiftEnd) return null;
  return (
    <section className="shift-end" role="dialog" aria-labelledby="shift-end-title">
      <h2 id="shift-end-title">{t('shift.endTitle', { job: t(`skills.names.${shiftEnd.jobId}`) })}</h2>
      <p>{t('shift.served', { served: shiftEnd.served, count: shiftEnd.customers })}</p>
      <p className="shift-end-pay">{t('shift.pay', { amount: formatLocalMoney(shiftEnd.payInShifts, packId) })}</p>
      {shiftEnd.recap && (
        <section className="shift-end-recap" aria-label={t('recap.label')} aria-busy={shiftEnd.recap.status === 'writing'}>
          {shiftEnd.recap.status === 'writing' && (
            <p className="recap-writing" role="status">
              {t('recap.writing')}
            </p>
          )}
          {shiftEnd.recap.status === 'failed' && (
            <p className="recap-writing" role="status">
              {t('recap.failed')}
            </p>
          )}
          {shiftEnd.recap.status === 'ready' && <JournalPageView page={shiftEnd.recap.entry} />}
        </section>
      )}
      <button type="button" className="primary" onClick={closeShiftEnd} autoFocus>
        {t('shift.done')}
      </button>
    </section>
  );
}
