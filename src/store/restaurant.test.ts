import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { NpcSession, ToolResponse } from '../ai/index.ts';
import { CULTURE_PACKS, formatLocalMoney, INTERACTIONS, menuPrice, placeHours } from '../content/index.ts';
import { createSave, MOOD, type GameState, type OpeningHours } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import { createGameStore, DEV_SETUP, selectConversation, selectSmallTalkKey, selectTalkWithE, selectTalkWithF } from './index.ts';

const RESTAURANT = placeHours('restaurant', DEV_SETUP.culturePackId) as Exclude<OpeningHours, null>;
/** Day 2 is a Tuesday: the restaurant is open. */
const LUNCHTIME = { day: 2, minuteOfDay: RESTAURANT.opensAt + 60 };

/** A store with the Character next to the server while the restaurant is open. The test speaks for the server. */
function atTheRestaurant(game: Partial<GameState> = {}) {
  const npc = { session: null as NpcSession | null, events: null as VoiceSessionEvents | null, answers: [] as ToolResponse[] };
  const openVoiceSession: OpenVoiceSession = (session, events) => {
    npc.session = session;
    npc.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: () => {},
      sendToolResponse: (_, response) => npc.answers.push(response),
      close: () => {},
    };
  };
  const store = createGameStore({ ...createSave(DEV_SETUP), clock: LUNCHTIME, ...game }, { openVoiceSession });
  store.getState().enterPlace('restaurant');
  store.getState().setInteractable('server');
  return { store, npc };
}

/** The server calls the completion, then Leave skips the goodbye and closes the closing card. */
function complete({ store, npc }: ReturnType<typeof atTheRestaurant>, name: string, args: unknown) {
  npc.events!.onToolCall({ id: `call-${npc.answers.length}`, name, args });
  store.getState().leaveConversation();
  store.getState().leaveConversation();
}

describe('the restaurant', () => {
  it('gets a table on E, and chats on T', () => {
    const { store } = atTheRestaurant();

    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.getATable);
    expect(selectTalkWithF(store.getState())).toBe(INTERACTIONS.askServerForWork);
    expect(selectSmallTalkKey(store.getState())).toBe('T');
  });

  it('seats the Character, serves a meal onto the bill, and charges the bill', () => {
    const restaurant = atTheRestaurant();
    const { store, npc } = restaurant;
    const money = store.getState().game.character.moneyInShifts;
    const mood = store.getState().game.character.mood;

    store.getState().talk('E');
    complete(restaurant, 'seat_guest', { party: 1, seating: 'window' });
    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.orderAMeal);
    expect(selectTalkWithF(store.getState())).toBe(INTERACTIONS.recommendAMeal);

    store.getState().talk('E');
    complete(restaurant, 'serve_order', { items: [{ item: 'chicken-dish', quantity: 1 }, { item: 'cola', quantity: 1 }] });
    expect(store.getState().game.character.moneyInShifts).toBe(money);
    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.payTheBill);

    store.getState().talk('E');
    const total = menuPrice('chicken-dish', 'ja') + menuPrice('cola', 'ja');
    expect(npc.session!.systemInstruction).toContain(`Bill total: ${formatLocalMoney(total, 'ja')}.`);
    complete(restaurant, 'settle_bill', { method: 'cash' });
    expect(selectConversation(store.getState())).toBeNull();

    expect(npc.answers).toEqual([{ result: 'done' }, { result: 'served' }, { result: 'done' }]);
    expect(store.getState().game.character.moneyInShifts).toBeCloseTo(money - total);
    expect(store.getState().game.restaurant).toEqual({ seated: false, bill: [] });
    expect(store.getState().game.character.mood).toBe(mood + 3 * MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.meal);
    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.getATable);
  });

  it('makes a bill walked out on restaurant debt, which E at the server takes before seating the Character again', () => {
    const restaurant = atTheRestaurant({ placeId: 'restaurant', restaurant: { seated: true, bill: [] } });
    const { store, npc } = restaurant;
    store.getState().talk('E');
    complete(restaurant, 'serve_order', { items: [{ item: 'pork-dish', quantity: 1 }] });
    const money = store.getState().game.character.moneyInShifts;
    const owed = menuPrice('pork-dish', 'ja');

    store.getState().enterPlace('tram-stop');
    store.getState().enterPlace('restaurant');
    store.getState().setInteractable('server');
    expect(store.getState().game.debts).toEqual([{ kind: 'restaurant', amountInShifts: owed }]);
    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.payTheBill);

    store.getState().talk('E');
    expect(npc.session!.systemInstruction).toContain(`Owed from last time, when they left without paying: ${formatLocalMoney(owed, 'ja')}.`);
    complete(restaurant, 'settle_bill', { method: 'card' });

    expect(store.getState().game.debts).toEqual([]);
    expect(store.getState().game.character.moneyInShifts).toBeCloseTo(money - owed);
    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.getATable);
  });

  it('tells the server a recommended dish breaks the dietary need, and serves nothing', () => {
    const { store, npc } = atTheRestaurant({ placeId: 'restaurant', restaurant: { seated: true, bill: [] } });

    store.getState().talk('F');
    npc.events!.onToolCall({ id: 'call-1', name: 'serve_order', args: { items: [{ item: 'fish-dish', quantity: 1 }], restriction: 'vegetarian' } });

    expect(npc.answers).toEqual([{ result: 'invalid_arguments', error: expect.stringContaining(CULTURE_PACKS.ja.goods['fish-dish'].name) }]);
    expect(store.getState().game.restaurant.bill).toEqual([]);
  });
});
