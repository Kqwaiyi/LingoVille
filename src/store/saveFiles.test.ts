import 'fake-indexeddb/auto';
import { createStore, get, set } from 'idb-keyval';
import { describe, expect, it } from 'vitest';
import { createSave, type GameState } from '../sim/index.ts';
import {
  createJournal,
  createSaves,
  deleteSave,
  DEV_SETUP,
  exportRawSave,
  exportSave,
  importSave,
  JOURNAL_SCHEMA_VERSION,
  SAVE_SCHEMA_VERSION,
  type ImportProblem,
  type JournalEntry,
  type NewJournalEntry,
} from './index.ts';

let databases = 0;
/** A browser's saves and Journal over fresh IndexedDB databases, with the raw stores so a test can plant stored bytes. */
function freshBrowser() {
  const n = ++databases;
  const rawSaves = createStore(`save-files-saves-${n}`, 'saves');
  const rawJournal = createStore(`save-files-journal-${n}`, 'entries');
  const stores = {
    saves: createSaves(() => rawSaves, { now: () => new Date('2026-10-03T09:00:00Z') }),
    journal: createJournal(() => rawJournal),
  };
  return { stores, rawSaves, rawJournal };
}

/** Sam on day 3, at the café. */
function dayThree(): GameState {
  const game = createSave(DEV_SETUP);
  return { ...game, clock: { day: 3, minuteOfDay: 9 * 60 }, placeId: 'cafe', character: { ...game.character, moneyInShifts: 1.1 } };
}

const recap = (day: number): NewJournalEntry => ({
  kind: 'goal',
  npcId: 'barista',
  npcName: null,
  interactionId: 'order-drink',
  placeName: 'ほしコーヒー',
  day,
  minuteOfDay: 8 * 60,
  targetLanguage: 'ja',
  nativeLanguage: 'en',
  outcome: 'success',
  recap: { outcome: `Ordered a latte on day ${day}.`, corrections: [], newWords: [] },
  lines: [{ speaker: 'player', text: 'ラテ ください', typed: true }],
  helpLog: [],
});

/** Sam's life in slot 1: a save on day 3 and two Journal entries. */
async function samInSlotOne() {
  const browser = freshBrowser();
  const save = await browser.stores.saves.write('slot-1', dayThree());
  await browser.stores.journal.append('slot-1', recap(1));
  await browser.stores.journal.append('slot-1', recap(2));
  return { ...browser, save };
}

/** Why an import was refused. */
async function refusal(promise: Promise<unknown>): Promise<ImportProblem> {
  const error: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof Error) || !('problem' in error)) throw new Error(`Expected an import refusal, got ${String(error)}`);
  return error.problem as ImportProblem;
}

