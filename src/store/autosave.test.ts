import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { describe, expect, it, vi } from 'vitest';
import { CLOCK, createSave, SAVE, type GameState } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createDeviceSettings,
  createGameStore,
  createSaves,
  DEFAULT_DEVICE_SETTINGS,
  DEV_SETUP,
  SAVE_SCHEMA_VERSION,
  selectArrival,
  selectMoneyInShifts,
  selectPlaceId,
  selectSavedCount,
  selectScreen,
  selectTitle,
  type GameStoreDeps,
  type Saves,
} from './index.ts';


/** Saves that only remember what they were asked to write. */
function recordingSaves() {
  const written: { slotId: string; game: GameState }[] = [];
  const saves: Saves = {
    write: async (slotId, game) => {
      written.push({ slotId, game });
      return { schemaVersion: SAVE_SCHEMA_VERSION, slotId, createdAt: '', lastPlayedAt: '', game };
    },
    load: async () => null,
    mostRecent: async () => null,
    usedSlots: async () => [],
  };
  return { saves, written };
}

/** A barista the test speaks for. */
function fakeBarista() {
  const npc = {
    events: null as VoiceSessionEvents | null,
    says(text: string) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      npc.events!.onToolCall({ id: 'call', name, args });
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

let databases = 0;
/** Deps over a fresh IndexedDB database each: the browser after a reload is a new store over the same deps. */
function freshBrowser(): Partial<GameStoreDeps> {
  const n = ++databases;
  return {
    saves: createSaves(() => createStore(`autosave-saves-${n}`, 'saves')),
    deviceSettings: createDeviceSettings(() => createStore(`autosave-device-${n}`, 'settings')),
    journal: { append: async (_, entry) => ({ ...entry, schemaVersion: 1, id: '', writtenAt: '', noHelpNeeded: true }), list: async () => [] },
    requestRecap: () => new Promise(() => {}),
  };
}

function playing() {
  const { saves, written } = recordingSaves();
  const { npc, openVoiceSession } = fakeBarista();
  const store = createGameStore(createSave(DEV_SETUP), {
    saves,
    openVoiceSession,
    requestRecap: () => new Promise(() => {}),
  });
  return { store, written, npc };
}

describe('autosave', () => {
  it('saves when the Character goes through a door, but not every frame they stay inside', () => {
    const { store, written } = playing();

    store.getState().enterPlace('cafe');
    store.getState().enterPlace('cafe');

    expect(written.map((w) => w.game.placeId)).toEqual(['cafe']);
  });

  it('saves when the tab is hidden', () => {
    const { store, written } = playing();

    store.getState().setTabHidden(true);

    expect(written).toHaveLength(1);
    expect(written[0]!.game).toBe(store.getState().game);
  });

  it('saves on request, as the page is closed', () => {
    const { store, written } = playing();

    store.getState().saveNow();

    expect(written).toHaveLength(1);
  });

  it('saves at a new day', () => {
    const { store, written } = playing();
    const game = store.getState().game;
    store.setState({ game: { ...game, clock: { day: 1, minuteOfDay: CLOCK.minutesPerDay - 0.05 } } });

    store.getState().advance(CLOCK.maxRealDeltaMs);

    expect(store.getState().game.clock.day).toBe(2);
    expect(written.map((w) => w.game.clock.day)).toEqual([2]);
  });

  it('saves every couple of real minutes of play, and the timer restarts after any save', () => {
    const { store, written } = playing();
    const frames = Math.ceil(SAVE.everyRealMs / CLOCK.maxRealDeltaMs);

    for (let i = 0; i < frames - 2; i++) store.getState().advance(CLOCK.maxRealDeltaMs);
    store.getState().saveNow();
    store.getState().advance(CLOCK.maxRealDeltaMs);
    store.getState().advance(CLOCK.maxRealDeltaMs);
    expect(written).toHaveLength(1);

    for (let i = 0; i < frames; i++) store.getState().advance(CLOCK.maxRealDeltaMs);
    expect(written).toHaveLength(2);
  });

  it('counts each finished save, so the dock can show "Saved ✓"', async () => {
    const { store } = playing();
    expect(selectSavedCount(store.getState())).toBe(0);

    store.getState().saveNow();

    await saved(store, 1);
  });

  it('never saves a conversation in progress: a save mid-conversation keeps the game from before it', () => {
    const { store, written, npc } = playing();
    store.getState().enterPlace('cafe');
    store.getState().setInteractable('barista');
    const before = store.getState().game;

    store.getState().talk();
    npc.says('いらっしゃいませ！');
    store.getState().advance(CLOCK.maxRealDeltaMs);
    store.getState().setTabHidden(true);

    expect(store.getState().game).not.toBe(before);
    expect(written.at(-1)!.game).toBe(before);
  });

  it('saves the outcome as soon as it is decided, before the closing card', () => {
    const { store, written, npc } = playing();
    store.getState().enterPlace('cafe');
    store.getState().setInteractable('barista');
    store.getState().talk();
    npc.says('いらっしゃいませ！');
    store.getState().sendTypedLine('ラテ ください');

    npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });

    expect(written.at(-1)!.game).toBe(store.getState().game);
    expect(written.at(-1)!.game.character.moneyInShifts).toBeLessThan(createSave(DEV_SETUP).character.moneyInShifts);
  });

  it('saves nothing on the title screen', () => {
    const { saves, written } = recordingSaves();
    const store = createGameStore(null, { saves });

    store.getState().setTabHidden(true);
    store.getState().saveNow();
    store.getState().advance(SAVE.everyRealMs);

    expect(written).toEqual([]);
  });
});

