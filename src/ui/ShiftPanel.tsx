import { useState } from 'react';
import {
  BEHIND_THE_COUNTER,
  CULTURE_PACKS,
  DIETARY_NOTE_IDS,
  DRINK_EXTRAS,
  DRINK_SIZES,
  DRINK_TEMPERATURES,
  formatLocalAmount,
  formatLocalMoney,
  RESTAURANT_DISHES,
  RESTAURANT_DRINKS,
  tillFor,
  type DietaryNoteId,
  type DrinkOptionId,
  type ItemId,
} from '../content/index.ts';
import { useTranslation } from '../i18n/index.ts';
import { ECONOMY, type PadDiner, type ShiftOrderLine } from '../sim/index.ts';
import {
  selectCanRedoTray,
  selectCanServe,
  selectCanSuggestChange,
  selectCheckoutCounter,
  selectCanTapMenu,
  selectCanUndoTray,
  selectCulturePackId,
  selectDrinkModifiers,
  selectNativeLanguage,
  selectOrderPad,
  selectQuickPickNotes,
  selectShiftEnd,
  selectShiftMenu,
  selectSuggestsChange,
  selectTill,
  selectTray,
  useGame,
} from '../store/index.ts';
import { dietaryNoteLabel, drinkOptionLabel, itemLabel } from './itemLabel.ts';
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

/**
 * The cashier's till, between the chat and the input bar while a customer is at the till: scan the shopping on the
 * counter, fetch what they ask for from behind it, set the bag and points card, key in the cash they hand over and
 * count their change out of the coin tray, then Finish. All of it is checked exactly against what they wanted. The
 * Cashier skill suggests the coins for the change due on the cash keyed in. Keyed by the conversation, so each customer
 * starts with an empty cash field.
 */
export function Till() {
  const { t } = useTranslation();
  const counter = useGame(selectCheckoutCounter);
  const tray = useGame(selectTray);
  const till = useGame(selectTill);
  const canServe = useGame(selectCanServe);
  const canTap = useGame(selectCanTapMenu);
  const canUndo = useGame(selectCanUndoTray);
  const canRedo = useGame(selectCanRedoTray);
  const suggests = useGame(selectSuggestsChange);
  const canSuggest = useGame(selectCanSuggestChange);
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const tapMenuItem = useGame((s) => s.tapMenuItem);
  const toggleBag = useGame((s) => s.toggleBag);
  const togglePointsCard = useGame((s) => s.togglePointsCard);
  const setCashReceived = useGame((s) => s.setCashReceived);
  const addChangeCoin = useGame((s) => s.addChangeCoin);
  const clearChange = useGame((s) => s.clearChange);
  const suggestChange = useGame((s) => s.suggestChange);
  const clearTray = useGame((s) => s.clearTray);
  const undoTray = useGame((s) => s.undoTray);
  const redoTray = useGame((s) => s.redoTray);
  const serveTray = useGame((s) => s.serveTray);
  // What's typed in the cash field, kept as typed (a German "2,50" included) until it reads as an amount.
  const [cashTyped, setCashTyped] = useState('');
  const money = (amount: number) => formatLocalAmount(amount, packId);
  const label = (itemId: Parameters<typeof itemLabel>[0]) => itemLabel(itemId, packId, nativeLanguage);

  const keyInCash = (typed: string) => {
    setCashTyped(typed);
    const amount = Number(typed.replace(',', '.'));
    setCashReceived(typed.trim() === '' || !Number.isFinite(amount) ? null : amount);
  };
  return (
    <section className="menu-grid till" aria-label={t('till.label')}>
      <div className="menu-grid-items" role="group" aria-label={t('till.counter')}>
        <h3 className="menu-grid-group">{t('till.counter')}</h3>
        {counter.map(({ itemId, quantity }) => (
          <button key={itemId} type="button" onClick={() => tapMenuItem(itemId)} disabled={!canTap}>
            {`${label(itemId)} ×${quantity}`}
          </button>
        ))}
      </div>
      <div className="menu-grid-items" role="group" aria-label={t('till.behind')}>
        <h3 className="menu-grid-group">{t('till.behind')}</h3>
        {BEHIND_THE_COUNTER.map((itemId) => (
          <button key={itemId} type="button" onClick={() => tapMenuItem(itemId)} disabled={!canTap}>
            {label(itemId)}
          </button>
        ))}
      </div>
      <div className="menu-grid-tray">
        <p role="status" aria-label={t('till.rungUp')}>
          {tray.length === 0 ? t('till.rungUpEmpty') : tray.map(({ itemId, quantity }) => `${label(itemId)} ×${quantity}`).join(', ')}
        </p>
        <p className="till-total">{t('till.total', { amount: money(till.total) })}</p>
      </div>
      <div className="till-cash">
        <div className="menu-grid-options" role="group" aria-label={t('till.options')}>
          <button type="button" aria-pressed={till.bag} onClick={toggleBag} disabled={!canTap}>
            {t('till.bag')}
          </button>
          <button type="button" aria-pressed={till.pointsCard} onClick={togglePointsCard} disabled={!canTap}>
            {t('till.pointsCard')}
          </button>
        </div>
        <label>
          {t('till.received')}
          <input type="text" inputMode="decimal" value={cashTyped} onChange={(e) => keyInCash(e.target.value)} disabled={!canTap} />
        </label>
        {till.changeDue !== null && <span>{t('till.changeDue', { amount: money(till.changeDue) })}</span>}
      </div>
      <div className="menu-grid-options till-coins" role="group" aria-label={t('till.coins')}>
        <div>
          {tillFor(packId).denominations.map((coin) => (
            <button key={coin} type="button" onClick={() => addChangeCoin(coin)} disabled={!canTap}>
              {money(coin)}
            </button>
          ))}
        </div>
      </div>
      <div className="menu-grid-tray">
        <p role="status" aria-label={t('till.change')}>
          {till.change.length === 0 ? t('till.changeEmpty') : t('till.changeGiven', { amount: money(till.changeGiven), coins: till.change.map(money).join(' + ') })}
        </p>
        {suggests && (
          <button type="button" onClick={suggestChange} disabled={!canSuggest}>
            {t('till.suggest')}
          </button>
        )}
        <button type="button" onClick={clearChange} disabled={!canTap || till.change.length === 0}>
          {t('till.clearChange')}
        </button>
      </div>
      <div className="menu-grid-tray">
        <span className="till-spacer" />
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
          {t('till.finish')}
        </button>
      </div>
    </section>
  );
}

