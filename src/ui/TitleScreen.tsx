import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CULTURE_PACKS, formatLocalMoney } from '../content/index.ts';
import type { LanguageCode, PlaceId } from '../sim/index.ts';
import {
  nameToDelete,
  selectTitle,
  useGame,
  type ImportProblem,
  type SlotCard,
  type SlotId,
  type TitleNotice,
  type TitleView,
} from '../store/index.ts';
import { formatTimeAgo } from './format.ts';
import { PersistCallout } from './PersistCallout.tsx';

// English until the i18n module lands (ticket 12).

type ReadyTitle = Extract<TitleView, { status: 'ready' }>;
type MenuItem = 'continue' | 'load' | 'newGame' | 'import' | 'settings';
type ReadyCard = Extract<SlotCard, { status: 'ready' }>;
type SavedCard = Exclude<SlotCard, { status: 'empty' }>;

const MENU_LABEL: Record<MenuItem, string> = {
  continue: 'Continue',
  load: 'Load a save',
  newGame: 'New game',
  import: 'Import a save',
  settings: 'Settings',
};

const PLACE_NAME: Record<PlaceId, (pack: LanguageCode) => string> = {
  home: () => 'home',
  cafe: (pack) => CULTURE_PACKS[pack].cafe.name,
};

const IMPORT_REFUSED: Record<ImportProblem, string> = {
  notASaveFile: 'That file isn’t an Insomniacs save.',
  newerVersion: 'That save was made by a newer version of the game, so this one can’t read it.',
  damaged: 'That save file is damaged, so it can’t be imported.',
  slotNotEmpty: 'A save can only be imported into an empty slot. Delete a save first.',
};

const slotNumber = (slotId: SlotId) => slotId.replace('slot-', '');

function noticeText(notice: TitleNotice) {
  switch (notice.kind) {
    case 'imported':
      return `Imported into slot ${slotNumber(notice.slotId)}.`;
    case 'importRefused':
      return IMPORT_REFUSED[notice.problem];
    case 'exportFailed':
      return 'The save couldn’t be exported.';
    case 'deleteFailed':
      return 'The save couldn’t be deleted.';
    case 'importFailed':
      return 'The save couldn’t be imported.';
  }
}

/**
 * The title screen: a menu on the left over the live town, and a centre panel
 * that follows the highlighted item. ↑ ↓ move the highlight, Enter confirms
 * and Esc goes back.
 */
export function TitleScreen() {
  const title = useGame(selectTitle);
  const openTitle = useGame((s) => s.openTitle);

  useEffect(() => openTitle(), [openTitle]);

  return (
    <div className="title-screen">
      {title?.status === 'ready' ? (
        <TitleMenu title={title} />
      ) : (
        <nav className="title-menu" aria-label="Title menu" aria-busy={title?.status !== 'failed' || undefined}>
          <h1>Insomniacs</h1>
          {title?.status === 'failed' && (
            <p className="title-note" role="alert">
              Your saves couldn’t be read. {title.message}
            </p>
          )}
        </nav>
      )}
      <p className="title-keys" aria-hidden>
        <kbd>↑</kbd>
        <kbd>↓</kbd> Select · <kbd>Enter</kbd> Confirm · <kbd>Esc</kbd> Back
      </p>
      <PersistCallout />
    </div>
  );
}

