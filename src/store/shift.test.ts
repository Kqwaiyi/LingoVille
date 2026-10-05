import { describe, expect, it, vi } from 'vitest';
import type { NpcSession, ToolResponse } from '../ai/index.ts';
import { SHIFT_TEMPLATES, type ItemId } from '../content/index.ts';
import { createSave, ECONOMY, hire, type GameState } from '../sim/index.ts';
import { VoiceServiceUnavailableError, type OpenVoiceSession, type VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEFAULT_DEVICE_SETTINGS,
  DEV_SETUP,
  SAVE_SCHEMA_VERSION,
  selectClosingCard,
  selectConversation,
  selectShift,
  selectShiftEnd,
  selectStaffDoor,
  selectTray,
} from './index.ts';
import { recordingSaves } from './testSaves.ts';

/** Stand-ins for each Shift Customer the test speaks for: the sessions opened, in order, and what each was sent. */
function fakeCustomers() {
  const opened: { session: NpcSession; events: VoiceSessionEvents; sent: string[]; answers: ToolResponse[]; closed: boolean }[] = [];
  const openVoiceSession: OpenVoiceSession = (session, events) => {
    const customer = { session, events, sent: [] as string[], answers: [] as ToolResponse[], closed: false };
    opened.push(customer);
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: (text) => void customer.sent.push(text),
      sendToolResponse: (_, response) => void customer.answers.push(response),
      close: () => void (customer.closed = true),
    };
  };
  const current = () => opened.at(-1)!;
  return {
    opened,
    current,
    says(text: string) {
      current().events.onOutputTranscript(text);
      current().events.onTurnComplete();
    },
    notUnderstood() {
      current().events.onToolCall({ id: `call-${current().answers.length}`, name: 'not_understood', args: { reason: 'unintelligible' } });
    },
    openVoiceSession,
  };
}

/** A hired barista at the staff door at 10:00 on day 3. */
function atTheStaffDoor(change: (game: GameState) => GameState = (game) => game) {
  const { saves, written } = recordingSaves();
  const customers = fakeCustomers();
  let recapsAsked = 0;
  const game = hire(createSave(DEV_SETUP), 'barista');
  const store = createGameStore(change({ ...game, placeId: 'cafe', clock: { day: 3, minuteOfDay: 10 * 60 } }), {
    saves,
    openVoiceSession: customers.openVoiceSession,
    requestRecap: () => {
      recapsAsked++;
      return new Promise(() => {});
    },
  });
  store.getState().setInteractable('staff-door');
  return { store, customers, written, recapsAsked: () => recapsAsked };
}

/** The hidden order of the customer at the counter, as the sim holds it. */
const orderNow = (store: ReturnType<typeof createGameStore>) => store.getState().game.possessions.shift!.customer!.order;

/** Taps the menu grid for the order, serves it, and lets the customer say goodbye. */
function serve(store: ReturnType<typeof createGameStore>, customers: ReturnType<typeof fakeCustomers>, items: readonly { itemId: ItemId; quantity: number }[]) {
  for (const { itemId, quantity } of items) for (let i = 0; i < quantity; i++) store.getState().tapMenuItem(itemId);
  store.getState().serveTray();
  customers.says('ありがとう！');
}

const wrongDrinkFor = (itemId: ItemId) => SHIFT_TEMPLATES.barista.drinks.find((drink) => drink !== itemId)!;

