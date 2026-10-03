import 'fake-indexeddb/auto';
import { createStore, set, type UseStore } from 'idb-keyval';
import { describe, expect, it, vi } from 'vitest';
import { CLOCK, createSave, type GameState } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createDeviceSettings,
  createGameStore,
  createJournal,
  createSaves,
  DEFAULT_DEVICE_SETTINGS,
  DEV_SETUP,
  SAVE_SCHEMA_VERSION,
  selectArrival,
  selectMoneyInShifts,
  selectPersistCallout,
  selectPlaceId,
  selectSavedCount,
  selectScreen,
  selectTitle,
  selectToast,
  SLOT_IDS,
  type GameStoreDeps,
  type NewJournalEntry,
  type SaveFile,
  type TitleView,
} from './index.ts';

/** A barista the test speaks for. */
function fakeBarista() {
  const npc = {
    events: null as VoiceSessionEvents | null,
    says(text: string) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete();
    },
  };
  const openVoiceSession: OpenVoiceSession = (_, events) => {
    npc.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: () => {},
      sendToolResponse: () => {},
      close: () => {},
    };
  };
  return { npc, openVoiceSession };
}

type Browser = Required<Pick<GameStoreDeps, 'saves' | 'journal' | 'deviceSettings' | 'storage' | 'downloadFile'>> &
  Partial<GameStoreDeps> & {
    rawSaves: UseStore;
    downloads: SaveFile[];
    persist: { granted: boolean; asked: number };
  };

let databases = 0;
/**
 * A browser over fresh IndexedDB databases: a reload is a new store over the
 * same one. It grants persistent storage unless told otherwise, and keeps
 * what it was asked to download.
 */
function freshBrowser({ persistGranted = true, clock = () => new Date('2026-10-03T09:00:00Z') } = {}): Browser {
  const n = ++databases;
  const rawSaves = createStore(`title-saves-${n}`, 'saves');
  const persist = { granted: persistGranted, asked: 0 };
  const downloads: SaveFile[] = [];
  return {
    rawSaves,
    downloads,
    persist,
    saves: createSaves(() => rawSaves, { now: clock }),
    journal: createJournal(() => createStore(`title-journal-${n}`, 'entries')),
    deviceSettings: createDeviceSettings(() => createStore(`title-device-${n}`, 'settings')),
    storage: {
      persisted: async () => persist.granted && persist.asked > 0,
      persist: async () => {
        persist.asked++;
        return persist.granted;
      },
    },
    downloadFile: (file) => void downloads.push(file),
    requestRecap: () => new Promise(() => {}),
  };
}

/** Opens the title screen and waits until it has looked for saves. */
async function openTitle(store: ReturnType<typeof createGameStore>) {
  store.getState().openTitle();
  await vi.waitFor(() => expect(selectTitle(store.getState())?.status).not.toBe('checking'));
  return selectTitle(store.getState())!;
}

/** The title screen once it's ready. */
function ready(store: ReturnType<typeof createGameStore>) {
  const title = selectTitle(store.getState());
  if (title?.status !== 'ready') throw new Error(`The title screen isn't ready: ${JSON.stringify(title)}`);
  return title;
}

/** Waits until this many saves have finished. */
async function saved(store: ReturnType<typeof createGameStore>, times: number) {
  await vi.waitFor(() => expect(selectSavedCount(store.getState())).toBe(times));
}

/** Sam at the café on day 4, with some money spent. */
function dayFour(): GameState {
  const game = createSave(DEV_SETUP);
  return { ...game, clock: { day: 4, minuteOfDay: 10 * 60 }, placeId: 'cafe', character: { ...game.character, moneyInShifts: 1.2 } };
}

const recap: NewJournalEntry = {
  kind: 'goal',
  npcId: 'barista',
  npcName: null,
  interactionId: 'order-drink',
  placeName: 'ほしコーヒー',
  day: 4,
  minuteOfDay: 9 * 60,
  targetLanguage: 'ja',
  nativeLanguage: 'en',
  outcome: 'success',
  recap: null,
  lines: [],
  helpLog: [],
};

const garbled = { schemaVersion: SAVE_SCHEMA_VERSION, lastPlayedAt: '2026-10-03T12:00:00.000Z', game: { garbled: true } };

