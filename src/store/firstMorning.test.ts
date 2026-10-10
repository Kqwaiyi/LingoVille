import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToolResponse } from '../ai/index.ts';
import { createSave, FIRST_MORNING, FIRST_MORNING_STEPS, PROFICIENCY_STEP_TABLE, type GameState } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  createSaves,
  DEFAULT_DEVICE_SETTINGS,
  DEV_SETUP,
  SAVE_SCHEMA_VERSION,
  selectClosingCard,
  selectConversation,
  selectFirstMorningBanner,
  selectFirstMorningCard,
  selectFirstMorningGuide,
  selectFirstMorningOrderPrompt,
  selectHelpOpen,
  selectHelpPulse,
  selectMoneyInShifts,
  selectNpcExpression,
  selectPauseMenuOpen,
  selectRentDueDay,
  selectSkippableFirstMorning,
  selectTooltip,
  type GameStoreDeps,
} from './index.ts';
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

/** The barista, spoken for by the test, recording how the store answers each tool call. */
function fakeBarista() {
  const npc = {
    events: null as VoiceSessionEvents | null,
    answers: [] as ToolResponse[],
    says(text: string) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      npc.events!.onToolCall({ id: 'call', name, args });
      return npc.answers.at(-1);
    },
  };
  const openVoiceSession: OpenVoiceSession = (_, events) => {
    npc.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: () => {},
      sendToolResponse: (_id, response) => npc.answers.push(response),
      close: () => {},
    };
  };
  return { npc, openVoiceSession };
}

/** At the café counter, the First Morning under way unless `game` says otherwise, with Recaps that arrive at once. */
function atTheCounter(game: GameState = createSave(DEV_SETUP), deps: Partial<GameStoreDeps> = {}) {
  const { npc, openVoiceSession } = fakeBarista();
  const store = createGameStore(game, {
    saves: recordingSaves().saves,
    openVoiceSession,
    requestRecap: async () => ({ outcome: 'You ordered a latte.', corrections: [], newWords: [], cefrEstimate: 'A1' }),
    deviceSettings: { load: async () => DEFAULT_DEVICE_SETTINGS, save: async () => {}, update: async () => {} },
    ...deps,
  });
  store.getState().enterPlace('cafe');
  store.getState().setInteractable('barista');
  return { store, npc };
}

/** Talks to the barista, who greets the Character. */
function order(setup = atTheCounter()) {
  setup.store.getState().talk();
  setup.npc.says('いらっしゃいませ！');
  return setup;
}

/** A turn the barista can't make sense of. Answers how the store answered `not_understood`. */
function gibberish({ store, npc }: ReturnType<typeof atTheCounter>) {
  store.getState().sendTypedLine('ぐるる');
  const answer = npc.calls('not_understood', { reason: 'unintelligible' });
  npc.says('すみません、もう一度お願いします。');
  return answer;
}

/** Orders a latte, and the barista says goodbye: the closing card shows. */
function servedALatte(setup = order()) {
  setup.store.getState().sendTypedLine('ラテ ください');
  setup.npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
  setup.npc.says('ありがとうございました。');
  return setup;
}

const pastTheFirstMorning = () => createSave({ ...DEV_SETUP, skipFirstMorning: true });
const pulse = ({ store }: ReturnType<typeof atTheCounter>) => selectHelpPulse(store.getState());
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const startingPatience = PROFICIENCY_STEP_TABLE[DEV_SETUP.startingStep].startingPatience;
const silence = FIRST_MORNING.helpPulseAfterSilentSeconds * 1000;

describe('the First Morning café order', () => {
  it('can’t fail: however many turns the barista can’t make sense of, Patience never runs out', () => {
    const setup = order();
    for (let turn = 0; turn < startingPatience * 3; turn++) expect(gibberish(setup)).toEqual({ result: 'noted' });
    expect(selectNpcExpression(setup.store.getState())).toBe('strained');
    expect(selectConversation(setup.store.getState())?.outcome).toBeNull();

    servedALatte(setup);
    expect(selectClosingCard(setup.store.getState())?.kind).toBe('success');
  });

  it('is the only order whose Patience can’t run out', () => {
    const setup = order(atTheCounter(pastTheFirstMorning()));
    const answers = Array.from({ length: startingPatience }, () => gibberish(setup));
    expect(answers.at(-1)).toEqual({ result: 'out_of_patience' });
  });
});

