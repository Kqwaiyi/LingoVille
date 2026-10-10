import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { describe, expect, it } from 'vitest';
import { createSave, FIRST_MORNING_STEPS, type GameState } from '../sim/index.ts';
import type { OpenVoiceSession } from '../voice/index.ts';
import { createGameStore, createSaves, DEV_SETUP, selectFirstMorningBanner, selectFirstMorningGuide, selectPauseMenuOpen, selectSkippableFirstMorning } from './index.ts';
import { recordingSaves } from './testSaves.ts';

/** NPCs that connect and never say a word: enough to be in a conversation. */
const silentNpc: OpenVoiceSession = () => ({
  connect: () => new Promise(() => {}),
  startTalking: () => {},
  stopTalking: () => {},
  sendText: () => {},
  sendToolResponse: () => {},
  close: () => {},
});

function firstMorning(game: GameState = createSave(DEV_SETUP)) {
  const { saves, written } = recordingSaves();
  const store = createGameStore(game, { saves, openVoiceSession: silentNpc });
  return { store, written, banner: () => selectFirstMorningBanner(store.getState()) };
}

describe('the First Morning banner', () => {
  it('shows the step to do next, and where it is once the world has said', () => {
    const { store, banner } = firstMorning();
    expect(banner()).toBe('drink');
    expect(selectFirstMorningGuide(store.getState())).toBeNull();

    store.getState().setFirstMorningGuide({ metres: 3, bearing: -20 });

    expect(selectFirstMorningGuide(store.getState())).toEqual({ metres: 3, bearing: -20 });
  });

  it('moves on when a step is done, and the save keeps it', () => {
    const { store, written, banner } = firstMorning();

    store.getState().drinkWater();

    expect(banner()).toBe('walkToCafe');
    expect(written.at(-1)?.game.onboarding).toEqual({ firstMorningStepsDone: 1, firstMorningSkipped: false });

    store.getState().enterPlace('cafe');
    expect(banner()).toBe('breakfast');
    expect(written.at(-1)?.game.onboarding.firstMorningStepsDone).toBe(2);
  });

  it('carries on from where it was after Continue', async () => {
    const raw = createStore('first-morning-test', 'saves');
    const saves = createSaves(() => raw);
    const { store } = firstMorning();
    store.getState().drinkWater();
    await saves.write('slot-1', store.getState().game);

    const loaded = await saves.load('slot-1');
    const { banner } = firstMorning(loaded!.save.game);

    expect(banner()).toBe('walkToCafe');
  });

  it('waits behind the pause menu and in a conversation, and comes back after', () => {
    const { store, banner } = firstMorning();

    store.getState().openPauseMenu();
    expect(banner()).toBeNull();
    store.getState().closePauseMenu();
    expect(banner()).toBe('drink');

    store.getState().enterPlace('cafe');
    store.getState().setInteractable('barista');
    store.getState().talk();
    expect(banner()).toBeNull();
  });

  it('is gone once the First Morning is over', () => {
    const game = createSave(DEV_SETUP);
    const { banner } = firstMorning({ ...game, onboarding: { firstMorningStepsDone: FIRST_MORNING_STEPS.length, firstMorningSkipped: false } });
    expect(banner()).toBeNull();
  });
});

describe('skipping the First Morning', () => {
  it('from setup: no banner at all', () => {
    const { banner } = firstMorning(createSave({ ...DEV_SETUP, skipFirstMorning: true }));
    expect(banner()).toBeNull();
  });

  it('from the pause menu: the banner goes, the game resumes, and the save keeps it skipped', () => {
    const { store, written, banner } = firstMorning();
    store.getState().drinkWater();
    store.getState().openPauseMenu();

    store.getState().skipFirstMorning();

    expect(selectPauseMenuOpen(store.getState())).toBe(false);
    expect(banner()).toBeNull();
    expect(selectSkippableFirstMorning(store.getState())).toBe(false);
    expect(written.at(-1)?.game.onboarding).toEqual({ firstMorningStepsDone: 1, firstMorningSkipped: true });
  });
});
