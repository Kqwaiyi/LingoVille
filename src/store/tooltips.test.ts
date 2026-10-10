import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { describe, expect, it, vi } from 'vitest';
import { CLOCK, createSave, hire, type GameState } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  createSaves,
  DEFAULT_DEVICE_SETTINGS,
  DEV_SETUP,
  selectTitle,
  selectTooltip,
  type DeviceSettings,
  type DeviceSettingsStore,
  type GameStoreDeps,
} from './index.ts';
import { recordingSaves } from './testSaves.ts';
import { setUpNewGame } from './testSetup.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** This browser's device settings, kept in memory: two stores over the same ones are two saves on one browser. */
function browserSettings(start: Partial<DeviceSettings> = {}) {
  let settings: DeviceSettings = { ...DEFAULT_DEVICE_SETTINGS, ...start };
  const store: DeviceSettingsStore = {
    load: async () => settings,
    save: async (next) => void (settings = next),
    update: async (change) => void (settings = change(settings) ?? settings),
  };
  return { deviceSettings: store, seen: () => settings.tooltipsSeen };
}

/** Whoever the Character talks to, spoken for by the test; anyone who comes over too. */
function fakeNpc() {
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
    return { connect: async () => {}, startTalking: () => {}, stopTalking: () => {}, sendText: () => {}, sendToolResponse: () => {}, close: () => {} };
  };
  return { npc, openVoiceSession };
}

/** A game on this browser, with a fake NPC and Recaps that arrive at once. */
function playing(game: GameState, browser = browserSettings(), deps: Partial<GameStoreDeps> = {}) {
  const { npc, openVoiceSession } = fakeNpc();
  const store = createGameStore(game, {
    saves: recordingSaves().saves,
    openVoiceSession,
    requestRecap: async () => ({ outcome: 'You ordered a latte.', corrections: [], newWords: [], cefrEstimate: 'A1' }),
    deviceSettings: browser.deviceSettings,
    ...deps,
  });
  return { store, npc, browser };
}

function atTheCafe(browser = browserSettings()) {
  const setup = playing(createSave(DEV_SETUP), browser);
  setup.store.getState().enterPlace('cafe');
  setup.store.getState().setInteractable('barista');
  return setup;
}

const tooltip = (store: ReturnType<typeof createGameStore>) => selectTooltip(store.getState());

/** Orders a latte; the barista says goodbye, and the closing card shows. */
function orderALatte({ store, npc }: ReturnType<typeof atTheCafe>) {
  store.getState().talk();
  npc.says('いらっしゃいませ！');
  store.getState().sendTypedLine('ラテ ください');
  npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
  npc.says('ありがとうございました。');
}