describe('the staff door', () => {
  it('starts a Shift with E during opening hours: a Shift Customer walks up and speaks first', () => {
    const { store, customers } = atTheStaffDoor();
    expect(selectStaffDoor(store.getState())).toEqual({ jobId: 'barista', refusal: null });

    store.getState().startShift();

    expect(selectShift(store.getState())).toMatchObject({ jobId: 'barista', done: 0 });
    expect(selectConversation(store.getState())).toMatchObject({ shiftCustomer: { tray: [] } });
    const { session } = customers.current();
    expect(session.voice).toEqual({ targetLanguage: 'ja', shiftCustomerVoice: store.getState().game.possessions.shift!.customer!.voiceSeed });
    expect(session.openingScene).toMatch(/walk up to the counter/);
    expect(session.systemInstruction).toContain('YOUR ORDER');
  });

  it('says why it can’t start a Shift: not hired, closed, or already worked today', () => {
    const notHired = atTheStaffDoor((game) => ({ ...game, possessions: { ...game.possessions, jobsHired: [] } }));
    expect(selectStaffDoor(notHired.store.getState())).toEqual({ jobId: 'barista', refusal: 'notHired' });
    notHired.store.getState().startShift();
    expect(selectShift(notHired.store.getState())).toBeNull();
    expect(notHired.customers.opened).toEqual([]);

    const closed = atTheStaffDoor((game) => ({ ...game, clock: { day: 3, minuteOfDay: 21 * 60 } }));
    expect(selectStaffDoor(closed.store.getState())).toEqual({ jobId: 'barista', refusal: 'closed' });

    const worked = atTheStaffDoor((game) => ({ ...game, progression: { ...game.progression, lastShiftDay: 3 } }));
    expect(selectStaffDoor(worked.store.getState())).toEqual({ jobId: 'barista', refusal: 'workedToday' });
    worked.store.getState().startShift();
    expect(selectShift(worked.store.getState())).toBeNull();
  });

  it('is only the staff door’s: elsewhere there is nothing to start', () => {
    const { store, customers } = atTheStaffDoor();
    store.getState().setInteractable('barista');
    expect(selectStaffDoor(store.getState())).toBeNull();
    store.getState().startShift();
    expect(customers.opened).toEqual([]);
  });
});

describe('serving Shift Customers', () => {
  it('checks what was served exactly, tells the customer, and the next one walks up after their goodbye', () => {
    const { store, customers } = atTheStaffDoor();
    store.getState().startShift();
    const order = orderNow(store);
    for (const { itemId } of order) store.getState().tapMenuItem(itemId);
    expect(selectTray(store.getState())).toEqual(order);

    store.getState().serveTray();

    expect(selectShift(store.getState())).toMatchObject({ done: 1, served: 1 });
    expect(customers.current().sent.at(-1)).toMatch(/That is what you ordered/);
    expect(customers.opened).toHaveLength(1);

    customers.says('ありがとう！');

    expect(customers.opened[0]!.closed).toBe(true);
    expect(customers.opened).toHaveLength(2);
    expect(selectConversation(store.getState())).toMatchObject({ shiftCustomer: { tray: [] }, outcome: null, lines: [] });
  });

  it('fails a wrong drink, and the customer is told it is not what they ordered', () => {
    const { store, customers } = atTheStaffDoor();
    store.getState().startShift();
    serve(store, customers, [{ itemId: wrongDrinkFor(orderNow(store)[0]!.itemId), quantity: 1 }]);

    expect(customers.opened[0]!.sent.at(-1)).toMatch(/That is not what you ordered/);
    expect(selectShift(store.getState())).toMatchObject({ done: 1, served: 0 });
  });

  it('can clear the tray before serving', () => {
    const { store } = atTheStaffDoor();
    store.getState().startShift();
    store.getState().tapMenuItem(wrongDrinkFor(orderNow(store)[0]!.itemId));
    store.getState().clearTray();
    expect(selectTray(store.getState())).toEqual([]);
  });

  it('lets the Player ask a customer to repeat or clarify, with Patience as usual: running out fails them', () => {
    const { store, customers } = atTheStaffDoor();
    store.getState().startShift();
    store.getState().sendTypedLine('もう一度お願いします');
    expect(customers.current().sent).toContain('もう一度お願いします');

    for (let turn = 0; turn < 10 && customers.opened.length === 1; turn++) {
      if (!selectConversation(store.getState())?.outcome) {
        store.getState().sendTypedLine('あの…');
        customers.notUnderstood();
      } else customers.says('すみません、また今度。');
    }

    expect(customers.opened[0]!.answers.at(-1)).toEqual({ result: 'out_of_patience' });
    expect(selectShift(store.getState())).toMatchObject({ done: 1, served: 0 });
    expect(customers.opened).toHaveLength(2);
  });

  it('fails a customer the Player leaves, and the next one walks up', () => {
    const { store, customers } = atTheStaffDoor();
    store.getState().startShift();
    store.getState().leaveConversation();

    expect(selectShift(store.getState())).toMatchObject({ done: 1, served: 0 });
    expect(customers.opened).toHaveLength(2);
  });

  it('opens no Recap between customers, asks for none, shows no closing card and leaves Proficiency alone', () => {
    const { store, customers, recapsAsked } = atTheStaffDoor();
    const before = store.getState().game.progression;
    store.getState().startShift();
    serve(store, customers, orderNow(store));

    expect(selectClosingCard(store.getState())).toBeNull();
    expect(selectConversation(store.getState())?.recap).toBeNull();
    expect(recapsAsked()).toBe(0);
    const after = store.getState().game.progression;
    expect([after.proficiencyScore, after.evidenceSoFar]).toEqual([before.proficiencyScore, before.evidenceSoFar]);
  });

  it('keeps the Shift going past closing time', () => {
    const { store, customers } = atTheStaffDoor((game) => ({ ...game, clock: { day: 3, minuteOfDay: 19 * 60 - 1 } }));
    store.getState().startShift();
    for (let frame = 0; frame < 40; frame++) store.getState().advance(250);
    expect(store.getState().game.clock.minuteOfDay).toBeGreaterThan(19 * 60);

    serve(store, customers, orderNow(store));

    expect(customers.opened).toHaveLength(2);
    expect(selectShift(store.getState())).toMatchObject({ done: 1, served: 1 });
  });
});

