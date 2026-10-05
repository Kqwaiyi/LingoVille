import { describe, expect, it, vi } from 'vitest';
import type { NpcSession, Recap, RecapRequest, ToolResponse } from '../ai/index.ts';
import { SHIFT_TEMPLATES, type ItemId } from '../content/index.ts';
import { createSave, ECONOMY, hire, PROFICIENCY_STEP_TABLE, type GameState } from '../sim/index.ts';
import { VoiceServiceUnavailableError, type OpenVoiceSession, type VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEFAULT_DEVICE_SETTINGS,
  DEV_SETUP,
  JOURNAL_SCHEMA_VERSION,
  SAVE_SCHEMA_VERSION,
  type Journal,
  type NewJournalEntry,
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

/** Recaps the test answers: each request asked for, which arrives or fails when the test says. */
function fakeRecaps() {
  const asked: { request: RecapRequest; arrives: (recap: Recap) => void; fails: () => void }[] = [];
  const requestRecap = (request: RecapRequest) =>
    new Promise<Recap>((resolve, reject) => asked.push({ request, arrives: resolve, fails: () => reject(new Error('recap_unavailable')) }));
  return { asked, requestRecap };
}

/** A Journal that keeps what it's given in memory. */
function keptJournal() {
  const kept: NewJournalEntry[] = [];
  const journal: Journal = {
    append: async (_, entry) => (kept.push(entry), { ...entry, id: 'entry', writtenAt: '', schemaVersion: JOURNAL_SCHEMA_VERSION, noHelpNeeded: false }),
    list: async () => [],
    raw: async () => [],
    restore: async () => {},
    remove: async () => {},
  };
  return { kept, journal };
}

/** A hired barista at the staff door at 10:00 on day 3. */
function atTheStaffDoor(change: (game: GameState) => GameState = (game) => game) {
  const { saves, written } = recordingSaves();
  const customers = fakeCustomers();
  const recaps = fakeRecaps();
  const { kept, journal } = keptJournal();
  const game = hire(createSave(DEV_SETUP), 'barista');
  const store = createGameStore(change({ ...game, placeId: 'cafe', clock: { day: 3, minuteOfDay: 10 * 60 } }), {
    saves,
    openVoiceSession: customers.openVoiceSession,
    requestRecap: recaps.requestRecap,
    journal,
  });
  store.getState().setInteractable('staff-door');
  return { store, customers, written, recaps: recaps.asked, recapsAsked: () => recaps.asked.length, kept };
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
    expect(selectShiftEnd(store.getState())).toMatchObject({ jobId: 'barista', customers: count, served: count, payInShifts: ECONOMY.shiftBasePayInShifts });
    expect(store.getState().game.character.moneyInShifts).toBeCloseTo(money + ECONOMY.shiftBasePayInShifts);
    expect(written.at(-1)?.game.possessions.shift).toBeNull();
    expect(written.at(-1)?.game.character.moneyInShifts).toBeCloseTo(money + ECONOMY.shiftBasePayInShifts);

    store.getState().closeShiftEnd();
    expect(selectShiftEnd(store.getState())).toBeNull();
    expect(selectStaffDoor(store.getState())).toEqual({ jobId: 'barista', refusal: 'workedToday' });
  });
});

describe('a Shift and the connection', () => {
  it('replaces a Shift Customer lost to the network, who doesn’t count, saying they had to step away', () => {
    const { store, customers } = atTheStaffDoor();
    store.getState().startShift();
    customers.current().events.onDisconnect();
    // One retry, carrying on with the same customer, then a second drop loses them.
    expect(customers.opened).toHaveLength(2);
    customers.current().events.onDisconnect();

    expect(customers.opened).toHaveLength(3);
    expect(selectShift(store.getState())).toMatchObject({ done: 0 });
    expect(selectConversation(store.getState())).toMatchObject({ shiftCustomer: { tray: [] }, retried: false });
    expect(store.getState().toast).toEqual({ kind: 'npcSteppedAway', npcId: null });
  });
});