function TitleMenu({ title }: { title: ReadyTitle }) {
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
      <nav className="title-menu" aria-label="Title menu">
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
                  {MENU_LABEL[item]}
                </button>
                {greyedOut && <p className="title-note">Delete a save to start a new one</p>}
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="title-panel" ref={panel} aria-label={MENU_LABEL[current]}>
        {title.notice && (
          <p className="title-notice" role={title.notice.kind === 'imported' ? 'status' : 'alert'}>
            {noticeText(title.notice)}
            <button type="button" className="title-notice-close" aria-label="Dismiss" onClick={dismissTitleNotice}>
              ×
            </button>
          </p>
        )}
        {current === 'continue' && continueCard && continueCard.status !== 'empty' && (
          <>
            <h2>Continue</h2>
            {continueCard.status === 'ready' ? (
              <>
                <SlotSummary card={continueCard} />
                <button type="button" className="primary" onClick={continueGame}>
                  Continue
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
            <h2>Start a new life</h2>
            <p>Move into town on your first morning, with a little money and a lot to learn.</p>
            <button type="button" className="primary" disabled={full} onClick={newGame}>
              Start
            </button>
            {full && <p className="title-note">Delete a save to start a new one</p>}
          </>
        )}
        {current === 'import' && (
          <>
            <h2>Import a save</h2>
            <p>Bring back a life from an exported file, with its Journal. It goes into an empty slot.</p>
            <button type="button" className="primary" disabled={full} onClick={() => fileInput.current?.click()}>
              Choose a file
            </button>
            {full && <p className="title-note">Delete a save to import one</p>}
          </>
        )}
        {current === 'settings' && (
          <>
            <h2>Settings</h2>
            <p>Volume, speaking and reading aids, kept for this browser. Coming in a later build.</p>
            <button type="button" className="primary" disabled>
              Open Settings
            </button>
          </>
        )}
      </section>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        aria-label="Save file to import"
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

function SlotSummary({ card }: { card: ReadyCard }) {
  return (
    <div className="slot-summary">
      <strong>
        {card.characterName} · {CULTURE_PACKS[card.targetLanguage].languageName}
      </strong>
      <span>
        Day {card.day} at {PLACE_NAME[card.placeId](card.culturePackId)} · {formatLocalMoney(card.moneyInShifts, card.culturePackId)}
      </span>
      <span className="slot-when">Last played {formatTimeAgo(card.lastPlayedAt)}</span>
      {card.fromBackup && <span className="slot-backup">Loads this morning’s save</span>}
    </div>
  );
}

function DamagedSlot({ card, onDelete }: { card: Extract<SlotCard, { status: 'damaged' }>; onDelete: () => void }) {
  const exportRawSave = useGame((s) => s.exportRawSave);
  return (
    <div className="slot-damaged">
      <strong>⚠ This save couldn’t be loaded</strong>
      <span className="slot-when">
        {card.characterName && `${card.characterName} · `}
        {card.lastPlayedAt ? `Last played ${formatTimeAgo(card.lastPlayedAt)}` : 'Never played'}
      </span>
      <div className="slot-actions">
        <button type="button" onClick={() => exportRawSave(card.slotId)}>
          Export raw
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

/** Load a save: the 4 slots as rows. */
function SlotList({ slots, onDelete }: { slots: SlotCard[]; onDelete: (card: SavedCard) => void }) {
  const playSlot = useGame((s) => s.playSlot);
  const exportSave = useGame((s) => s.exportSave);
  const [moreFor, setMoreFor] = useState<SlotId | null>(null);

  return (
    <>
      <h2>Load a save</h2>
      <ul className="slot-list">
        {slots.map((card) => (
          <li key={card.slotId} className="slot-row" data-status={card.status}>
            <span className="slot-number">{slotNumber(card.slotId)}</span>
            {card.status === 'empty' && <span className="slot-empty">Empty · New game or Import</span>}
            {card.status === 'damaged' && <DamagedSlot card={card} onDelete={() => onDelete(card)} />}
            {card.status === 'ready' && (
              <>
                <SlotSummary card={card} />
                <div className="slot-actions">
                  <button type="button" onClick={() => playSlot(card.slotId)}>
                    Play
                  </button>
                  <button
                    type="button"
                    aria-label={`More for slot ${slotNumber(card.slotId)}`}
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
                        Export
                      </button>
                      <button type="button" role="menuitem" className="danger"
                        onClick={() => {
                          setMoreFor(null);
                          onDelete(card);
                        }}
                      >
                        Delete
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
        <h2 id="delete-title">Delete {card.characterName ? `${card.characterName}’s save` : 'this save'}?</h2>
        <p>This removes the save, its backups and its Journal. It can’t be undone.</p>
        <label>
          Type <strong>{name}</strong> to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" spellCheck={false} />
        </label>
        <div className="delete-dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="danger" disabled={!matches}>
            Delete
          </button>
        </div>
      </form>
    </div>
  );
}