describe('one-time tooltips', () => {
  it('explain the Typed Fallback in the first conversation typed, until Got it', async () => {
    const { store, npc } = atTheCafe();
    store.getState().chooseTypedFallback();

    store.getState().talk();
    npc.says('いらっしゃいませ！');

    await vi.waitFor(() => expect(tooltip(store)).toBe('typedFallback'));
    store.getState().dismissTooltip();
    expect(tooltip(store)).toBeNull();
  });

  it('never come back on this browser, in this save or another', async () => {
    const browser = browserSettings();
    const first = atTheCafe(browser);
    first.store.getState().chooseTypedFallback();
    first.store.getState().talk();
    await vi.waitFor(() => expect(tooltip(first.store)).toBe('typedFallback'));
    first.store.getState().dismissTooltip();
    expect(browser.seen()).toContain('typedFallback');

    first.store.getState().leaveConversation();
    first.store.getState().talk();
    await flush();
    expect(tooltip(first.store)).toBeNull();

    const another = atTheCafe(browser);
    another.store.getState().chooseTypedFallback();
    another.store.getState().talk();
    await flush();
    expect(tooltip(another.store)).toBeNull();
  });

  it('count as seen once shown, even without Got it', async () => {
    const browser = browserSettings();
    const { store } = atTheCafe(browser);
    store.getState().chooseTypedFallback();
    store.getState().talk();

    await vi.waitFor(() => expect(tooltip(store)).toBe('typedFallback'));
    await vi.waitFor(() => expect(browser.seen()).toContain('typedFallback'));
  });

  it('count as seen only once they can be seen, not while waiting behind the pause menu', async () => {
    const browser = browserSettings();
    const setup = atTheCafe(browser);
    orderALatte(setup);
    setup.store.getState().skipRecap();
    setup.store.getState().openPauseMenu();

    await vi.waitFor(() => expect(setup.store.getState().tooltipsDue).toEqual(['journal']));
    await flush();
    expect(browser.seen()).not.toContain('journal');

    setup.store.getState().closePauseMenu();
    expect(tooltip(setup.store)).toBe('journal');
    await vi.waitFor(() => expect(browser.seen()).toContain('journal'));
  });

  it('explain open mic in the first conversation with it, and say nothing with push-to-talk', async () => {
    const pushToTalk = atTheCafe();
    pushToTalk.store.getState().talk();
    await flush();
    expect(tooltip(pushToTalk.store)).toBeNull();

    const openMic = atTheCafe();
    openMic.store.getState().setTalkMode('open-mic');
    openMic.store.getState().talk();
    await vi.waitFor(() => expect(tooltip(openMic.store)).toBe('openMic'));
  });

  it('explain the Typed Fallback, not open mic, when the Player types with open mic chosen', async () => {
    const { store } = atTheCafe();
    store.getState().setTalkMode('open-mic');
    store.getState().chooseTypedFallback();
    store.getState().talk();

    await vi.waitFor(() => expect(tooltip(store)).toBe('typedFallback'));
    store.getState().dismissTooltip();
    await flush();
    expect(tooltip(store)).toBeNull();
  });

  it('explain Shifts as the first one starts', async () => {
    const game = hire(createSave(DEV_SETUP), 'barista');
    const { store } = playing({ ...game, placeId: 'cafe', clock: { day: 3, minuteOfDay: 10 * 60 } });
    store.getState().setInteractable('staff-door');

    store.getState().startShift();

    await vi.waitFor(() => expect(tooltip(store)).toBe('shift'));
  });

  it('wait their turn: one at a time, the next after Got it', async () => {
    const game = hire(createSave(DEV_SETUP), 'barista');
    const { store } = playing({ ...game, placeId: 'cafe', clock: { day: 3, minuteOfDay: 10 * 60 } });
    store.getState().chooseTypedFallback();
    store.getState().setInteractable('staff-door');

    // The Shift starts, and its first customer walks up to a Player who types.
    store.getState().startShift();

    await vi.waitFor(() => expect(tooltip(store)).toBe('shift'));
    store.getState().dismissTooltip();
    expect(tooltip(store)).toBe('typedFallback');
    store.getState().dismissTooltip();
    expect(tooltip(store)).toBeNull();
  });

  it('explain Fainting once the Character wakes in the ward, not over the Fainting screen', async () => {
    const game = createSave(DEV_SETUP);
    const { store } = playing({
      ...game,
      placeId: 'park',
      clock: { day: 3, minuteOfDay: 15 * 60 },
      character: { ...game.character, health: 0.01, hunger: 0, thirst: 0 },
    });

    store.getState().advance(CLOCK.maxRealDeltaMs);
    await flush();
    expect(tooltip(store)).toBeNull();

    store.getState().wakeInWard();
    await vi.waitFor(() => expect(tooltip(store)).toBe('fainting'));
  });

  it('explain the Journal once the first Recap closes', async () => {
    const setup = atTheCafe();
    orderALatte(setup);
    await flush();
    expect(tooltip(setup.store)).toBeNull();

    setup.store.getState().seeRecap();
    setup.store.getState().closeRecap();

    await vi.waitFor(() => expect(tooltip(setup.store)).toBe('journal'));
  });

  it('explain the Journal when the Recap is skipped too, since it still goes there', async () => {
    const setup = atTheCafe();
    orderALatte(setup);

    setup.store.getState().skipRecap();

    await vi.waitFor(() => expect(tooltip(setup.store)).toBe('journal'));
  });

  it('say nothing of the Journal when a conversation is left before it is decided', async () => {
    const { store, npc } = atTheCafe();
    store.getState().talk();
    npc.says('いらっしゃいませ！');

    store.getState().leaveConversation();

    await flush();
    expect(tooltip(store)).toBeNull();
  });

  it('can all be turned off: none show, and the one showing goes', async () => {
    const off = atTheCafe();
    off.store.getState().setTooltips(false);
    off.store.getState().chooseTypedFallback();
    off.store.getState().talk();
    await flush();
    expect(tooltip(off.store)).toBeNull();

    const showing = atTheCafe();
    showing.store.getState().chooseTypedFallback();
    showing.store.getState().talk();
    await vi.waitFor(() => expect(tooltip(showing.store)).toBe('typedFallback'));
    showing.store.getState().setTooltips(false);
    expect(tooltip(showing.store)).toBeNull();
  });

  it('turned off, are not counted as seen, so turned on again they show when next they come up', async () => {
    const browser = browserSettings();
    const { store } = atTheCafe(browser);
    store.getState().setTooltips(false);
    store.getState().chooseTypedFallback();
    store.getState().talk();
    await flush();
    store.getState().leaveConversation();
    expect(browser.seen()).not.toContain('typedFallback');

    store.getState().setTooltips(true);
    store.getState().talk();
    await vi.waitFor(() => expect(tooltip(store)).toBe('typedFallback'));
  });

  it('hide while the pause menu or the Journal is open, and show again after', async () => {
    const { store } = atTheCafe();
    store.getState().chooseTypedFallback();
    store.getState().talk();
    await vi.waitFor(() => expect(tooltip(store)).toBe('typedFallback'));
    store.getState().leaveConversation();

    store.getState().openPauseMenu();
    expect(tooltip(store)).toBeNull();
    store.getState().closePauseMenu();
    expect(tooltip(store)).toBe('typedFallback');

    store.getState().openJournal();
    expect(tooltip(store)).toBeNull();
    store.getState().closeJournal();
    expect(tooltip(store)).toBe('typedFallback');
  });

  it('fire even when the tutorial was skipped', async () => {
    const browser = browserSettings({ inputMode: 'typed' });
    const { npc, openVoiceSession } = fakeNpc();
    const saves = createSaves(() => createStore('tooltips-saves', 'saves'));
    const store = createGameStore(null, { saves, openVoiceSession, deviceSettings: browser.deviceSettings });
    store.getState().openTitle();
    await vi.waitFor(() => expect(selectTitle(store.getState())?.status).toBe('ready'));
    setUpNewGame(store, { skipFirstMorning: true });
    expect(store.getState().screen).toBe('playing');

    store.getState().enterPlace('cafe');
    store.getState().setInteractable('barista');
    store.getState().talk();
    npc.says('いらっしゃいませ！');

    await vi.waitFor(() => expect(tooltip(store)).toBe('typedFallback'));
  });
});
