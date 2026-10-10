import 'fake-indexeddb/auto';
import { createStore } from 'idb-keyval';
import { describe, expect, it, vi } from 'vitest';
import { CULTURE_PACKS } from '../content/index.ts';
import { AUDIO_MIX, CLOCK, createSave, DAYLIGHT, MINUTES_PER_HOUR, PROFICIENCY_STEP_TABLE, type GameState, type NewGameSetup } from '../sim/index.ts';
import type { OpenMic, OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createDeviceSettings,
  createGameStore,
  createJournal,
  DEV_SETUP,
  selectSoundscape,
  selectTitle,
  uiSoundsBetween,
  type GameStore,
  type GameStoreDeps,
  type UiSound,
} from './index.ts';

/** A stand-in NPC the test speaks for. */
function fakeVoice() {
  let calls = 0;
  const fake = {
    events: null as VoiceSessionEvents | null,
    says(text: string) {
      fake.events!.onOutputTranscript(text);
      fake.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      fake.events!.onToolCall({ id: `call-${++calls}`, name, args });
    },
  };
  const open: OpenVoiceSession = (_, events) => {
    fake.events = events;
    return { connect: async () => {}, startTalking: () => {}, stopTalking: () => {}, sendText: () => {}, sendToolResponse: () => {}, close: () => {} };
  };
  return { fake, open };
}

let databases = 0;
/** Midday, in full daylight. */
const MIDDAY = DAYLIGHT.keyframes.find(({ preset }) => preset === 'midday')!.at;
const neverAnswers = () => new Promise<never>(() => {});

function playing(game: Partial<GameState> = {}, setup: NewGameSetup = DEV_SETUP, deps: Partial<GameStoreDeps> = {}) {
  const { fake, open } = fakeVoice();
  const store = createGameStore(
    { ...createSave(setup), ...game },
    {
      openVoiceSession: open,
      requestRecap: neverAnswers,
      requestAnnotation: neverAnswers,
      journal: createJournal(() => createStore(`soundscape-journal-${++databases}`, 'entries')),
      ...deps,
    },
  );
  return { store, fake, s: () => store.getState() };
}

/** At this minute of the First Morning's day. */
const at = (minuteOfDay: number): Partial<GameState> => ({ clock: { ...createSave(DEV_SETUP).clock, minuteOfDay } });

/** Out on the street, in front of the café. */
function onTheStreet(game: Partial<GameState> = {}, setup: NewGameSetup = DEV_SETUP) {
  const world = playing(game, setup);
  world.s().enterPlace('cafe');
  world.s().setOnStreet(true);
  return world;
}

function talkingToTheBarista(deps: Partial<GameStoreDeps> = {}, setup: NewGameSetup = DEV_SETUP) {
  const world = playing({}, setup, deps);
  world.s().enterPlace('cafe');
  world.s().setInteractable('barista');
  world.s().talk();
  world.fake.says('いらっしゃいませ！');
  return world;
}

async function onTheTitle(deps: Partial<GameStoreDeps> = {}) {
  const store = createGameStore(null, {
    deviceSettings: createDeviceSettings(() => createStore(`soundscape-device-${++databases}`, 'settings'), { browserLanguages: () => ['en-US'] }),
    ...deps,
  });
  store.getState().openTitle();
  await vi.waitFor(() => expect(selectTitle(store.getState())?.status).toBe('ready'));
  return store;
}

/** The UI sounds each change to the store makes, from now on. */
function listen(store: ReturnType<typeof createGameStore>) {
  const heard: UiSound[] = [];
  store.subscribe((after, before) => heard.push(...uiSoundsBetween(before, after)));
  return heard;
}

