import { describe, expect, it } from 'vitest';
import { CLOCK, createSave } from '../sim/index.ts';
import type { OpenVoiceSession } from '../voice/index.ts';
import { createGameStore, DEV_SETUP, selectConversation, selectPauseMenuOpen, selectTimeScale, selectWorldKeysOff } from './index.ts';

/** NPCs that connect and never say a word: enough to be in a conversation. */
const silentNpc: OpenVoiceSession = () => ({
  connect: () => new Promise(() => {}),
  startTalking: () => {},
  stopTalking: () => {},
  sendText: () => {},
  sendToolResponse: () => {},
  close: () => {},
});

function inTown() {
  return createGameStore(createSave(DEV_SETUP), { openVoiceSession: silentNpc });
}

describe('the pause menu', () => {
  it('stops the clock and decay while it is open, and Resume starts them again', () => {
    const store = inTown();
    const before = store.getState().game;

    store.getState().openPauseMenu();
    expect(selectPauseMenuOpen(store.getState())).toBe(true);
    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.paused);
    store.getState().advance(CLOCK.maxRealDeltaMs);
    expect(store.getState().game).toBe(before);

    store.getState().closePauseMenu();
    expect(selectPauseMenuOpen(store.getState())).toBe(false);
    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.normal);
    store.getState().advance(CLOCK.maxRealDeltaMs);
    expect(store.getState().game.clock.minuteOfDay).toBeGreaterThan(before.clock.minuteOfDay);
  });

  it('holds the Character still and keeps the Journal and conversations shut while it is open', () => {
    const store = inTown();
    store.getState().enterPlace('cafe');
    store.getState().setInteractable('barista');

    store.getState().openPauseMenu();
    store.getState().talk();
    store.getState().openJournal();

    expect(selectWorldKeysOff(store.getState())).toBe(true);
    expect(selectConversation(store.getState())).toBeNull();
    expect(store.getState().journal).toBeNull();
  });

  it('doesn’t open in a conversation, where Esc means Leave', () => {
    const store = inTown();
    store.getState().enterPlace('cafe');
    store.getState().setInteractable('barista');
    store.getState().talk();

    store.getState().openPauseMenu();

    expect(selectPauseMenuOpen(store.getState())).toBe(false);
  });

  it('doesn’t open over the Journal, which Esc closes instead', () => {
    const store = inTown();
    store.getState().openJournal();
    store.getState().openPauseMenu();
    expect(selectPauseMenuOpen(store.getState())).toBe(false);

    store.getState().closeJournal();
    store.getState().openPauseMenu();
    expect(selectPauseMenuOpen(store.getState())).toBe(true);
  });

  it('doesn’t open over what a Shift paid', () => {
    const store = inTown();
    store.setState({ shiftEnd: { jobId: 'barista', customers: 3, served: 3, payInShifts: 1, recap: null } });

    store.getState().openPauseMenu();

    expect(selectPauseMenuOpen(store.getState())).toBe(false);
  });

  it('doesn’t open on the title screen', () => {
    const store = createGameStore(null);

    store.getState().openPauseMenu();

    expect(selectPauseMenuOpen(store.getState())).toBe(false);
  });
});
