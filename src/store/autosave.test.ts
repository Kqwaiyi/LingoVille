import { describe, expect, it, vi } from 'vitest';
import { CLOCK, createSave, SAVE } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import { createGameStore, DEV_SETUP, selectSavedCount } from './index.ts';
import { recordingSaves } from './testSaves.ts';

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

/** Waits until this many saves have finished. */
async function saved(store: ReturnType<typeof createGameStore>, times: number) {
  await vi.waitFor(() => expect(selectSavedCount(store.getState())).toBe(times));
}