describe('the end of a Shift', () => {
  it('after the last customer, pays, shows the pay and saves', () => {
    const { store, customers, written } = atTheStaffDoor();
    store.getState().startShift();
    const count = store.getState().game.possessions.shift!.customers;
    const money = store.getState().game.character.moneyInShifts;
    for (let i = 0; i < count; i++) serve(store, customers, orderNow(store));

    expect(customers.opened).toHaveLength(count);
    expect(selectConversation(store.getState())).toBeNull();
    expect(selectShift(store.getState())).toBeNull();
    // Every customer served at A1 and neutral Mood: one Shift's base pay.
    expect(selectShiftEnd(store.getState())).toEqual({ jobId: 'barista', customers: count, served: count, payInShifts: ECONOMY.shiftBasePayInShifts });
    expect(store.getState().game.character.moneyInShifts).toBeCloseTo(money + ECONOMY.shiftBasePayInShifts);
    expect(written.at(-1)?.game.possessions.shift).toBeNull();
    expect(written.at(-1)?.game.character.moneyInShifts).toBeCloseTo(money + ECONOMY.shiftBasePayInShifts);

    store.getState().closeShiftEnd();
    expect(selectShiftEnd(store.getState())).toBeNull();
    expect(selectStaffDoor(store.getState())).toEqual({ jobId: 'barista', refusal: 'workedToday' });
  });
});

describe('a Shift and the connection', () => {
  it('replaces a Shift Customer lost to the network, who doesn’t count', () => {
    const { store, customers } = atTheStaffDoor();
    store.getState().startShift();
    customers.current().events.onDisconnect();
    // One retry, carrying on with the same customer, then a second drop loses them.
    expect(customers.opened).toHaveLength(2);
    customers.current().events.onDisconnect();

    expect(customers.opened).toHaveLength(3);
    expect(selectShift(store.getState())).toMatchObject({ done: 0 });
    expect(selectConversation(store.getState())).toMatchObject({ shiftCustomer: { tray: [] }, retried: false });
  });
});