describe('the title screen', () => {
  it('offers only New game on a browser with no saves', async () => {
    const store = createGameStore(null, freshBrowser());
    expect(selectScreen(store.getState())).toBe('title');

    expect(await openTitle(store)).toEqual<TitleView>({
      status: 'ready',
      slots: SLOT_IDS.map((slotId) => ({ slotId, status: 'empty' })),
      continueSlotId: null,
      freeSlotId: 'slot-1',
      notice: null,
    });
  });

  it('shows a card per slot with the Character’s name, Target Language, day, money, place and when it was last played', async () => {
    const browser = freshBrowser();
    await browser.saves.write('slot-2', dayFour());
    const store = createGameStore(null, browser);

    const title = await openTitle(store);

    expect(title.status === 'ready' && title.slots[1]).toEqual({
      slotId: 'slot-2',
      status: 'ready',
      characterName: 'Sam',
      targetLanguage: 'ja',
      culturePackId: 'ja',
      day: 4,
      placeId: 'cafe',
      moneyInShifts: 1.2,
      lastPlayedAt: '2026-10-03T09:00:00.000Z',
      fromBackup: false,
    });
    expect(title).toMatchObject({ continueSlotId: 'slot-2', freeSlotId: 'slot-1' });
  });

  it('New game starts the First Morning in a free slot and saves it at once', async () => {
    const browser = freshBrowser();
    const store = createGameStore(null, browser);
    await openTitle(store);

    store.getState().newGame();
    await saved(store, 1);

    expect(selectScreen(store.getState())).toBe('playing');
    expect(selectArrival(store.getState())).toBe('newGame');
    expect(store.getState().game).toEqual(createSave(DEV_SETUP));
    expect((await browser.saves.load('slot-1'))?.save.game).toEqual(createSave(DEV_SETUP));
  });

  it('when all 4 slots are full, offers no New game', async () => {
    const browser = freshBrowser();
    for (const slotId of SLOT_IDS) await browser.saves.write(slotId, dayFour());
    const store = createGameStore(null, browser);

    expect(await openTitle(store)).toMatchObject({ freeSlotId: null });
    store.getState().newGame();

    expect(selectScreen(store.getState())).toBe('title');
  });

  it('after a reload, Continue puts the Character back where they were, with everything as it was', async () => {
    const browser = freshBrowser();
    const before = createGameStore(null, browser);
    await openTitle(before);
    before.getState().newGame();
    before.getState().enterPlace('cafe');
    before.getState().advance(CLOCK.maxRealDeltaMs);
    before.setState({ game: { ...before.getState().game, character: { ...before.getState().game.character, moneyInShifts: 1.2 } } });
    before.getState().saveNow();
    await saved(before, 3);
    const game = before.getState().game;

    const after = createGameStore(null, browser);
    expect(await openTitle(after)).toMatchObject({ continueSlotId: 'slot-1' });
    after.getState().continueGame();

    expect(selectScreen(after.getState())).toBe('playing');
    expect(selectArrival(after.getState())).toBe('continued');
    expect(selectPlaceId(after.getState())).toBe('cafe');
    expect(selectMoneyInShifts(after.getState())).toBe(1.2);
    expect(after.getState().game).toEqual(game);
    expect(selectToast(after.getState())).toBeNull();
  });

  it('Continue loads the most recently played slot, and Load a save plays any other', async () => {
    let clock = new Date('2026-10-03T09:00:00Z');
    const browser = freshBrowser({ clock: () => clock });
    await browser.saves.write('slot-3', dayFour());
    clock = new Date('2026-10-03T10:00:00Z');
    await browser.saves.write('slot-1', createSave(DEV_SETUP));
    const store = createGameStore(null, browser);

    expect(await openTitle(store)).toMatchObject({ continueSlotId: 'slot-1' });
    store.getState().playSlot('slot-3');

    expect(store.getState().slotId).toBe('slot-3');
    expect(store.getState().game).toEqual(dayFour());
  });

  it('a reload mid-conversation comes back as if it never happened', async () => {
    const browser = freshBrowser();
    const { npc, openVoiceSession } = fakeBarista();
    const before = createGameStore(null, { ...browser, openVoiceSession });
    await openTitle(before);
    before.getState().newGame();
    before.getState().enterPlace('cafe');
    const atTheCounter = before.getState().game;
    before.getState().setInteractable('barista');
    before.getState().talk();
    npc.says('いらっしゃいませ！');
    before.getState().advance(CLOCK.maxRealDeltaMs);
    before.getState().saveNow();
    await saved(before, 3);

    const after = createGameStore(null, browser);
    await openTitle(after);
    after.getState().continueGame();

    expect(after.getState().game).toEqual(atTheCounter);
    expect(after.getState().conversation).toBeNull();
  });

  it('keeps Recaps in the Native Language from this browser’s device settings', async () => {
    const browser = freshBrowser();
    await browser.deviceSettings.save({ ...DEFAULT_DEVICE_SETTINGS, nativeLanguage: 'de' });
    const store = createGameStore(null, browser);

    await openTitle(store);

    expect(store.getState().nativeLanguage).toBe('de');
  });
});

