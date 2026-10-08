import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { NpcSession, ToolResponse } from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, menuPrice, placeHours, type TownNpcId } from '../content/index.ts';
import { createSave, weekdayOf, type GameState, type InventoryItem, type OpeningHours, type PlaceId } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  selectConversation,
  selectRouteMarker,
  selectSmallTalkKey,
  selectTalkWithE,
  selectTalkWithF,
  selectTalkWithR,
} from './index.ts';

const HOUR = 60;
/** The first Monday and Saturday of the game. */
const MONDAY = [1, 2, 3, 4, 5, 6, 7].find((day) => weekdayOf(day) === 'monday')!;
const SATURDAY = [1, 2, 3, 4, 5, 6, 7].find((day) => weekdayOf(day) === 'saturday')!;
const FRESH_EGGS: InventoryItem = { itemId: 'eggs', quantity: 2, expiresOnDay: MONDAY + 2 };

type Next = { placeId: PlaceId; npcId: TownNpcId; day?: number; inventory?: InventoryItem[] };

/** A store with the Character next to `npcId` at noon (on Monday unless told otherwise). The test speaks for the NPC. */
function nextTo({ placeId, npcId, day = MONDAY, inventory = [] }: Next) {
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
  const save = createSave(DEV_SETUP);
  const game: GameState = { ...save, clock: { day, minuteOfDay: 12 * HOUR }, possessions: { ...save.possessions, inventory } };
  const store = createGameStore(game, { openVoiceSession });
  store.getState().enterPlace(placeId);
  store.getState().setInteractable(npcId);
  return { store, npc };
}

/** Ends the conversation the test has just finished, as the Player would. */
function leave(store: ReturnType<typeof nextTo>['store']) {
  store.getState().leaveConversation();
  store.getState().skipRecap();
}

describe('returning a faulty item to the supermarket (#6)', () => {
  const atTheTill = (inventory: InventoryItem[] = [FRESH_EGGS]) => nextTo({ placeId: 'supermarket', npcId: 'cashier', inventory });

  it('offers R at the cashier while the Character has something bought there, with nothing to pay for', () => {
    expect(selectTalkWithR(atTheTill().store.getState())).toBe(INTERACTIONS.returnAnItem);
    expect(selectTalkWithR(atTheTill([]).store.getState())).toBeNull();
    expect(selectTalkWithR(atTheTill([{ itemId: 'chocolates', quantity: 1, expiresOnDay: null }]).store.getState())).toBeNull();

    const shopping = atTheTill().store;
    shopping.getState().setInteractable('eggs');
    shopping.getState().takeFromShelf();
    shopping.getState().setInteractable('cashier');
    expect(selectTalkWithR(shopping.getState())).toBeNull();
  });

  it('takes the item back and pays its price back', () => {
    const { store, npc } = atTheTill();
    const money = store.getState().game.character.moneyInShifts;

    store.getState().talk('R');
    expect(selectConversation(store.getState())?.interaction).toBe(INTERACTIONS.returnAnItem);
    npc.events!.onToolCall({ id: 'call-1', name: 'refund', args: { item: 'eggs', reason: 'cracked' } });

    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(store.getState().game.possessions.inventory).toEqual([{ ...FRESH_EGGS, quantity: 1 }]);
    expect(store.getState().game.character.moneyInShifts).toBeCloseTo(money + menuPrice('eggs', DEV_SETUP.culturePackId));
  });

  it('tells the cashier why something can’t be refunded, and the conversation goes on', () => {
    const { store, npc } = atTheTill();
    store.getState().talk('R');

    npc.events!.onToolCall({ id: 'call-1', name: 'refund', args: { item: 'noodles', reason: 'stale' } });

    expect(npc.answers).toEqual([{ result: 'invalid_arguments', error: expect.stringContaining(CULTURE_PACKS.ja.goods.noodles.name) }]);
    expect(selectConversation(store.getState())?.outcome).toBeNull();
  });
});