/**
 * The server's order pad, between the chat and the input bar while a table is being served: a line per diner (add
 * one for each at the table, and pick which is being written), a dish and a drink tapped onto it, and any dietary
 * need noted, then Send order. All of it is checked exactly against what the table wanted, whatever order the diners
 * are written in. Notes are picked from a list until the Server skill offers them as quick picks.
 */
export function OrderPad() {
  const { t } = useTranslation();
  const pad = useGame(selectOrderPad);
  const canServe = useGame(selectCanServe);
  const canTap = useGame(selectCanTapMenu);
  const quickPick = useGame(selectQuickPickNotes);
  const packId = useGame(selectCulturePackId);
  const nativeLanguage = useGame(selectNativeLanguage);
  const tapMenuItem = useGame((s) => s.tapMenuItem);
  const addPadDiner = useGame((s) => s.addPadDiner);
  const choosePadDiner = useGame((s) => s.choosePadDiner);
  const removePadDiner = useGame((s) => s.removePadDiner);
  const setDietaryNote = useGame((s) => s.setDietaryNote);
  const clearTray = useGame((s) => s.clearTray);
  const serveTray = useGame((s) => s.serveTray);
  const writing = pad.diners[pad.at]!;
  const label = (itemId: ItemId) => itemLabel(itemId, packId, nativeLanguage);
  const noteLabel = (note: DietaryNoteId) => dietaryNoteLabel(note, packId, nativeLanguage);
  const written = ({ dish, drink, note }: PadDiner) =>
    [dish ? label(dish) : t('pad.nothing'), drink ? label(drink) : t('pad.nothing'), ...(note ? [noteLabel(note)] : [])].join(', ');
  const nothingWritten = pad.diners.every(({ dish, drink, note }) => !dish && !drink && !note);

  const course = (heading: string, items: readonly ItemId[], chosen: ItemId | null) => (
    <div className="menu-grid-items" role="group" aria-label={heading}>
      <h3 className="menu-grid-group">{heading}</h3>
      {items.map((itemId) => (
        <button key={itemId} type="button" aria-pressed={chosen === itemId} onClick={() => tapMenuItem(itemId)} disabled={!canTap}>
          {label(itemId)}
        </button>
      ))}
    </div>
  );
  return (
    <section className="menu-grid order-pad" aria-label={t('pad.label')}>
      <div className="menu-grid-options" role="group" aria-label={t('pad.diners')}>
        <div>
          {pad.diners.map((_, i) => (
            <button key={i} type="button" aria-pressed={pad.at === i} onClick={() => choosePadDiner(i)} disabled={!canTap}>
              {t('pad.diner', { number: i + 1 })}
            </button>
          ))}
        </div>
        <div>
          <button type="button" onClick={addPadDiner} disabled={!canTap || pad.diners.length >= ECONOMY.tableDiners.max}>
            {t('pad.addDiner')}
          </button>
          <button type="button" onClick={removePadDiner} disabled={!canTap || pad.diners.length <= 1}>
            {t('pad.removeDiner')}
          </button>
        </div>
      </div>
      {course(t('pad.dishes'), RESTAURANT_DISHES, writing.dish)}
      {course(t('pad.drinks'), RESTAURANT_DRINKS, writing.drink)}
      {quickPick ? (
        <div className="menu-grid-options" role="group" aria-label={t('pad.note')}>
          <div>
            <button type="button" aria-pressed={writing.note === null} onClick={() => setDietaryNote(null)} disabled={!canTap}>
              {t('pad.noNote')}
            </button>
            {DIETARY_NOTE_IDS.map((note) => (
              <button key={note} type="button" aria-pressed={writing.note === note} onClick={() => setDietaryNote(note)} disabled={!canTap}>
                {noteLabel(note)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <label className="order-pad-note">
          {t('pad.note')}
          <select value={writing.note ?? ''} onChange={(e) => setDietaryNote((e.target.value || null) as DietaryNoteId | null)} disabled={!canTap}>
            <option value="">{t('pad.noNote')}</option>
            {DIETARY_NOTE_IDS.map((note) => (
              <option key={note} value={note}>
                {noteLabel(note)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="menu-grid-tray">
        <p role="status" aria-label={t('pad.written')}>
          {nothingWritten
            ? t('pad.writtenEmpty')
            : pad.diners.map((diner, i) => `${t('pad.diner', { number: i + 1 })}: ${written(diner)}`).join(' / ')}
        </p>
        <button type="button" onClick={clearTray} disabled={!canTap || nothingWritten}>
          {t('shift.clear')}
        </button>
        <button type="button" className="primary" onClick={serveTray} disabled={!canServe}>
          {t('pad.send')}
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
