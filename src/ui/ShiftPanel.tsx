import { CULTURE_PACKS, DRINK_EXTRAS, DRINK_SIZES, DRINK_TEMPERATURES, formatLocalMoney, type DrinkOptionId } from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import type { ShiftOrderLine } from '../sim/index.ts';
import {
  selectCanRedoTray,
  selectCanServe,
  selectCanTapMenu,
  selectCanUndoTray,
  selectCulturePackId,
  selectDrinkModifiers,
  selectNativeLanguage,
  selectShiftEnd,
  selectShiftMenu,
  selectTray,
  useGame,
} from '../store/index.ts';
import { drinkOptionLabel, itemLabel } from './itemLabel.ts';
import { JournalPageView } from './JournalPage.tsx';

/**
 * The barista's menu grid, between the chat and the input bar while a Shift Customer is at the counter: set how the
 * next drink is made with the modifier toggles, tap what they ordered onto the tray (undoing and redoing as need be),
 * then Serve. What's served is checked exactly against their order. The Barista skill groups the grid into drinks and food.
 */
export function MenuGrid() {
  const { t } = useTranslation();
  const menu = useGame(selectShiftMenu);
  const tray = useGame(selectTray);
  const making = useGame(selectDrinkModifiers);
  const canServe = useGame(selectCanServe);
  const canTap = useGame(selectCanTapMenu);
  const canUndo = useGame(selectCanUndoTray);
  const canRedo = useGame(selectCanRedoTray);
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const tapMenuItem = useGame((s) => s.tapMenuItem);
  const setDrinkSize = useGame((s) => s.setDrinkSize);
  const setDrinkTemperature = useGame((s) => s.setDrinkTemperature);
  const toggleDrinkExtra = useGame((s) => s.toggleDrinkExtra);
  const clearTray = useGame((s) => s.clearTray);
  const undoTray = useGame((s) => s.undoTray);
  const redoTray = useGame((s) => s.redoTray);
  const serveTray = useGame((s) => s.serveTray);

  const toggle = (option: DrinkOptionId, pressed: boolean, onClick: () => void) => (
    <button key={option} type="button" aria-pressed={pressed} onClick={onClick} disabled={!canTap}>
      {drinkOptionLabel(option, packId, nativeLanguage)}
    </button>
  );
  const { drinkOptions } = CULTURE_PACKS[packId];
  const lineLabel = ({ itemId, quantity, modifiers }: ShiftOrderLine) => {
    const made = modifiers ? [modifiers.size, modifiers.temperature, ...modifiers.extras].map((option) => drinkOptions[option].name) : [];
    return `${itemLabel(itemId, packId, nativeLanguage)}${made.length > 0 ? ` · ${made.join(', ')}` : ''} ×${quantity}`;
  };

  return (
    <section className="menu-grid" aria-label={t('shift.menu')}>
      <div className="menu-grid-options" role="group" aria-label={t('shift.making')}>
        <div role="group" aria-label={t('shift.size')}>
          {DRINK_SIZES.map((size) => toggle(size, making.size === size, () => setDrinkSize(size)))}
        </div>
        <div role="group" aria-label={t('shift.temperature')}>
          {DRINK_TEMPERATURES.map((temperature) => toggle(temperature, making.temperature === temperature, () => setDrinkTemperature(temperature)))}
        </div>
        <div role="group" aria-label={t('shift.extras')}>
          {DRINK_EXTRAS.map((extra) => toggle(extra, making.extras.includes(extra), () => toggleDrinkExtra(extra)))}
        </div>
      </div>
      {menu.map(({ group, items }) => (
        <div key={group ?? 'menu'} className="menu-grid-items" role={group ? 'group' : undefined} aria-label={group ? t(`shift.menuGroups.${group}`) : undefined}>
          {group && <h3 className="menu-grid-group">{t(`shift.menuGroups.${group}`)}</h3>}
          {items.map((itemId) => (
            <button key={itemId} type="button" onClick={() => tapMenuItem(itemId)} disabled={!canTap}>
              {itemLabel(itemId, packId, nativeLanguage)}
            </button>
          ))}
        </div>
      ))}
      <div className="menu-grid-tray">
        <p role="status" aria-label={t('shift.tray')}>
          {tray.length === 0 ? t('shift.trayEmpty') : tray.map(lineLabel).join(', ')}
        </p>
        <button type="button" onClick={undoTray} disabled={!canUndo}>
          {t('shift.undo')}
        </button>
        <button type="button" onClick={redoTray} disabled={!canRedo}>
          {t('shift.redo')}
        </button>
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
