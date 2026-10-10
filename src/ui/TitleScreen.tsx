import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { formatLocalMoney } from '../content/index.ts';
import { Trans, useTranslation } from '../i18n/index.ts';
import {
  nameToDelete,
  selectTitle,
  useGame,
  type SlotCard,
  type SlotId,
  type TitleNotice,
  type TitleView,
} from '../store/index.ts';
import { formatTimeAgo } from './format.ts';
import { PersistCallout } from './PersistCallout.tsx';
import { usePlaceName } from './placeName.ts';
import { CreditsScreen, SettingsPanel } from './SettingsPanel.tsx';

type ReadyTitle = Extract<TitleView, { status: 'ready' }>;
type MenuItem = 'continue' | 'load' | 'newGame' | 'import' | 'settings';
type ReadyCard = Extract<SlotCard, { status: 'ready' }>;
type SavedCard = Exclude<SlotCard, { status: 'empty' }>;

const slotNumber = (slotId: SlotId) => slotId.replace('slot-', '');

/** Settings, or the credits screen opened from it. */
function TitleSettings() {
  const [credits, setCredits] = useState(false);
  return credits ? <CreditsScreen onBack={() => setCredits(false)} /> : <SettingsPanel onOpenCredits={() => setCredits(true)} />;
}

function NoticeText({ notice }: { notice: TitleNotice }) {
  const { t } = useTranslation();
  switch (notice.kind) {
    case 'imported':
      return t('title.notice.imported', { slot: slotNumber(notice.slotId) });
    case 'importRefused':
      return t(`title.importRefused.${notice.problem}`);
    default:
      return t(`title.notice.${notice.kind}`);
  }
}

/**
 * The title screen: a menu on the left over the live town, and a centre panel
 * that follows the highlighted item. ↑ ↓ move the highlight, Enter confirms
 * and Esc goes back.
 */
export function TitleScreen() {
  const { t } = useTranslation();
  const title = useGame(selectTitle);
  const openTitle = useGame((s) => s.openTitle);

  useEffect(() => openTitle(), [openTitle]);

  return (
    <div className="title-screen">
      {title?.status === 'ready' ? (
        <TitleMenu title={title} />
      ) : (
        <nav className="title-menu" aria-label={t('title.menuLabel')} aria-busy={title?.status !== 'failed' || undefined}>
          <h1>Insomniacs</h1>
          {title?.status === 'failed' && (
            <p className="title-note" role="alert">
              {t('title.readFailed', { message: title.message })}
            </p>
          )}
        </nav>
      )}
      <p className="title-keys" aria-hidden>
        <Trans i18nKey="title.keys" components={{ kbd: <kbd /> }} />
      </p>
      <PersistCallout />
    </div>
  );
}