describe('Help in the First Morning café order', () => {
  afterEach(() => void vi.useRealTimers());

  it('pulses at the first turn the barista can’t make sense of, but stays shut', () => {
    const setup = order();
    expect(pulse(setup)).toBe(false);

    gibberish(setup);

    expect(pulse(setup)).toBe(true);
    expect(selectHelpOpen(setup.store.getState())).toBe(false);
  });

  it('pulses once the Player has been quiet for a while since the barista spoke', () => {
    vi.useFakeTimers();
    const setup = order();

    vi.advanceTimersByTime(silence - 100);
    expect(pulse(setup)).toBe(false);
    vi.advanceTimersByTime(100);
    expect(pulse(setup)).toBe(true);
  });

  it('counts the quiet from the barista’s latest line: a turn taken starts it over', () => {
    vi.useFakeTimers();
    const setup = order();

    vi.advanceTimersByTime(silence - 1000);
    setup.store.getState().sendTypedLine('ラテ');
    // Waiting on the barista isn't the Player being quiet.
    vi.advanceTimersByTime(silence);
    expect(pulse(setup)).toBe(false);

    setup.npc.says('ホットとアイス、どちらにしますか？');
    vi.advanceTimersByTime(silence - 100);
    expect(pulse(setup)).toBe(false);
    vi.advanceTimersByTime(100);
    expect(pulse(setup)).toBe(true);
  });

  it('doesn’t count typing a reply as being quiet: each keystroke starts the quiet over', () => {
    vi.useFakeTimers();
    const setup = order();

    vi.advanceTimersByTime(silence - 1000);
    setup.store.getState().draftTypedLine();
    vi.advanceTimersByTime(silence - 100);
    expect(pulse(setup)).toBe(false);
    vi.advanceTimersByTime(100);
    expect(pulse(setup)).toBe(true);
  });

  it('doesn’t count the time the tab is hidden', () => {
    vi.useFakeTimers();
    const setup = order();

    vi.advanceTimersByTime(silence - 1000);
    setup.store.getState().setTabHidden(true);
    vi.advanceTimersByTime(silence * 3);
    expect(pulse(setup)).toBe(false);

    setup.store.getState().setTabHidden(false);
    vi.advanceTimersByTime(silence - 100);
    expect(pulse(setup)).toBe(false);
    vi.advanceTimersByTime(100);
    expect(pulse(setup)).toBe(true);
  });

  it('stops pulsing for good once the Player opens Help', () => {
    vi.useFakeTimers();
    const setup = order();
    gibberish(setup);

    setup.store.getState().toggleHelp();
    expect(pulse(setup)).toBe(false);
    setup.store.getState().toggleHelp();

    gibberish(setup);
    vi.advanceTimersByTime(silence);
    expect(pulse(setup)).toBe(false);
  });

  it('stops once the order is served', () => {
    vi.useFakeTimers();
    const setup = servedALatte();
    vi.advanceTimersByTime(silence);
    expect(pulse(setup)).toBe(false);
  });

  it('never pulses in another conversation', () => {
    vi.useFakeTimers();
    const setup = order(atTheCounter(pastTheFirstMorning()));
    gibberish(setup);
    vi.advanceTimersByTime(silence);
    expect(pulse(setup)).toBe(false);
  });
});