describe('music', () => {
  it('plays the title theme on the title screen and through setup', async () => {
    const store = await onTheTitle();
    expect(selectSoundscape(store.getState()).music).toBe('title');

    store.getState().newGame();

    expect(store.getState().screen).toBe('setup');
    expect(selectSoundscape(store.getState()).music).toBe('title');
  });

  it.each(DAYLIGHT.keyframes.map(({ preset, at }) => [preset, at]))('plays the %s loop out in the town at its time of day', (preset, minute) => {
    const { s } = onTheStreet(at(minute));
    expect(selectSoundscape(s()).music).toBe(preset);
  });

  it('changes loop as the time of day moves on', () => {
    const [morning, midday] = DAYLIGHT.keyframes.slice(1);
    const { s } = onTheStreet(at(morning!.at));

    const realMs = 1_000 * 60 * ((midday!.at - morning!.at) / MINUTES_PER_HOUR);
    for (let ms = 0; ms < realMs; ms += CLOCK.maxRealDeltaMs) s().advance(CLOCK.maxRealDeltaMs);

    expect(selectSoundscape(s()).music).toBe(midday!.preset);
  });

  it('plays the home loop at home, and the counters loop inside any other place', () => {
    const { s } = playing(at(MIDDAY));
    expect(selectSoundscape(s()).music).toBe('home');

    s().enterPlace('supermarket');

    expect(selectSoundscape(s()).music).toBe('counters');
  });

  it('plays the outdoor loop on the street, and the indoor one again back through the door', () => {
    const { s } = onTheStreet(at(DAYLIGHT.keyframes[1]!.at));
    expect(selectSoundscape(s()).music).toBe(DAYLIGHT.keyframes[1]!.preset);

    s().setOnStreet(false);

    expect(selectSoundscape(s()).music).toBe('counters');
  });

  it('plays the outdoor loop in the park and at the tram stop, which are out in the open', () => {
    const { s } = playing(at(DAYLIGHT.keyframes[1]!.at));
    s().enterPlace('park');
    expect(selectSoundscape(s()).music).toBe(DAYLIGHT.keyframes[1]!.preset);

    s().enterPlace('tram-stop');

    expect(selectSoundscape(s()).music).toBe(DAYLIGHT.keyframes[1]!.preset);
  });
});

describe('ambient sound', () => {
  it.each(['ja', 'zh', 'en', 'de'] as const)('plays the street bed out in the town, with the %s pack’s one-shots', (targetLanguage) => {
    const { s } = onTheStreet(at(MIDDAY), { ...DEV_SETUP, targetLanguage, culturePackId: targetLanguage });

    expect(selectSoundscape(s())).toMatchObject({ ambience: 'street', oneShots: CULTURE_PACKS[targetLanguage].ambient });
  });

  it('plays the indoor bed inside, with no one-shots', () => {
    const { s } = playing(at(MIDDAY));

    expect(selectSoundscape(s())).toMatchObject({ ambience: 'indoors', oneShots: [] });
  });

  it('plays the park bed in the park by day, and the night bed out in the town once the lamps are on', () => {
    const day = playing(at(MIDDAY));
    day.s().enterPlace('park');
    expect(selectSoundscape(day.s()).ambience).toBe('park');

    const night = playing(at(DAYLIGHT.lampsOnAt + 30));
    night.s().enterPlace('park');
    expect(selectSoundscape(night.s()).ambience).toBe('night');
    night.s().setOnStreet(true);
    expect(selectSoundscape(night.s()).ambience).toBe('night');
  });

  it('plays none on the title screen', () => {
    expect(selectSoundscape(createGameStore(null).getState())).toMatchObject({ ambience: null, oneShots: [] });
  });
});

describe('the mix', () => {
  const VOLUMES = { master: 0.5, music: 0.8, ambient: 0.6, voice: 0.9, ui: 0.4 };
  const withVolumes = <T extends { s: () => GameStore }>(world: T) => {
    for (const [bus, level] of Object.entries(VOLUMES)) world.s().setVolume(bus as keyof typeof VOLUMES, level);
    return world;
  };
  const full = {
    music: VOLUMES.master * VOLUMES.music,
    ambient: VOLUMES.master * VOLUMES.ambient,
    voice: VOLUMES.master * VOLUMES.voice,
    ui: VOLUMES.master * VOLUMES.ui,
  };

  it('plays each bus at its volume, under the master volume', () => {
    const { s } = withVolumes(onTheStreet());
    const levels = selectSoundscape(s()).levels;

    for (const bus of ['music', 'ambient', 'voice', 'ui'] as const) expect(levels[bus]).toBeCloseTo(full[bus]);
  });

  it('ducks music and ambient in a conversation, with the NPC’s voice and the UI at full', () => {
    const { s } = withVolumes(talkingToTheBarista());
    const levels = selectSoundscape(s()).levels;

    expect(levels.music).toBeCloseTo(full.music * AUDIO_MIX.conversation.music);
    expect(levels.ambient).toBeCloseTo(full.ambient * AUDIO_MIX.conversation.ambient);
    expect(levels.voice).toBeCloseTo(full.voice);
    expect(levels.ui).toBeCloseTo(full.ui);
  });

  it('mutes music and turns ambient right down while push-to-talk is held, and ducks them again once it’s let go', () => {
    const { s } = withVolumes(talkingToTheBarista());

    s().startTalking();
    const listening = selectSoundscape(s()).levels;
    expect(listening.music).toBeCloseTo(full.music * AUDIO_MIX.micOpen.music);
    expect(listening.ambient).toBeCloseTo(full.ambient * AUDIO_MIX.micOpen.ambient);
    expect(listening.voice).toBeCloseTo(full.voice);

    s().stopTalking();
    expect(selectSoundscape(s()).levels.music).toBeCloseTo(full.music * AUDIO_MIX.conversation.music);
  });

  it('with open mic, keeps the mic mix while the mic streams, but not in Help, where the conversation waits', () => {
    const world = withVolumes(playing());
    world.s().setTalkMode('open-mic');
    world.s().enterPlace('cafe');
    world.s().setInteractable('barista');
    world.s().talk();
    world.fake.says('いらっしゃいませ！');
    expect(selectSoundscape(world.s()).levels.ambient).toBeCloseTo(full.ambient * AUDIO_MIX.micOpen.ambient);

    world.s().toggleHelp();

    expect(selectSoundscape(world.s()).levels.ambient).toBeCloseTo(full.ambient * AUDIO_MIX.conversation.ambient);
  });

  it('keeps the conversation mix in the Typed Fallback, even set to open mic, as the mic is never opened', () => {
    const world = withVolumes(playing());
    world.s().setTalkMode('open-mic');
    world.s().chooseTypedFallback();
    world.s().enterPlace('cafe');
    world.s().setInteractable('barista');
    world.s().talk();

    expect(selectSoundscape(world.s()).levels.music).toBeCloseTo(full.music * AUDIO_MIX.conversation.music);
  });

  it('mutes the title theme during the mic check, so the check hears only the Player', async () => {
    const openMic: OpenMic = async () => () => {};
    const store = await onTheTitle({ openMic });
    const s = () => store.getState();
    s().newGame();
    s().setupNext();
    s().chooseTargetLanguage(DEV_SETUP.targetLanguage);
    s().setupNext();
    s().chooseStartingStep(DEV_SETUP.startingStep);
    s().nameCharacter(DEV_SETUP.characterName);
    s().setupNext();
    s().setupNext();

    expect(s().setup?.step).toBe('micCheck');
    expect(selectSoundscape(s()).levels.music).toBe(0);
  });
});