describe('the town office and post office (#23, #24)', () => {
  const atTheCounter = (day = MONDAY) => nextTo({ placeId: 'town-office', npcId: 'office-clerk', day });

  it('sends a parcel on E, registers an address on F, and chats on T', () => {
    const { store } = atTheCounter();
    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.sendAParcel);
    expect(selectTalkWithF(store.getState())).toBe(INTERACTIONS.registerAddress);
    expect(selectSmallTalkKey(store.getState())).toBe('T');
  });

  it('records the registered address in the game, after which F has nothing to offer', () => {
    const { store, npc } = atTheCounter();
    store.getState().talk('F');

    npc.events!.onToolCall({ id: 'call-1', name: 'register_resident', args: { fields: { name: 'Sam', address: 'さくら荘', nationality: 'Irish' } } });

    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(store.getState().game.possessions.addressRegistered).toBe(true);
    leave(store);
    expect(selectTalkWithF(store.getState())).toBeNull();
  });

  it('says the clerk misheard a name that isn’t the Character’s', () => {
    const { store, npc } = atTheCounter();
    store.getState().talk('F');

    npc.events!.onToolCall({ id: 'call-1', name: 'register_resident', args: { fields: { name: 'Tom', address: 'さくら荘', nationality: 'Irish' } } });

    expect(npc.answers).toEqual([{ result: 'wrong_name' }]);
    expect(store.getState().game.possessions.addressRegistered).toBe(false);
  });

  it('sends a parcel home for its postage', () => {
    const { store, npc } = atTheCounter();
    const money = store.getState().game.character.moneyInShifts;
    store.getState().talk('E');

    npc.events!.onToolCall({ id: 'call-1', name: 'ship', args: { destination: 'Ireland', speed: 'sea' } });

    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(store.getState().game.character.moneyInShifts).toBeLessThan(money);
  });

  it('is shut at the weekend', () => {
    const office = placeHours('town-office', DEV_SETUP.culturePackId) as Exclude<OpeningHours, null>;
    expect(office.closedOn).toContain('saturday');
    const { store } = atTheCounter(SATURDAY);
    store.getState().talk('E');
    expect(selectConversation(store.getState())).toBeNull();
  });
});

describe('asking a passer-by which tram goes to a place (#25)', () => {
  const atTheStop = () => nextTo({ placeId: 'tram-stop', npcId: 'passer-by-1' });

  it('asks the way on E, with no Small Talk: a passer-by is no one to chat with', () => {
    const { store } = atTheStop();
    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.askForDirections);
    expect(selectTalkWithF(store.getState())).toBeNull();
    expect(selectSmallTalkKey(store.getState())).toBeNull();
  });

  it('opens a passer-by’s session at the stop they wait at', () => {
    const { store, npc } = atTheStop();
    store.getState().talk('E');

    expect(selectConversation(store.getState())).toMatchObject({ npcId: 'passer-by-1', interaction: INTERACTIONS.askForDirections });
    expect(npc.session!.systemInstruction).toContain(`You are waiting at ${CULTURE_PACKS.ja.tramStops['west-stop'].name}`);
    expect(npc.session!.voice).toMatchObject({ shiftCustomerVoice: expect.any(Number) });
  });

  it('marks the stop to get off at, and leaves no memory of the Character', () => {
    const { store, npc } = atTheStop();
    store.getState().talk('E');

    npc.events!.onToolCall({ id: 'call-1', name: 'give_directions', args: { stop: 'east-stop' } });

    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(selectRouteMarker(store.getState())).toBe('east-stop');
    expect(store.getState().game.people).toEqual({});
  });

  it('takes the route marker away on arriving at its stop by tram', () => {
    const { store, npc } = atTheStop();
    store.getState().talk('E');
    npc.events!.onToolCall({ id: 'call-1', name: 'give_directions', args: { stop: 'central-stop' } });
    leave(store);

    store.getState().setInteractable('west-stop');
    store.getState().openTram();
    store.getState().rideTram('east-stop');
    expect(selectRouteMarker(store.getState())).toBe('central-stop');
    store.getState().setInteractable('east-stop');
    store.getState().openTram();
    store.getState().rideTram('central-stop');
    expect(selectRouteMarker(store.getState())).toBeNull();
  });

  it('takes the route marker away on reaching its platform, even on foot', () => {
    const { store, npc } = atTheStop();
    store.getState().talk('E');
    npc.events!.onToolCall({ id: 'call-1', name: 'give_directions', args: { stop: 'west-stop' } });
    leave(store);

    store.getState().setInteractable('west-stop');
    expect(selectRouteMarker(store.getState())).toBeNull();
  });

  it('ends the conversation when the Character walks away from the passer-by', () => {
    const { store } = atTheStop();
    store.getState().talk('E');
    store.getState().setInteractable(null);
    expect(selectConversation(store.getState())).toBeNull();
  });
});
