import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { describe, expect, it, vi } from 'vitest';
import { createSave } from '../sim/index.ts';
import type { OpenMic, OpenVoiceSession, VoiceSessionEvents, VoiceSessionOptions } from '../voice/index.ts';
import {
  createDeviceSettings,
  createGameStore,
  createJournal,
  createSaves,
  DEFAULT_DEVICE_SETTINGS,
  DEV_SETUP,
  selectChatLines,
  selectInputMode,
  selectListening,
  selectMicLevel,
  selectMicOffChip,
  selectMicRetry,
  selectNativeLanguage,
  selectReadingAids,
  selectTalkMode,
  selectTitle,
  selectTooltipsOn,
  selectVolumes,
  type GameStoreDeps,
} from './index.ts';

let databases = 0;
/** A browser over fresh IndexedDB databases: a reload is a new store over the same ones. */
function freshBrowser(): Pick<GameStoreDeps, 'saves' | 'journal' | 'deviceSettings'> {
  const n = ++databases;
  return {
    saves: createSaves(() => createStore(`settings-saves-${n}`, 'saves')),
    journal: createJournal(() => createStore(`settings-journal-${n}`, 'entries')),
    deviceSettings: createDeviceSettings(() => createStore(`settings-device-${n}`, 'settings'), { browserLanguages: () => ['en-US'] }),
  };
}

async function onTheTitle(deps: Partial<GameStoreDeps>) {
  const store = createGameStore(null, deps);
  store.getState().openTitle();
  await vi.waitFor(() => expect(selectTitle(store.getState())?.status).toBe('ready'));
  return store;
}

/** The browser's mic: one that opens, or, if not `allowed`, one the Player refused or doesn't have. */
function fakeMic({ allowed = true } = {}) {
  const mic = { asked: 0, open: false };
  const openMic: OpenMic = async () => {
    mic.asked++;
    if (!allowed) throw new DOMException('Permission denied', 'NotAllowedError');
    mic.open = true;
    return () => (mic.open = false);
  };
  return { mic, openMic };
}

/** A barista the test speaks for, in each conversation the store opens. */
function fakeBarista() {
  const npc = {
    events: null as VoiceSessionEvents | null,
    options: undefined as VoiceSessionOptions | undefined,
    talking: false,
    sessions: 0,
    says(text: string) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete();
    },
    hears(...pieces: string[]) {
      for (const piece of pieces) npc.events!.onInputTranscript(piece);
    },
  };
  const openVoiceSession: OpenVoiceSession = (_, events, options) => {
    npc.events = events;
    npc.options = options;
    npc.sessions++;
    return {
      connect: async () => {},
      startTalking: () => (npc.talking = true),
      stopTalking: () => (npc.talking = false),
      sendText: () => {},
      sendToolResponse: () => {},
      close: () => {},
    };
  };
  return { npc, openVoiceSession };
}

function atTheCafe(deps: Partial<GameStoreDeps>) {
  const store = createGameStore(createSave(DEV_SETUP), deps);
  store.getState().enterPlace('cafe');
  store.getState().setInteractable('barista');
  return store;
}

describe('device settings', () => {
  it('every one of them can be changed, and a reload of the browser reads them back', async () => {
    const browser = freshBrowser();
    const store = await onTheTitle(browser);

    store.getState().setNativeLanguage('de');
    store.getState().setVolume('music', 0.25);
    store.getState().setVolume('voice', 0.75);
    store.getState().chooseTypedFallback();
    store.getState().setTalkMode('open-mic');
    store.getState().setReadingAids({ show: true, romaji: true });
    store.getState().setTooltips(false);

    await vi.waitFor(async () =>
      expect(await browser.deviceSettings.load()).toMatchObject({ tooltips: false, talkMode: 'open-mic', inputMode: 'typed' }),
    );
    const reloaded = await onTheTitle(browser);
    const s = reloaded.getState();
    expect(selectNativeLanguage(s)).toBe('de');
    expect(selectVolumes(s)).toEqual({ ...DEFAULT_DEVICE_SETTINGS.volumes, music: 0.25, voice: 0.75 });
    expect(selectInputMode(s)).toBe('typed');
    expect(selectTalkMode(s)).toBe('open-mic');
    expect(selectReadingAids(s)).toEqual({ show: true, romaji: true });
    expect(selectTooltipsOn(s)).toBe(false);
  });

  it('keep a volume between silent and full', async () => {
    const store = await onTheTitle(freshBrowser());

    store.getState().setVolume('master', 1.5);
    expect(selectVolumes(store.getState()).master).toBe(1);
    store.getState().setVolume('ui', -0.2);
    expect(selectVolumes(store.getState()).ui).toBe(0);
  });
});