describe('UI sounds', () => {
  const patience = PROFICIENCY_STEP_TABLE[DEV_SETUP.startingStep].startingPatience;
  const PAST_THE_FIRST_MORNING = { ...DEV_SETUP, skipFirstMorning: true };

  it('pays for an order with money out, and chimes when the closing card shows', () => {
    const { store, fake, s } = talkingToTheBarista();
    const heard = listen(store);

    s().sendTypedLine('ラテ ください');
    fake.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    expect(heard).toEqual(['moneyOut']);

    fake.says('ありがとうございます！');
    expect(heard).toEqual(['moneyOut', 'success']);
  });

  it('cues once when the NPC’s Patience runs low, and sounds the failure tone when it runs out', () => {
    const { store, fake, s } = talkingToTheBarista({}, PAST_THE_FIRST_MORNING);
    const heard = listen(store);

    for (let i = 1; i < patience; i++) {
      s().sendTypedLine('asdf');
      fake.calls('not_understood', { reason: 'unintelligible' });
      fake.says('すみません、よくわかりませんでした。');
    }
    expect(heard).toEqual(['patienceLow']);

    s().sendTypedLine('asdf');
    fake.calls('not_understood', { reason: 'unintelligible' });
    fake.says('申し訳ございません…。');

    expect(heard).toEqual(['patienceLow', 'failure']);
  });

  it('turns a page as the Recap shows, and as the Journal opens', () => {
    const { store, fake, s } = talkingToTheBarista();
    s().sendTypedLine('ラテ ください');
    fake.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    fake.says('ありがとうございます！');
    const heard = listen(store);

    s().seeRecap();
    expect(heard).toEqual(['pageTurn']);

    s().closeRecap();
    s().openJournal();
    expect(heard).toEqual(['pageTurn', 'pageTurn']);
  });

  it('sounds money in when money comes in', () => {
    const { s } = playing();
    const before = s();
    const after: GameStore = { ...before, game: { ...before.game, character: { ...before.game.character, moneyInShifts: before.game.character.moneyInShifts + 1 } } };

    expect(uiSoundsBetween(before, after)).toEqual(['moneyIn']);
  });

  it('says nothing as it saves', () => {
    const { store, s } = playing();
    const heard = listen(store);

    s().saveNow();
    s().enterPlace('cafe');

    expect(heard).toEqual([]);
  });

  it('says nothing of the money in a save as it loads', () => {
    const store = createGameStore(null);
    const before = store.getState();
    const game = createSave(DEV_SETUP);
    const loaded: GameStore = { ...before, screen: 'playing', game: { ...game, character: { ...game.character, moneyInShifts: 9 } } };

    expect(uiSoundsBetween(before, loaded)).toEqual([]);
  });
});