function TitleMenu({ title }: { title: ReadyTitle }) {
  const { t } = useTranslation();
  const continueGame = useGame((s) => s.continueGame);
  const newGame = useGame((s) => s.newGame);
  const importSave = useGame((s) => s.importSave);
  const dismissTitleNotice = useGame((s) => s.dismissTitleNotice);

  const items: MenuItem[] = title.continueSlotId ? ['continue', 'load', 'newGame', 'import', 'settings'] : ['load', 'newGame', 'import', 'settings'];
  // With nothing to continue, New game is the likely choice.
  const [highlighted, setHighlighted] = useState<MenuItem>(title.continueSlotId ? 'continue' : 'newGame');
  // Deleting the last save takes Continue away.
  const current = items.includes(highlighted) ? highlighted : items[0]!;
  const [deleting, setDeleting] = useState<SavedCard | null>(null);
  const menuButtons = useRef<Partial<Record<MenuItem, HTMLButtonElement | null>>>({});
  const panel = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const continueCard = title.slots.find((slot) => slot.slotId === title.continueSlotId);

  const panelButtons = () => [...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
  const focusItem = (item: MenuItem) => {
    setHighlighted(item);
    menuButtons.current[item]?.focus();
  };
  // After the panel has rendered for the item.
  const focusPanel = () => requestAnimationFrame(() => panelButtons()[0]?.focus());

  const confirm = (item: MenuItem) => {
    setHighlighted(item);
    if (item === 'continue' && continueCard?.status === 'ready') continueGame();
    else if (item === 'newGame') newGame();
    else if (item === 'import' && title.freeSlotId) fileInput.current?.click();
    else if (item === 'continue' || item === 'load') focusPanel();
  };

  useEffect(() => {
    if (deleting) return;
    const onKey = (e: KeyboardEvent) => {
      const focus = document.activeElement;
      const inPanel = panel.current?.contains(focus) ?? false;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        if (inPanel) {
          const buttons = panelButtons();
          const at = buttons.indexOf(focus as HTMLButtonElement);
          buttons[Math.min(buttons.length - 1, Math.max(0, at + step))]?.focus();
        } else {
          focusItem(items[(items.indexOf(current) + step + items.length) % items.length]!);
        }
      } else if (e.key === 'Enter' && (focus === document.body || focus === null)) {
        confirm(current);
      } else if (e.key === 'Escape') {
        if (title.notice) dismissTitleNotice();
        if (inPanel) focusItem(current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const full = title.freeSlotId === null;

  return (
    <>
      <nav className="title-menu" aria-label={t('title.menuLabel')}>
        <h1>Insomniacs</h1>
        <ul>
          {items.map((item) => {
            const greyedOut = item === 'newGame' && full;
            return (
              <li key={item}>
                <button
                  type="button"
                  ref={(button) => void (menuButtons.current[item] = button)}
                  aria-current={item === current || undefined}
                  aria-disabled={greyedOut || undefined}
                  autoFocus={item === highlighted}
                  onFocus={() => setHighlighted(item)}
                  onMouseEnter={() => setHighlighted(item)}
                  onClick={() => confirm(item)}
                >
                  {t(`title.menu.${item}`)}
                </button>
                {greyedOut && <p className="title-note">{t('title.full')}</p>}
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="title-panel" ref={panel} aria-label={t(`title.menu.${current}`)}>
        {title.notice && (
          <p className="title-notice" role={title.notice.kind === 'imported' ? 'status' : 'alert'}>
            <NoticeText notice={title.notice} />
            <button type="button" className="title-notice-close" aria-label={t('title.dismiss')} onClick={dismissTitleNotice}>
              ×
            </button>
          </p>
        )}
        {current === 'continue' && continueCard && continueCard.status !== 'empty' && (
          <>
            <h2>{t('title.menu.continue')}</h2>
            {continueCard.status === 'ready' ? (
              <>
                <SlotSummary card={continueCard} />
                <button type="button" className="primary" onClick={continueGame}>
                  {t('title.menu.continue')}
                </button>
              </>
            ) : (
              <DamagedSlot card={continueCard} onDelete={() => setDeleting(continueCard)} />
            )}
          </>
        )}
        {current === 'load' && <SlotList slots={title.slots} onDelete={setDeleting} />}
        {current === 'newGame' && (
          <>
            <h2>{t('title.newGame.heading')}</h2>
            <p>{t('title.newGame.body')}</p>
            <button type="button" className="primary" disabled={full} onClick={newGame}>
              {t('title.newGame.start')}
            </button>
            {full && <p className="title-note">{t('title.full')}</p>}
          </>
        )}
        {current === 'import' && (
          <>
            <h2>{t('title.menu.import')}</h2>
            <p>{t('title.import.body')}</p>
            <button type="button" className="primary" disabled={full} onClick={() => fileInput.current?.click()}>
              {t('title.import.choose')}
            </button>
            {full && <p className="title-note">{t('title.fullImport')}</p>}
          </>
        )}
        {current === 'settings' && <TitleSettings />}
      </section>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        aria-label={t('title.import.fileLabel')}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) importSave(await file.text());
        }}
      />
      {deleting && <DeleteDialog card={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

/** "5 minutes ago", in the Native Language. */
function useTimeAgo() {
  const { t, i18n } = useTranslation();
  return (iso: string) => formatTimeAgo(iso, i18n.language) ?? t('slots.unknownTime');
}

function SlotSummary({ card }: { card: ReadyCard }) {
  const { t } = useTranslation();
  const timeAgo = useTimeAgo();
  const place = usePlaceName()(card.placeId, card.culturePackId);
  return (
    <div className="slot-summary">
      <strong>
        {card.characterName} · {t(`languages.${card.targetLanguage}`)}
      </strong>
      <span>
        {t('slots.where', { day: card.day, place })} · {formatLocalMoney(card.moneyInShifts, card.culturePackId)}
      </span>
      <span className="slot-when">{t('slots.lastPlayed', { when: timeAgo(card.lastPlayedAt) })}</span>
      {card.fromBackup && <span className="slot-backup">{t('slots.fromBackup')}</span>}
    </div>
  );
}

function DamagedSlot({ card, onDelete }: { card: Extract<SlotCard, { status: 'damaged' }>; onDelete: () => void }) {
  const { t } = useTranslation();
  const timeAgo = useTimeAgo();
  const exportRawSave = useGame((s) => s.exportRawSave);
  return (
    <div className="slot-damaged">
      <strong>{t('slots.damaged')}</strong>
      <span className="slot-when">
        {card.characterName && `${card.characterName} · `}
        {card.lastPlayedAt ? t('slots.lastPlayed', { when: timeAgo(card.lastPlayedAt) }) : t('slots.neverPlayed')}
      </span>
      <div className="slot-actions">
        <button type="button" onClick={() => exportRawSave(card.slotId)}>
          {t('slots.exportRaw')}
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          {t('slots.delete')}
        </button>
      </div>
    </div>
  );
}

/** Load a save: the 4 slots as rows. */
function SlotList({ slots, onDelete }: { slots: SlotCard[]; onDelete: (card: SavedCard) => void }) {
  const { t } = useTranslation();
  const playSlot = useGame((s) => s.playSlot);
  const exportSave = useGame((s) => s.exportSave);
  const [moreFor, setMoreFor] = useState<SlotId | null>(null);

  return (
    <>
      <h2>{t('title.menu.load')}</h2>
      <ul className="slot-list">
        {slots.map((card) => (
          <li key={card.slotId} className="slot-row" data-status={card.status}>
            <span className="slot-number">{slotNumber(card.slotId)}</span>
            {card.status === 'empty' && <span className="slot-empty">{t('slots.empty')}</span>}
            {card.status === 'damaged' && <DamagedSlot card={card} onDelete={() => onDelete(card)} />}
            {card.status === 'ready' && (
              <>
                <SlotSummary card={card} />
                <div className="slot-actions">
                  <button type="button" onClick={() => playSlot(card.slotId)}>
                    {t('slots.play')}
                  </button>
                  <button
                    type="button"
                    aria-label={t('slots.more', { slot: slotNumber(card.slotId) })}
                    aria-expanded={moreFor === card.slotId}
                    onClick={() => setMoreFor(moreFor === card.slotId ? null : card.slotId)}
                  >
                    ⋯
                  </button>
                  {moreFor === card.slotId && (
                    <div className="slot-more" role="menu">
                      <button type="button" role="menuitem" onClick={() => {
                          setMoreFor(null);
                          exportSave(card.slotId);
                        }}
                      >
                        {t('slots.export')}
                      </button>
                      <button type="button" role="menuitem" className="danger"
                        onClick={() => {
                          setMoreFor(null);
                          onDelete(card);
                        }}
                      >
                        {t('slots.delete')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Delete asks for the Character's name typed, so a save can't be deleted by accident. */
function DeleteDialog({ card, onClose }: { card: SavedCard; onClose: () => void }) {
  const { t } = useTranslation();
  const deleteSave = useGame((s) => s.deleteSave);
  const [typed, setTyped] = useState('');
  const name = nameToDelete(card);
  const matches = typed.trim() === name;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!matches) return;
    deleteSave(card.slotId, typed);
    onClose();
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    onClose();
  };

  return (
    <div className="screen-backdrop">
      <form className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onSubmit={submit} onKeyDown={onKeyDown}>
        <h2 id="delete-title">
          {card.characterName ? t('deleteDialog.titleNamed', { name: card.characterName }) : t('deleteDialog.titleUnnamed')}
        </h2>
        <p>{t('deleteDialog.body')}</p>
        <label>
          <span>
            <Trans i18nKey="deleteDialog.typeToConfirm" values={{ name }} components={{ name: <strong /> }} />
          </span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" spellCheck={false} />
        </label>
        <div className="delete-dialog-actions">
          <button type="button" onClick={onClose}>
            {t('deleteDialog.cancel')}
          </button>
          <button type="submit" className="danger" disabled={!matches}>
            {t('deleteDialog.delete')}
          </button>
        </div>
      </form>
    </div>
  );
}
