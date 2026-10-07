import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { NpcSession, ToolResponse } from '../ai/index.ts';
import { INTERACTIONS, placeHours } from '../content/index.ts';
import { createSave, MOOD, type GameState, type OpeningHours, type ProficiencyStep } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import { createGameStore, DEV_SETUP, selectConversation, selectInventory, selectSmallTalkKey, selectTalkWithE, selectTalkWithF } from './index.ts';

const BOOKSHOP = placeHours('bookshop', DEV_SETUP.culturePackId) as Exclude<OpeningHours, null>;

/** A store with the Character next to the shopkeeper while the bookshop is open, at `step`. The test speaks for the shopkeeper. */
function atTheBookshop(step: ProficiencyStep = 'A1') {
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
  const game: GameState = { ...createSave(DEV_SETUP), proficiencyStep: step, clock: { day: 2, minuteOfDay: BOOKSHOP.opensAt + 60 } };
  const store = createGameStore(game, { openVoiceSession });
  store.getState().enterPlace('bookshop');
  store.getState().setInteractable('shopkeeper');
  return { store, npc };
}

describe('the bookshop', () => {
  it('sells a book on E, a gift on F, and chats on T', () => {
    const { store } = atTheBookshop();

    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.buyABook);
    expect(selectTalkWithF(store.getState())).toBe(INTERACTIONS.buyAGift);
    expect(selectSmallTalkKey(store.getState())).toBe('T');
  });

  it('recommends a book by taste on E from the Advanced band', () => {
    const { store } = atTheBookshop('C1');

    store.getState().talk('E');

    expect(selectConversation(store.getState())?.interaction).toBe(INTERACTIONS.recommendABook);
  });

  it('puts a gift bought on F into the inventory, ready to give, and lifts Mood', () => {
    const { store, npc } = atTheBookshop();
    const mood = store.getState().game.character.mood;
    store.getState().talk('F');

    npc.events!.onToolCall({ id: 'call-1', name: 'complete_purchase', args: { items: [{ item: 'flowers', quantity: 1 }], wrap: true } });

    expect(npc.answers).toEqual([{ result: 'served' }]);
    expect(selectInventory(store.getState())).toEqual([{ itemId: 'flowers', quantity: 1, expiresOnDay: null, goneOff: false }]);
    expect(store.getState().game.character.mood).toBe(mood + MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.gift);
  });
});