describe('a save that can’t be loaded', () => {
  it('falls back to this morning’s save, and says so', async () => {
    const browser = freshBrowser();
    await browser.saves.write('slot-1', dayFour());
    await browser.saves.write('slot-1', { ...dayFour(), clock: { day: 4, minuteOfDay: 15 * 60 } });
    await set('slot-1', garbled, browser.rawSaves);
    const store = createGameStore(null, browser);

    expect(await openTitle(store)).toMatchObject({ continueSlotId: 'slot-1' });
    expect(ready(store).slots[0]).toMatchObject({ status: 'ready', fromBackup: true });
    store.getState().continueGame();

    expect(store.getState().game).toEqual(dayFour());
    expect(selectToast(store.getState())).toEqual({ kind: 'loadedBackup' });
  });

  it('with no backup to fall back to, shows as damaged, never plays, and still leaves room for a new game', async () => {
    const browser = freshBrowser();
    await set('slot-1', garbled, browser.rawSaves);
    const store = createGameStore(null, browser);

    expect(await openTitle(store)).toMatchObject({ continueSlotId: 'slot-1', freeSlotId: 'slot-2' });
    expect(ready(store).slots[0]).toEqual({ slotId: 'slot-1', status: 'damaged', characterName: null, lastPlayedAt: garbled.lastPlayedAt });
    store.getState().continueGame();
    store.getState().playSlot('slot-1');
    expect(selectScreen(store.getState())).toBe('title');

    store.getState().exportRawSave('slot-1');
    await vi.waitFor(() => expect(browser.downloads.map((file) => file.fileName)).toEqual(['insomniacs-slot-1-raw.json']));
    expect(JSON.parse(browser.downloads[0]!.contents).save).toEqual(garbled);
  });
});

describe('export, import and delete', () => {
  it('Export downloads the slot as one file', async () => {
    const browser = freshBrowser();
    await browser.saves.write('slot-1', dayFour());
    const store = createGameStore(null, browser);
    await openTitle(store);

    store.getState().exportSave('slot-1');

    await vi.waitFor(() => expect(browser.downloads.map((file) => file.fileName)).toEqual(['insomniacs-Sam-ja-day4.json']));
  });

  it('Import puts a file into the first empty slot and shows its card', async () => {
    const browser = freshBrowser();
    await browser.saves.write('slot-1', dayFour());
    await browser.journal.append('slot-1', recap);
    const store = createGameStore(null, browser);
    await openTitle(store);
    store.getState().exportSave('slot-1');
    await vi.waitFor(() => expect(browser.downloads).toHaveLength(1));

    store.getState().importSave(browser.downloads[0]!.contents);

    await vi.waitFor(() => expect(ready(store).notice).toEqual({ kind: 'imported', slotId: 'slot-2' }));
    expect(ready(store).slots[1]).toMatchObject({ status: 'ready', characterName: 'Sam', day: 4 });
    expect(ready(store).freeSlotId).toBe('slot-3');
    expect(await browser.journal.list('slot-2')).toHaveLength(1);
  });

  it('a bad file is refused with the reason, and no slot changes', async () => {
    const store = createGameStore(null, freshBrowser());
    await openTitle(store);

    store.getState().importSave('this is not a save');

    await vi.waitFor(() => expect(ready(store).notice).toEqual({ kind: 'importRefused', problem: 'notASaveFile' }));
    expect(ready(store).slots.every((slot) => slot.status === 'empty')).toBe(true);
    store.getState().dismissTitleNotice();
    expect(ready(store).notice).toBeNull();
  });

  it('Delete needs the Character’s name typed, then removes the save, its backups and its Journal', async () => {
    const browser = freshBrowser();
    await browser.saves.write('slot-1', dayFour());
    await browser.journal.append('slot-1', recap);
    const store = createGameStore(null, browser);
    await openTitle(store);

    store.getState().deleteSave('slot-1', 'sam');
    store.getState().deleteSave('slot-1', 'Someone else');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ready(store).slots[0]?.status).toBe('ready');

    store.getState().deleteSave('slot-1', ' Sam ');

    await vi.waitFor(() => expect(ready(store).slots[0]).toEqual({ slotId: 'slot-1', status: 'empty' }));
    expect(ready(store).continueSlotId).toBeNull();
    expect(await browser.saves.backups('slot-1')).toEqual([]);
    expect(await browser.journal.list('slot-1')).toEqual([]);
  });
});

describe('persistent storage', () => {
  it('is asked for on the first write, once', async () => {
    const browser = freshBrowser();
    const store = createGameStore(null, browser);
    await openTitle(store);

    store.getState().newGame();
    store.getState().saveNow();
    await saved(store, 2);

    expect(browser.persist.asked).toBe(1);
    expect(selectPersistCallout(store.getState())).toBe(false);
  });

  it('when refused, shows a callout until it is dismissed, and never again after that', async () => {
    const browser = freshBrowser({ persistGranted: false });
    const first = createGameStore(null, browser);
    await openTitle(first);
    expect(selectPersistCallout(first.getState())).toBe(false);

    first.getState().newGame();
    await vi.waitFor(() => expect(selectPersistCallout(first.getState())).toBe(true));

    // Back on the title screen after a reload, it still shows.
    const second = createGameStore(null, browser);
    await openTitle(second);
    await vi.waitFor(() => expect(selectPersistCallout(second.getState())).toBe(true));
    second.getState().dismissPersistCallout();
    expect(selectPersistCallout(second.getState())).toBe(false);
    await vi.waitFor(async () =>
      expect((await browser.deviceSettings.load()).tooltipsSeen).toContain('persist-refused'),
    );

    const third = createGameStore(null, browser);
    await openTitle(third);
    third.getState().continueGame();
    third.getState().saveNow();
    await saved(third, 1);
    expect(selectPersistCallout(third.getState())).toBe(false);
  });
});
