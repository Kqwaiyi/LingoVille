import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { describe, expect, it, vi } from 'vitest';
import { libraryPinyin, type AnnotateRequest, type Annotation, type Recap, type Segment } from '../ai/index.ts';
import { createSave, type GameState, type LanguageCode } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createDeviceSettings,
  createGameStore,
  createJournal,
  createSaves,
  DEV_SETUP,
  selectLineReading,
  selectNpcSpeaking,
  selectReadingAids,
  selectRecap,
  type GameStoreDeps,
  type LibraryReadings,
} from './index.ts';
import { setUpNewGame } from './testSetup.ts';
import { recordingSaves } from './testSaves.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const s = (base: string, reading = ''): Segment => ({ base, reading });

/** Something the test answers when it says, or fails. */
function pending<Request, Answer>() {
  const asked: { request: Request; answer: (answer: Answer) => Promise<void>; fail: () => Promise<void> }[] = [];
  const ask = (request: Request) =>
    new Promise<Answer>((resolve, reject) =>
      asked.push({
        request,
        answer: async (answer) => {
          resolve(answer);
          await flush();
        },
        fail: async () => {
          reject(new Error('unavailable'));
          await flush();
        },
      }),
    );
  return { asked, ask };
}

// The ja library reading the fake kuromoji gives: 方 misread as ほう.
const JA_LIBRARY: Record<string, Segment[]> = {
  'この方は': [s('この'), s('方', 'ほう'), s('は')],
  'この方はどなたですか？': [s('この'), s('方', 'ほう'), s('は'), s('どなた'), s('ですか'), s('？')],
  一日中: [s('一日中', 'いちにちちゅう')],
};
const JA_MODEL: Segment[] = [s('この'), s('方', 'かた'), s('は'), s('どなた'), s('ですか'), s('？')];

/** Library readings: pinyin-pro for zh, and a fake kuromoji for ja that reads only the lines it knows. */
function fakeLibrary(): LibraryReadings & { preloaded: LanguageCode[] } {
  const preloaded: LanguageCode[] = [];
  return {
    preloaded,
    preload: async (language) => void preloaded.push(language),
    read: (language, line) => (language === 'zh' ? libraryPinyin(line) : (JA_LIBRARY[line] ?? null)),
  };
}

let databases = 0;