describe('a Shift with no voice service at all', () => {
  /** At the staff door, where no token can be minted for a customer while `voice.down` is set. */
  function withVoiceThatFails() {
    const voice = { down: true };
    const { saves } = recordingSaves();
    const customers = fakeCustomers();
    const game = hire(createSave(DEV_SETUP), 'barista');
    const store = createGameStore({ ...game, placeId: 'cafe', clock: { day: 3, minuteOfDay: 10 * 60 } }, {
      saves,
      openVoiceSession: (session, events, options) => {
        const opened = customers.openVoiceSession(session, events, options);
        return { ...opened, connect: async () => (voice.down ? Promise.reject(new VoiceServiceUnavailableError('test')) : undefined) };
      },
      requestRecap: () => new Promise(() => {}),
    });
    store.getState().setInteractable('staff-door');
    return { store, customers, voice };
  }

  it('gives the day’s Shift back if the first customer can’t be reached', async () => {
    const { store } = withVoiceThatFails();
    store.getState().startShift();
    await vi.waitFor(() => expect(store.getState().voiceUnavailable).toBe(true));

    expect(selectShift(store.getState())).toBeNull();
    expect(selectShiftEnd(store.getState())).toBeNull();
    expect(selectStaffDoor(store.getState())).toEqual({ jobId: 'barista', refusal: null });
  });

  it('ends the Shift, paid for those served, if a later customer can’t be reached', async () => {
    const { store, customers, voice } = withVoiceThatFails();
    voice.down = false;
    store.getState().startShift();
    voice.down = true;
    serve(store, customers, orderNow(store));
    await vi.waitFor(() => expect(store.getState().voiceUnavailable).toBe(true));

    expect(selectShift(store.getState())).toBeNull();
    expect(selectShiftEnd(store.getState())).toMatchObject({ served: 1 });
    expect(selectStaffDoor(store.getState())).toEqual({ jobId: 'barista', refusal: 'workedToday' });
  });
});

describe('a Shift and the save', () => {
  it('saves after each customer, and a reload ends the Shift with pay for the customers already served', async () => {
    const { store, customers, written } = atTheStaffDoor();
    store.getState().startShift();
    serve(store, customers, orderNow(store));
    const savedMidShift = written.at(-1)!.game;
    expect(savedMidShift.possessions.shift).toMatchObject({ served: 1, failed: 0 });

    const reloaded = createGameStore(null, {
      saves: {
        ...recordingSaves().saves,
        slots: async () => [
          {
            slotId: 'slot-1',
            status: 'ready',
            save: { schemaVersion: SAVE_SCHEMA_VERSION, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: savedMidShift },
            lastPlayedAt: '',
            fromBackup: false,
          },
          ...(['slot-2', 'slot-3', 'slot-4'] as const).map((slotId) => ({ slotId, status: 'empty' as const })),
        ],
      },
      deviceSettings: { load: async () => DEFAULT_DEVICE_SETTINGS, save: async () => {}, update: async () => {} },
      storage: { persisted: async () => true, persist: async () => true },
    });
    reloaded.getState().openTitle();
    await vi.waitFor(() => expect(reloaded.getState().title?.status).toBe('ready'));
    reloaded.getState().continueGame();

    const { customers: count } = savedMidShift.possessions.shift!;
    expect(selectShift(reloaded.getState())).toBeNull();
    expect(selectConversation(reloaded.getState())).toBeNull();
    // One customer of `count` served, at A1 (no dock) and neutral Mood.
    expect(selectShiftEnd(reloaded.getState())).toMatchObject({ served: 1, customers: count, payInShifts: ECONOMY.shiftBasePayInShifts / count });
    expect(reloaded.getState().game.character.moneyInShifts).toBeCloseTo(savedMidShift.character.moneyInShifts + ECONOMY.shiftBasePayInShifts / count);
  });
});