describe('the Shift Recap', () => {
  const RECAP: Recap = {
    outcome: 'Most customers got what they ordered.',
    corrections: [{ said: 'はい', natural: 'かしこまりました', why: 'Staff say this to customers.' }],
    newWords: [{ base: 'ください', reading: 'ください', gloss: 'please' }],
    cefrEstimate: 'A2',
  };

  /**
   * A whole Shift: the first customer says their order, the Player answers and serves it; the second is lost to the
   * network and replaced; the Player walks away from the next; and everyone after is served right.
   */
  function workAShift() {
    const shift = atTheStaffDoor();
    const { store, customers } = shift;
    store.getState().startShift();
    const count = store.getState().game.possessions.shift!.customers;
    const firstOrder = orderNow(store);
    customers.says('ラテをください。');
    store.getState().sendTypedLine('はい');
    serve(store, customers, firstOrder);
    customers.current().events.onDisconnect();
    customers.current().events.onDisconnect();
    const walkedAwayFrom = orderNow(store);
    customers.says('紅茶をひとつ。');
    store.getState().leaveConversation();
    while (store.getState().game.possessions.shift) serve(store, customers, orderNow(store));
    return { ...shift, count, firstOrder, walkedAwayFrom };
  }

  it('asks for one Recap over the whole Shift when it ends, with every customer dealt with but none lost to the network', () => {
    const { recaps, count, firstOrder, walkedAwayFrom } = workAShift();

    expect(recaps).toHaveLength(1);
    const { request } = recaps[0]!;
    expect(request).toMatchObject({ kind: 'shift', jobId: 'barista', culturePackId: 'ja', step: 'A1' });
    if (request.kind !== 'shift') throw new Error('not a Shift Recap');
    expect(request.customers).toHaveLength(count);
    expect(request.customers[0]).toEqual({
      order: firstOrder,
      result: 'served',
      served: firstOrder,
      transcript: [
        { speaker: 'npc', text: 'ラテをください。' },
        { speaker: 'player', text: 'はい', typed: true },
        { speaker: 'npc', text: 'ありがとう！' },
      ],
      helpLog: [],
    });
    expect(request.customers[1]).toEqual({
      order: walkedAwayFrom,
      result: 'walkedOut',
      served: [],
      transcript: [{ speaker: 'npc', text: '紅茶をひとつ。' }],
      helpLog: [],
    });
  });

  it('opens the combined Recap with the pay, and keeps it as one Journal entry', async () => {
    const { store, recaps, kept, count } = workAShift();
    expect(selectShiftEnd(store.getState())?.recap).toEqual({ status: 'writing' });

    recaps[0]!.arrives(RECAP);

    await vi.waitFor(() => expect(kept).toHaveLength(1));
    expect(selectShiftEnd(store.getState())?.recap).toMatchObject({
      status: 'ready',
      entry: { kind: 'shift', jobId: 'barista', recap: { outcome: RECAP.outcome, corrections: RECAP.corrections } },
    });
    expect(kept[0]).toMatchObject({ kind: 'shift', jobId: 'barista', customers: count, served: count - 1, recap: { outcome: RECAP.outcome } });
    expect(kept[0]!.lines.slice(0, 4)).toEqual([
      { speaker: 'npc', text: 'ラテをください。', customer: 1 },
      { speaker: 'player', text: 'はい', typed: true, customer: 1 },
      { speaker: 'npc', text: 'ありがとう！', customer: 1 },
      { speaker: 'npc', text: '紅茶をひとつ。', customer: 2 },
    ]);
  });

  it('counts the Shift’s results as Proficiency evidence once its Recap arrives, and saves it', async () => {
    const { store, recaps, written } = workAShift();
    const before = store.getState().game.progression;

    recaps[0]!.arrives(RECAP);

    await vi.waitFor(() => expect(store.getState().game.progression.evidenceSoFar).toBeGreaterThan(before.evidenceSoFar));
    expect(store.getState().game.progression.proficiencyScore).not.toBe(before.proficiencyScore);
    expect(written.at(-1)!.game.progression).toEqual(store.getState().game.progression);
  });

  it('still keeps a Recap that arrives after the card is closed, saying so when the card is closed', async () => {
    const { store, recaps, kept } = workAShift();
    const before = store.getState().game.progression;

    store.getState().closeShiftEnd();
    expect(store.getState().toast).toEqual({ kind: 'recapSaved' });
    recaps[0]!.arrives(RECAP);

    await vi.waitFor(() => expect(kept).toHaveLength(1));
    expect(selectShiftEnd(store.getState())).toBeNull();
    expect(store.getState().game.progression.evidenceSoFar).toBeGreaterThan(before.evidenceSoFar);
  });

  it('keeps the Shift in the Journal with no Recap if none could be written, and leaves Proficiency alone', async () => {
    const { store, recaps, kept } = workAShift();
    const before = store.getState().game.progression;

    recaps[0]!.fails();

    await vi.waitFor(() => expect(kept).toHaveLength(1));
    expect(kept[0]).toMatchObject({ kind: 'shift', recap: null });
    expect(selectShiftEnd(store.getState())?.recap).toEqual({ status: 'failed' });
    expect(store.getState().game.progression).toEqual(before);
  });
});

describe('docks at the end of a Shift', () => {
  /** Reached B1, where each failed customer is docked. */
  const atB1 = (game: GameState): GameState => ({ ...game, proficiencyStep: 'B1', progression: { ...game.progression, highestStep: 'B1' } });
  const { stakeMultiplier, failedCustomerDock } = PROFICIENCY_STEP_TABLE.B1;
  const base = ECONOMY.shiftBasePayInShifts;

  /** Serves every customer still to come their order. */
  function serveTheRest(store: ReturnType<typeof createGameStore>, customers: ReturnType<typeof fakeCustomers>) {
    while (store.getState().game.possessions.shift) serve(store, customers, orderNow(store));
  }

  it('docks a customer the Player walked away from as a failure', () => {
    const { store, customers } = atTheStaffDoor(atB1);
    store.getState().startShift();
    const count = store.getState().game.possessions.shift!.customers;
    store.getState().leaveConversation();
    serveTheRest(store, customers);

    // 1.25 × base × (n − 1)/n, less one B1 dock (0.05 of base).
    expect(failedCustomerDock).toBeGreaterThan(0);
    expect(selectShiftEnd(store.getState())!.payInShifts).toBeCloseTo(base * ((count - 1) / count) * stakeMultiplier - failedCustomerDock * base);
  });

  it('doesn’t dock a customer lost to the network, who is replaced', () => {
    const { store, customers } = atTheStaffDoor(atB1);
    store.getState().startShift();
    const count = store.getState().game.possessions.shift!.customers;
    customers.current().events.onDisconnect();
    customers.current().events.onDisconnect();
    serveTheRest(store, customers);

    expect(selectShiftEnd(store.getState())).toMatchObject({ customers: count, served: count });
    expect(selectShiftEnd(store.getState())!.payInShifts).toBeCloseTo(base * stakeMultiplier);
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
    // The conversations aren't saved, so there's nothing to write a Recap from.
    expect(selectShiftEnd(reloaded.getState())?.recap).toBeNull();
    expect(reloaded.getState().game.character.moneyInShifts).toBeCloseTo(savedMidShift.character.moneyInShifts + ECONOMY.shiftBasePayInShifts / count);
  });
});