describe('how the First Morning café order says to answer', () => {
  it('teaches the Typed Fallback without a mic', () => {
    const setup = atTheCounter();
    setup.store.getState().chooseTypedFallback();
    order(setup);
    expect(selectFirstMorningOrderPrompt(setup.store.getState())).toBe('type');
  });

  it('teaches push-to-talk with a mic', () => {
    const setup = order();
    expect(selectFirstMorningOrderPrompt(setup.store.getState())).toBe('holdSpace');
  });

  it('never teaches open mic: with it on, it only says to order, and its tooltip waits for a later conversation', async () => {
    const setup = atTheCounter();
    setup.store.getState().setTalkMode('open-mic');
    order(setup);

    expect(selectFirstMorningOrderPrompt(setup.store.getState())).toBe('say');
    await flush();
    expect(selectTooltip(setup.store.getState())).toBeNull();

    servedALatte(setup);
    setup.store.getState().skipRecap();
    setup.store.getState().dismissFirstMorningCard();
    await flush();
    // The Journal's tooltip comes up as the first Recap closes.
    setup.store.getState().dismissTooltip();
    setup.store.getState().talk();
    await vi.waitFor(() => expect(selectTooltip(setup.store.getState())).toBe('openMic'));
  });

  it('is gone once the order is served, and in any other conversation', () => {
    const setup = servedALatte();
    expect(selectFirstMorningOrderPrompt(setup.store.getState())).toBeNull();

    const later = order(atTheCounter(pastTheFirstMorning()));
    expect(selectFirstMorningOrderPrompt(later.store.getState())).toBeNull();
  });
});

describe('the First Morning closing card', () => {
  const card = ({ store }: ReturnType<typeof atTheCounter>) => selectFirstMorningCard(store.getState());

  it('shows once breakfast is done and the conversation is over: the money, the day rent is due, and the three places hiring', () => {
    const setup = servedALatte();
    expect(card(setup)).toBe(false);

    setup.store.getState().skipRecap();

    expect(card(setup)).toBe(true);
    const state = setup.store.getState();
    expect(selectMoneyInShifts(state)).toBe(state.game.character.moneyInShifts);
    expect(selectRentDueDay(state)).toBe(FIRST_MORNING.rentDueDay);
  });

  it('waits behind the pause menu, and is gone for good once dismissed', () => {
    const setup = servedALatte();
    setup.store.getState().skipRecap();

    setup.store.getState().openPauseMenu();
    expect(card(setup)).toBe(false);
    setup.store.getState().closePauseMenu();
    expect(card(setup)).toBe(true);

    setup.store.getState().dismissFirstMorningCard();
    expect(card(setup)).toBe(false);
    servedALatte(order(setup));
    setup.store.getState().skipRecap();
    expect(card(setup)).toBe(false);
  });

  it('ends a First Morning finished anywhere, such as with a meal cooked at home', () => {
    const game = createSave(DEV_SETUP);
    const store = createGameStore(
      { ...game, possessions: { ...game.possessions, inventory: [{ itemId: 'eggs', quantity: 1, expiresOnDay: 3 }] } },
      { saves: recordingSaves().saves },
    );
    store.getState().cook();
    expect(selectFirstMorningCard(store.getState())).toBe(true);
  });

  it('never shows when the First Morning is skipped', () => {
    const { store } = firstMorning();
    store.getState().skipFirstMorning();
    expect(selectFirstMorningCard(store.getState())).toBe(false);
  });

  it('never shows for a save loaded with the First Morning already over', async () => {
    const save = createSave(DEV_SETUP);
    const game: GameState = { ...save, onboarding: { firstMorningStepsDone: FIRST_MORNING_STEPS.length, firstMorningSkipped: false } };
    const store = createGameStore(null, {
      saves: {
        ...recordingSaves().saves,
        slots: async () => [
          {
            slotId: 'slot-1',
            status: 'ready',
            save: { schemaVersion: SAVE_SCHEMA_VERSION, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game },
            lastPlayedAt: '',
            fromBackup: false,
          },
          ...(['slot-2', 'slot-3', 'slot-4'] as const).map((slotId) => ({ slotId, status: 'empty' as const })),
        ],
      },
      deviceSettings: { load: async () => DEFAULT_DEVICE_SETTINGS, save: async () => {}, update: async () => {} },
      storage: { persisted: async () => true, persist: async () => true },
    });
    store.getState().openTitle();
    await vi.waitFor(() => expect(store.getState().title?.status).toBe('ready'));

    store.getState().continueGame();

    expect(store.getState().screen).toBe('playing');
    expect(selectFirstMorningCard(store.getState())).toBe(false);
  });
});