/** Opens the title screen and waits until it has looked for saves. */
async function openTitle(store: ReturnType<typeof createGameStore>) {
  store.getState().openTitle();
  await vi.waitFor(() => expect(selectTitle(store.getState())?.status).not.toBe('checking'));
}

/** Waits until this many saves have finished. */
async function saved(store: ReturnType<typeof createGameStore>, times: number) {
  await vi.waitFor(() => expect(selectSavedCount(store.getState())).toBe(times));
}

describe('the title screen', () => {
  it('offers only New game on a browser with no saves', async () => {
    const store = createGameStore(null, freshBrowser());
    expect(selectScreen(store.getState())).toBe('title');

    await openTitle(store);

    expect(selectTitle(store.getState())).toEqual({ status: 'ready', canContinue: false, canStartNew: true });
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
    expect((await browser.saves!.mostRecent())?.game).toEqual(createSave(DEV_SETUP));
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
    await openTitle(after);
    expect(selectTitle(after.getState())).toMatchObject({ status: 'ready', canContinue: true });
    after.getState().continueGame();

    expect(selectScreen(after.getState())).toBe('playing');
    expect(selectArrival(after.getState())).toBe('continued');
    expect(selectPlaceId(after.getState())).toBe('cafe');
    expect(selectMoneyInShifts(after.getState())).toBe(1.2);
    expect(after.getState().game).toEqual(game);
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
    await browser.deviceSettings!.save({ ...DEFAULT_DEVICE_SETTINGS, nativeLanguage: 'de' });
    const store = createGameStore(null, browser);

    await openTitle(store);

    expect(store.getState().nativeLanguage).toBe('de');
  });

  it('shows why the latest save couldn’t be loaded, and still allows a new game', async () => {
    const browser = freshBrowser();
    const broken: Saves = { ...browser.saves!, mostRecent: () => Promise.reject(new Error('The save in slot-1 can’t be loaded')) };
    const store = createGameStore(null, { ...browser, saves: broken });

    await openTitle(store);

    expect(selectTitle(store.getState())).toEqual({
      status: 'failed',
      message: 'The save in slot-1 can’t be loaded',
      canStartNew: true,
    });
  });
});
