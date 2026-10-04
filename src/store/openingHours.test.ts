import { describe, expect, it } from 'vitest';
import { placeHours } from '../content/index.ts';
import { CLOCK, createSave, type GameState, type OpeningHours } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  selectConversation,
  selectInteractable,
  selectPlaceHours,
  selectPlaceId,
  selectPlaceOpen,
} from './index.ts';

const CAFE = placeHours('cafe', DEV_SETUP.culturePackId) as Exclude<OpeningHours, null>;
const MONDAY = 1;

/** A barista the test speaks for. */
function fakeBarista() {
  const npc = {
    events: null as VoiceSessionEvents | null,
    closed: false,
    says(text: string) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      npc.events!.onToolCall({ id: 'call', name, args });
    },
  };
  const open: OpenVoiceSession = (_, events) => {
    npc.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: () => {},
      sendToolResponse: () => {},
      close: () => (npc.closed = true),
    };
  };
  return { npc, open };
}

/** A game at `minuteOfDay` on Monday, the Character standing wherever `placeId` says. */
function playingAt(minuteOfDay: number, placeId: GameState['placeId'] = 'home') {
  const { npc, open } = fakeBarista();
  const save = createSave(DEV_SETUP);
  const store = createGameStore({ ...save, placeId, clock: { day: MONDAY, minuteOfDay } }, { openVoiceSession: open });
  return { store, npc };
}

/** Advances game time by roughly `gameMinutes`, frame by frame, at whatever scale the store is running. */
function waitGameMinutes(store: ReturnType<typeof createGameStore>, gameMinutes: number) {
  const start = store.getState().game.clock.minuteOfDay;
  while (store.getState().game.clock.minuteOfDay - start < gameMinutes) store.getState().advance(CLOCK.maxRealDeltaMs);
}

describe('opening hours', () => {
  it("shows the current place's hours, and whether it's open now", () => {
    const { store } = playingAt(CAFE.opensAt + 60, 'cafe');
    expect(selectPlaceId(store.getState())).toBe('cafe');
    expect(selectPlaceHours(store.getState())).toEqual(CAFE);
    expect(selectPlaceOpen(store.getState())).toBe(true);

    waitGameMinutes(store, CAFE.closesAt - store.getState().game.clock.minuteOfDay);
    expect(selectPlaceOpen(store.getState())).toBe(false);
  });

  it("won't let the Character into the café once it has closed", () => {
    const { store } = playingAt(CAFE.closesAt);
    store.getState().enterPlace('cafe');
    expect(selectPlaceId(store.getState())).toBe('home');
  });

  it("lets the Character in once it's open", () => {
    const { store } = playingAt(CAFE.opensAt);
    store.getState().enterPlace('cafe');
    expect(selectPlaceId(store.getState())).toBe('cafe');
  });

  it("hides Press E for staff at a closed place, and they can't be talked to", () => {
    const { store, npc } = playingAt(CAFE.closesAt, 'cafe');
    store.getState().setInteractable('barista');

    expect(selectInteractable(store.getState())).toBeNull();
    store.getState().talk();
    expect(selectConversation(store.getState())).toBeNull();
    expect(npc.events).toBeNull();
  });

  it('never cuts a conversation short: one started before closing runs to its end', () => {
    const { store, npc } = playingAt(CAFE.closesAt - 5, 'cafe');
    store.getState().setInteractable('barista');
    store.getState().talk();
    npc.says('いらっしゃいませ！');

    waitGameMinutes(store, 10);
    expect(selectPlaceOpen(store.getState())).toBe(false);

    store.getState().sendTypedLine('ラテ ください');
    npc.says('ホットラテですね。よろしいですか？');
    store.getState().sendTypedLine('はい');
    npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    npc.says('ありがとうございました！');

    expect(selectConversation(store.getState())?.outcome).toMatchObject({ kind: 'success' });
  });
});