describe('Retry microphone', () => {
  it('switches from the Typed Fallback back to Speaking once the mic opens, and lets go of it', async () => {
    const browser = freshBrowser();
    const { mic, openMic } = fakeMic();
    const store = await onTheTitle({ ...browser, openMic });
    store.getState().chooseTypedFallback();

    store.getState().retryMic();
    expect(selectMicRetry(store.getState())).toBe('trying');

    await vi.waitFor(() => expect(selectInputMode(store.getState())).toBe('mic'));
    expect(selectMicRetry(store.getState())).toBeNull();
    expect(mic.open).toBe(false);
    await vi.waitFor(async () => expect((await browser.deviceSettings.load()).inputMode).toBe('mic'));
  });

  it('stays in the Typed Fallback, and says so, while there’s still no mic', async () => {
    const browser = freshBrowser();
    const store = await onTheTitle({ ...browser, ...fakeMic({ allowed: false }) });
    store.getState().chooseTypedFallback();

    store.getState().retryMic();

    await vi.waitFor(() => expect(selectMicRetry(store.getState())).toBe('failed'));
    expect(selectInputMode(store.getState())).toBe('typed');
  });

  it('a mic that goes missing mid-game switches to the Typed Fallback, and the browser keeps it', async () => {
    const browser = freshBrowser();
    const { npc, openVoiceSession } = fakeBarista();
    const store = atTheCafe({ ...browser, openVoiceSession });
    store.getState().talk();

    npc.events!.onMicUnavailable();

    expect(selectInputMode(store.getState())).toBe('typed');
    await vi.waitFor(async () => expect((await browser.deviceSettings.load()).inputMode).toBe('typed'));
  });
});

describe('open mic', () => {
  it('asks the voice session to detect when the Player speaks, so Space doesn’t listen', () => {
    const { npc, openVoiceSession } = fakeBarista();
    const store = atTheCafe({ openVoiceSession });
    store.getState().setTalkMode('open-mic');

    store.getState().talk();
    store.getState().startTalking();

    expect(npc.options).toMatchObject({ openMic: true, typedOnly: false });
    expect(npc.talking).toBe(false);
    expect(selectListening(store.getState())).toBe(false);
  });

  it('push-to-talk leaves detection off', () => {
    const { npc, openVoiceSession } = fakeBarista();
    const store = atTheCafe({ openVoiceSession });

    store.getState().talk();

    expect(npc.options?.openMic).toBe(false);
  });

  it('starts a new Player line for each thing the Player says after the NPC, and shows how loud they are', async () => {
    const { npc, openVoiceSession } = fakeBarista();
    const store = atTheCafe({ openVoiceSession });
    store.getState().setTalkMode('open-mic');
    store.getState().talk();
    await Promise.resolve();

    npc.says('いらっしゃいませ！');
    npc.events!.onMicLevel(0.4);
    expect(selectMicLevel(store.getState())).toBe(0.4);
    npc.hears('ラテ', 'ください');
    npc.says('かしこまりました。');
    npc.hears('はい');

    expect(selectChatLines(store.getState())).toEqual([
      { speaker: 'npc', text: 'いらっしゃいませ！' },
      { speaker: 'player', text: 'ラテください' },
      { speaker: 'npc', text: 'かしこまりました。' },
      { speaker: 'player', text: 'はい' },
    ]);
  });

  it('starts a new NPC line when the Player cuts in on one', () => {
    const { npc, openVoiceSession } = fakeBarista();
    const store = atTheCafe({ openVoiceSession });
    store.getState().setTalkMode('open-mic');
    store.getState().talk();

    npc.events!.onOutputTranscript('いらっしゃい');
    npc.hears('ラテ');
    npc.says('はい、ラテですね。');

    expect(selectChatLines(store.getState())).toEqual([
      { speaker: 'npc', text: 'いらっしゃい' },
      { speaker: 'player', text: 'ラテ' },
      { speaker: 'npc', text: 'はい、ラテですね。' },
    ]);
  });
});

describe('open mic, while the conversation waits', () => {
  it('stops listening while Help is open, and listens again back in the chat', async () => {
    const { npc, openVoiceSession } = fakeBarista();
    const store = atTheCafe({ openVoiceSession });
    store.getState().setTalkMode('open-mic');
    store.getState().talk();
    await Promise.resolve();
    npc.says('いらっしゃいませ！');

    store.getState().toggleHelp();
    expect(npc.talking).toBe(false);
    npc.hears('えっと');
    expect(store.getState().conversation?.tab).toBe('help');
    expect(selectChatLines(store.getState())).toEqual([{ speaker: 'npc', text: 'いらっしゃいませ！' }]);

    store.getState().toggleHelp();
    expect(npc.talking).toBe(true);
  });
});

describe('the mic-off chip', () => {
  it('says to enable the mic in Settings in the first conversation of each day, and only says it’s off after that', () => {
    const { openVoiceSession } = fakeBarista();
    const store = atTheCafe({ openVoiceSession });
    store.getState().chooseTypedFallback();

    store.getState().talk();
    expect(selectMicOffChip(store.getState())).toBe('enableInSettings');
    store.getState().leaveConversation();

    store.getState().talk();
    expect(selectMicOffChip(store.getState())).toBe('off');
    store.getState().leaveConversation();

    const { game } = store.getState();
    store.setState({ game: { ...game, clock: { ...game.clock, day: game.clock.day + 1 } } });
    store.getState().talk();
    expect(selectMicOffChip(store.getState())).toBe('enableInSettings');
  });

  it('says to enable the mic in Settings when the mic goes missing mid-conversation', () => {
    const { npc, openVoiceSession } = fakeBarista();
    const store = atTheCafe({ openVoiceSession });
    store.getState().talk();

    npc.events!.onMicUnavailable();

    expect(selectMicOffChip(store.getState())).toBe('enableInSettings');
  });

  it('isn’t there while the Player speaks with the mic', () => {
    const { openVoiceSession } = fakeBarista();
    const store = atTheCafe({ openVoiceSession });

    store.getState().talk();

    expect(selectMicOffChip(store.getState())).toBeNull();
  });
});