/** A café in the given language whose barista, annotations and Recaps the test speaks for. */
function cafe(language: LanguageCode = 'ja', overrides: Partial<GameStoreDeps> = {}) {
  const game: GameState = createSave({ ...DEV_SETUP, targetLanguage: language, culturePackId: language });
  const npc = {
    events: null as VoiceSessionEvents | null,
    speaks(text: string) {
      npc.events!.onOutputTranscript(text);
    },
    finishes() {
      npc.events!.onTurnComplete();
    },
    says(text: string) {
      npc.speaks(text);
      npc.finishes();
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
  const annotations = pending<AnnotateRequest, Annotation>();
  const recaps = pending<unknown, Recap>();
  const journal = createJournal(() => createStore(`reading-aids-test-${++databases}`, 'entries'));
  const deviceSettings = createDeviceSettings(() => createStore(`reading-aids-settings-${databases}`, 'settings'));
  const library = fakeLibrary();
  const store = createGameStore(game, {
    openVoiceSession,
    requestAnnotation: annotations.ask,
    requestRecap: recaps.ask,
    saves: recordingSaves().saves,
    journal,
    deviceSettings,
    readings: library,
    ...overrides,
  });
  store.getState().enterPlace('cafe');
  store.getState().setInteractable('barista');
  store.getState().talk();
  return { store, npc, annotations, recaps, journal, deviceSettings, library };
}

const reading = (store: ReturnType<typeof cafe>['store'], line: number) => selectLineReading(line)(store.getState());

describe('reading aids in the chat column', () => {
  it('zh: shows pinyin from pinyin-pro over a line the moment it appears, before it is finished', () => {
    const { store, npc, annotations } = cafe('zh');

    npc.speaks('他长得');

    expect(reading(store, 0)).toEqual(libraryPinyin('他长得'));
    npc.speaks('很高。');
    expect(reading(store, 0)).toEqual(libraryPinyin('他长得很高。'));
    expect(annotations.asked).toEqual([]);
  });

  it('zh: replaces the library reading with the model’s once it passes the checks', async () => {
    const { store, npc, annotations } = cafe('zh');
    npc.says('他长得很高。');

    const model = [s('他', 'tā'), s('长得', 'zhǎng de'), s('很高', 'hěn gāo'), s('。')];
    await annotations.asked[0]!.answer({ translation: 'He is tall.', segments: model });

    expect(reading(store, 0)).toEqual(model);
  });

  it('keeps the library reading when the model’s fails a check, and says which', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { store, npc, annotations } = cafe('zh');
    npc.says('他很高。');

    await annotations.asked[0]!.answer({ translation: 'He is tall.', segments: [s('他很高', 'tā hén gāo'), s('。')] });

    expect(reading(store, 0)).toEqual(libraryPinyin('他很高。'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[annotate]'), 'library', expect.stringContaining('很'));
    warn.mockRestore();
  });

  it('ja: shows the kuromoji reading at once, and the model’s once it passes', async () => {
    const { store, npc, annotations } = cafe('ja');

    npc.speaks('この方は');
    expect(reading(store, 0)).toEqual(JA_LIBRARY['この方は']);
    npc.speaks('どなたですか？');
    npc.finishes();
    await annotations.asked[0]!.answer({ translation: 'Who is this?', segments: JA_MODEL });

    expect(reading(store, 0)).toEqual(JA_MODEL);
  });

  it('ja: a line the library can’t read yet waits for the model’s reading', async () => {
    const { store, npc, annotations } = cafe('ja');
    npc.says('ご注文は？');
    expect(reading(store, 0)).toBeNull();

    const model = [s('ご注文', 'ごちゅうもん'), s('は'), s('？')];
    await annotations.asked[0]!.answer({ translation: 'Your order?', segments: model });

    expect(reading(store, 0)).toEqual(model);
  });

  it('checks the model’s reading against the line as the gateway saw it, without the transcript’s spaces', async () => {
    const { store, npc, annotations } = cafe('zh');
    npc.says(' 好。');

    await annotations.asked[0]!.answer({ translation: 'OK.', segments: [s('好', 'hǎo'), s('。')] });

    expect(reading(store, 0)).toEqual([s('好', 'hǎo'), s('。')]);
  });

  it('a model reading that arrives late never lands in the next conversation', async () => {
    const { store, npc, annotations } = cafe('zh');
    npc.says('好。');
    store.getState().leaveConversation();
    store.getState().talk();
    npc.says('谢谢。');

    await annotations.asked[0]!.answer({ translation: 'OK.', segments: [s('好', 'hǎo'), s('。')] });

    expect(reading(store, 0)).toEqual(libraryPinyin('谢谢。'));
  });

  it('has no reading aids for en or de', async () => {
    const { store, npc, annotations } = cafe('de');
    npc.says('Hallo!');
    await annotations.asked[0]!.answer({ translation: 'Hello!' });

    expect(reading(store, 0)).toBeNull();
  });

  it('never puts a reading over the Player’s own lines', () => {
    const { store, npc } = cafe('zh');
    npc.says('您好。');
    store.getState().sendTypedLine('你好');

    expect(reading(store, 1)).toBeNull();
  });
});

describe('the speaking… indicator', () => {
  it('shows over the NPC while a line is coming in, and goes once it is finished', () => {
    const { store, npc } = cafe('ja');
    expect(selectNpcSpeaking(store.getState())).toBeNull();

    npc.speaks('いらっしゃいませ');
    expect(selectNpcSpeaking(store.getState())).toBe('barista');

    npc.finishes();
    expect(selectNpcSpeaking(store.getState())).toBeNull();
  });
});

describe('the reading aids settings', () => {
  it('shows reading aids and no romaji by default', () => {
    const { store } = cafe('ja');
    expect(selectReadingAids(store.getState())).toEqual({ show: true, romaji: false });
  });

  it('hiding reading aids hides every reading, and keeps the choice on this device', async () => {
    const { store, npc, deviceSettings } = cafe('zh');
    npc.says('好。');

    store.getState().setReadingAids({ show: false });

    expect(reading(store, 0)).toBeNull();
    await vi.waitFor(async () => expect(await deviceSettings.load()).toMatchObject({ readingAids: false, showRomaji: false }));
    store.getState().setReadingAids({ show: true });
    expect(reading(store, 0)).toEqual(libraryPinyin('好。'));
  });

  it('turns romaji on, and keeps that on this device too', async () => {
    const { store, deviceSettings } = cafe('ja');

    store.getState().setReadingAids({ romaji: true });

    expect(selectReadingAids(store.getState())).toEqual({ show: true, romaji: true });
    await vi.waitFor(async () => expect(await deviceSettings.load()).toMatchObject({ readingAids: true, showRomaji: true }));
  });

  it('keeps the last of quick changes', async () => {
    const { store, deviceSettings } = cafe('ja');

    store.getState().setReadingAids({ romaji: true });
    store.getState().setReadingAids({ show: false });
    store.getState().setReadingAids({ romaji: false });

    await vi.waitFor(async () => expect(await deviceSettings.load()).toMatchObject({ readingAids: false, showRomaji: false }));
    await flush();
    await flush();
    expect(await deviceSettings.load()).toMatchObject({ readingAids: false, showRomaji: false });
  });

  it('reads the settings with the rest of the device settings on the title screen', async () => {
    const deviceSettings = createDeviceSettings(() => createStore(`reading-aids-title-${++databases}`, 'settings'));
    await deviceSettings.save({ ...(await deviceSettings.load()), readingAids: false, showRomaji: true });
    const store = createGameStore(null, { deviceSettings, saves: recordingSaves().saves, readings: fakeLibrary() });

    store.getState().openTitle();

    await vi.waitFor(() => expect(selectReadingAids(store.getState())).toEqual({ show: false, romaji: true }));
  });
});

describe('preloading the library', () => {
  it('starts loading the reading library for the save’s language as soon as a game starts, before any line', async () => {
    const library = fakeLibrary();
    const deviceSettings = createDeviceSettings(() => createStore(`reading-aids-preload-${++databases}`, 'settings'));
    const saves = createSaves(() => createStore(`reading-aids-saves-${databases}`, 'saves'));
    const store = createGameStore(null, { saves, deviceSettings, readings: library });
    store.getState().openTitle();
    await vi.waitFor(() => expect(store.getState().title?.status).toBe('ready'));

    setUpNewGame(store);

    expect(library.preloaded).toEqual([DEV_SETUP.targetLanguage]);
  });

  it('reads a line that came in before the library had loaded, once it has', async () => {
    let loaded = () => {};
    let ready = false;
    const library: LibraryReadings = {
      preload: () => new Promise<void>((resolve) => (loaded = resolve)).then(() => void (ready = true)),
      read: (_, line) => (ready ? (JA_LIBRARY[line] ?? null) : null),
    };
    const deviceSettings = createDeviceSettings(() => createStore(`reading-aids-late-${++databases}`, 'settings'));
    const saves = createSaves(() => createStore(`reading-aids-late-saves-${databases}`, 'saves'));
    const npc = { events: null as VoiceSessionEvents | null };
    const openVoiceSession: OpenVoiceSession = (_, events) => {
      npc.events = events;
      return { connect: async () => {}, startTalking: () => {}, stopTalking: () => {}, sendText: () => {}, sendToolResponse: () => {}, close: () => {} };
    };
    const store = createGameStore(null, { saves, deviceSettings, readings: library, openVoiceSession, requestAnnotation: () => new Promise(() => {}) });
    store.getState().openTitle();
    await vi.waitFor(() => expect(store.getState().title?.status).toBe('ready'));
    setUpNewGame(store);
    store.getState().enterPlace('cafe');
    store.getState().setInteractable('barista');
    store.getState().talk();
    npc.events!.onOutputTranscript('この方は');
    npc.events!.onTurnComplete();
    expect(reading(store, 0)).toBeNull();

    loaded();

    await vi.waitFor(() => expect(reading(store, 0)).toEqual(JA_LIBRARY['この方は']));
  });
});

describe('the Recap and the Journal', () => {
  const RECAP: Recap = {
    outcome: 'You asked who someone was.',
    corrections: [],
    newWords: [
      { base: 'この方', reading: 'このかた', gloss: 'this person (polite)' },
      // A reading that fails the checks: the library's takes its place.
      { base: '一日中', reading: 'ichinichijuu', gloss: 'all day' },
    ],
    cefrEstimate: 'A1',
  };

  /** Orders a latte, so the conversation has an outcome and a Recap. */
  function order(language: LanguageCode = 'ja') {
    const setup = cafe(language);
    const { store, npc } = setup;
    npc.says('この方はどなたですか？');
    store.getState().sendTypedLine('ラテをください');
    npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    npc.says('ありがとうございます。');
    return setup;
  }

  it('keeps each NPC line with its corrected reading, even when the correction lands after the Recap was skipped', async () => {
    const { store, annotations, recaps, journal } = order();
    expect(store.getState().conversation?.closed).toBe(true);

    store.getState().skipRecap();
    await recaps.asked[0]!.answer(RECAP);
    await annotations.asked[0]!.answer({ translation: 'Who is this?', segments: JA_MODEL });
    await annotations.asked[1]!.answer({ translation: 'Thank you.', segments: [s('ありがとうございます'), s('。')] });

    const [entry] = await journal.list(store.getState().slotId);
    expect(entry!.lines).toEqual([
      { speaker: 'npc', text: 'この方はどなたですか？', reading: JA_MODEL },
      { speaker: 'player', text: 'ラテをください', typed: true },
      { speaker: 'npc', text: 'ありがとうございます。', reading: [s('ありがとうございます'), s('。')] },
    ]);
  });

  it('keeps the library reading of a line whose correction never came', async () => {
    const { store, annotations, recaps, journal } = order();

    await annotations.asked[0]!.fail();
    await annotations.asked[1]!.fail();
    await recaps.asked[0]!.answer(RECAP);

    const [entry] = await journal.list(store.getState().slotId);
    expect(entry!.lines[0]).toEqual({ speaker: 'npc', text: 'この方はどなたですか？', reading: JA_LIBRARY['この方はどなたですか？'] });
  });

  it('shows the Recap’s new words with readings that passed the checks, or the library’s in their place', async () => {
    const { store, annotations, recaps, journal } = order();
    store.getState().seeRecap();
    await annotations.asked[0]!.fail();
    await annotations.asked[1]!.fail();
    await recaps.asked[0]!.answer(RECAP);

    const shown = selectRecap(store.getState());
    const words = [
      { base: 'この方', reading: 'このかた', gloss: 'this person (polite)' },
      { base: '一日中', reading: 'いちにちちゅう', gloss: 'all day' },
    ];
    expect(shown?.status === 'ready' && shown.entry.recap?.newWords).toEqual(words);
    const [entry] = await journal.list(store.getState().slotId);
    expect(entry!.recap?.newWords).toEqual(words);
  });
});