describe('export and import', () => {
  it('exports one file per slot, named for the Character, language and day, with the save, its Journal and its backups', async () => {
    const { stores, save } = await samInSlotOne();

    const file = await exportSave(stores, 'slot-1');

    expect(file.fileName).toBe('insomniacs-Sam-ja-day3.json');
    const contents = JSON.parse(file.contents);
    expect(contents.save).toEqual(save);
    expect(contents.journal.map((entry: JournalEntry) => entry.day)).toEqual([1, 2]);
    expect(contents.backups).toEqual([{ name: 'start-of-day', schemaVersion: SAVE_SCHEMA_VERSION, day: 3, lastPlayedAt: save.lastPlayedAt }]);
  });

  it('round trip: an exported slot imports into an empty one as the same life, with the same Journal', async () => {
    const { stores, save } = await samInSlotOne();
    const file = await exportSave(stores, 'slot-1');

    await importSave(stores, 'slot-3', file.contents);

    expect((await stores.saves.load('slot-3'))?.save).toEqual({ ...save, slotId: 'slot-3' });
    expect(await stores.journal.list('slot-3')).toEqual(await stores.journal.list('slot-1'));
  });

  it('round trip into another browser', async () => {
    const { stores, save } = await samInSlotOne();
    const file = await exportSave(stores, 'slot-1');
    const elsewhere = freshBrowser().stores;

    await importSave(elsewhere, 'slot-1', file.contents);

    expect((await elsewhere.saves.load('slot-1'))?.save).toEqual(save);
    expect((await elsewhere.journal.list('slot-1')).map((entry) => entry.day)).toEqual([2, 1]);
  });

  it('keeps a file name safe whatever the Character is called', async () => {
    const { stores } = freshBrowser();
    const game = dayThree();
    await stores.saves.write('slot-1', { ...game, identity: { ...game.identity, characterName: ' Mary Jane/O:Neil? ' } });

    expect((await exportSave(stores, 'slot-1')).fileName).toBe('insomniacs-Mary-Jane-O-Neil-ja-day3.json');
  });

  it('imports only into an empty slot, and changes nothing otherwise', async () => {
    const { stores, save } = await samInSlotOne();
    const file = await exportSave(stores, 'slot-1');

    expect(await refusal(importSave(stores, 'slot-1', file.contents))).toBe('slotNotEmpty');
    expect((await stores.saves.load('slot-1'))?.save).toEqual(save);
    expect(await stores.journal.list('slot-1')).toHaveLength(2);
  });

  it('rejects a bad file with a plain reason, and writes nothing', async () => {
    const { stores, save } = await samInSlotOne();
    const good = JSON.parse((await exportSave(stores, 'slot-1')).contents);
    const empty = freshBrowser().stores;
    const tryImport = (contents: unknown) =>
      refusal(importSave(empty, 'slot-1', typeof contents === 'string' ? contents : JSON.stringify(contents)));

    expect(await tryImport('{ not json')).toBe('notASaveFile');
    expect(await tryImport({ hello: 'world' })).toBe('notASaveFile');
    expect(await tryImport({ ...good, save: { ...save, game: { ...save.game, placeId: 'library' } } })).toBe('damaged');
    expect(await tryImport({ ...good, journal: [...good.journal, { schemaVersion: JOURNAL_SCHEMA_VERSION }] })).toBe('damaged');
    expect(await tryImport({ ...good, save: { ...save, schemaVersion: SAVE_SCHEMA_VERSION + 1 } })).toBe('newerVersion');
    expect(await tryImport({ ...good, journal: [{ ...good.journal[0], schemaVersion: JOURNAL_SCHEMA_VERSION + 1 }] })).toBe('newerVersion');
    expect(await tryImport({ ...good, formatVersion: 99 })).toBe('newerVersion');

    expect(await empty.saves.load('slot-1')).toBeNull();
    expect(await empty.journal.list('slot-1')).toEqual([]);
  });

  it('imports an old file through the same migrations as a load, the save and each Journal entry on their own', async () => {
    const { stores, save } = await samInSlotOne();
    const good = JSON.parse((await exportSave(stores, 'slot-1')).contents);
    const v1Game: Partial<GameState> = { ...save.game };
    delete v1Game.phrasebook;
    const v1Entry: Record<string, unknown> = { ...good.journal[0], schemaVersion: 1 };
    delete v1Entry.npcName;
    const old = { ...good, save: { ...save, schemaVersion: 1, game: v1Game }, journal: [v1Entry, good.journal[1]] };
    const empty = freshBrowser().stores;

    await importSave(empty, 'slot-2', JSON.stringify(old));

    expect((await empty.saves.load('slot-2'))?.save).toEqual({ ...save, slotId: 'slot-2', game: { ...save.game, phrasebook: [] } });
    const [newest, oldest] = await empty.journal.list('slot-2');
    expect(oldest).toEqual({ ...good.journal[0], npcName: null });
    expect(newest).toEqual(good.journal[1]);
  });

  it('exports a damaged slot raw: everything stored for it, as found', async () => {
    const { stores, rawSaves, rawJournal } = await samInSlotOne();
    await set('slot-1', 'garbled', rawSaves);
    await set('slot-1/start-of-day', 'garbled too', rawSaves);
    await set('slot-1', ['a torn page'], rawJournal);

    const file = await exportRawSave(stores, 'slot-1');

    expect(file.fileName).toBe('insomniacs-slot-1-raw.json');
    expect(JSON.parse(file.contents)).toMatchObject({
      save: 'garbled',
      backups: { 'start-of-day': 'garbled too' },
      journal: ['a torn page'],
    });
  });
});

describe('delete', () => {
  it('removes the save, its backups and its Journal, and leaves the other slots alone', async () => {
    const { stores, rawSaves } = await samInSlotOne();
    await stores.saves.write('slot-2', dayThree());
    await stores.journal.append('slot-2', recap(5));

    await deleteSave(stores, 'slot-1');

    expect(await stores.saves.load('slot-1')).toBeNull();
    expect(await stores.saves.backups('slot-1')).toEqual([]);
    expect(await stores.journal.list('slot-1')).toEqual([]);
    expect(await get('slot-2', rawSaves)).toBeDefined();
    expect(await stores.journal.list('slot-2')).toHaveLength(1);
  });
});
