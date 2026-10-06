import { describe, expect, it } from 'vitest';
import { readTable, type NpcSession, type Recap, type RecapRequest, type ToolResponse } from '../ai/index.ts';
import { ECONOMY, createSave, hire, LIFE_SKILLS, type GameState, type PadDiner, type ShiftCustomer } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  selectCanServe,
  selectOrderPad,
  selectQuickPickNotes,
  selectShift,
  selectStaffDoor,
  selectTray,
} from './index.ts';
import { recordingSaves } from './testSaves.ts';

/** Stand-ins for each Shift Customer the test speaks for: the sessions opened, in order, and what each was sent. */
function fakeCustomers() {
  const opened: { session: NpcSession; events: VoiceSessionEvents; sent: string[]; answers: ToolResponse[] }[] = [];
  const openVoiceSession: OpenVoiceSession = (session, events) => {
    const customer = { session, events, sent: [] as string[], answers: [] as ToolResponse[] };
    opened.push(customer);
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: (text) => void customer.sent.push(text),
      sendToolResponse: (_, response) => void customer.answers.push(response),
      close: () => {},
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
    openVoiceSession,
  };
}

/** A hired server at the restaurant staff door at 12:00 on day 3 (a Wednesday), in the ja pack. */
function atTheStaffDoor(change: (game: GameState) => GameState = (game) => game) {
  const { saves } = recordingSaves();
  const customers = fakeCustomers();
  const recaps: RecapRequest[] = [];
  const requestRecap = (request: RecapRequest) => (recaps.push(request), new Promise<Recap>(() => {}));
  const game = hire(createSave(DEV_SETUP), 'server');
  const store = createGameStore(change({ ...game, placeId: 'restaurant', clock: { day: 3, minuteOfDay: 12 * 60 } }), {
    saves,
    openVoiceSession: customers.openVoiceSession,
    requestRecap,
  });
  store.getState().setInteractable('staff-door');
  return { store, customers, recaps };
}

type Store = ReturnType<typeof createGameStore>;

/** The customer at the table, as the sim holds them. */
const customerNow = (store: Store) => store.getState().game.possessions.shift!.customer!;

/** The customer at the table is this one instead, as if they'd been drawn. */
function customerIs(store: Store, customer: Partial<ShiftCustomer>) {
  const { game } = store.getState();
  const shift = game.possessions.shift!;
  store.setState({ game: { ...game, possessions: { ...game.possessions, shift: { ...shift, customer: { ...shift.customer!, ...customer } } } } });
}

/** A table of two: the first diner wants pork and a cola, the second (who is vegetarian) the curry and a juice. */
const TABLE_OF_TWO: Partial<ShiftCustomer> = {
  templateId: 'server-table-dietary',
  order: [
    { itemId: 'pork-dish', quantity: 1 },
    { itemId: 'cola', quantity: 1 },
    { itemId: 'veggie-dish', quantity: 1 },
    { itemId: 'juice', quantity: 1 },
  ],
  changedFrom: null,
  checkout: null,
  table: [
    { dish: 'pork-dish', drink: 'cola', note: null },
    { dish: 'veggie-dish', drink: 'juice', note: 'vegetarian' },
  ],
};

/** Writes each diner on the order pad: a new line for each after the first, then their dish, drink and note. */
function writeDown(store: Store, diners: readonly PadDiner[]) {
  diners.forEach(({ dish, drink, note }, i) => {
    if (i > 0) store.getState().addPadDiner();
    if (dish) store.getState().tapMenuItem(dish);
    if (drink) store.getState().tapMenuItem(drink);
    if (note) store.getState().setDietaryNote(note);
  });
}

/** Writes the table exactly as it wants and sends the order to the kitchen. */
function takeOrderRightly(store: Store) {
  writeDown(store, customerNow(store).table!);
  store.getState().serveTray();
}

describe('a server Shift', () => {
  it('starts with E at the restaurant staff door: a diner sits down at a table and speaks first', () => {
    const { store, customers } = atTheStaffDoor();
    expect(selectStaffDoor(store.getState())).toEqual({ jobId: 'server', refusal: null });

    store.getState().startShift();

    expect(selectShift(store.getState())).toMatchObject({ jobId: 'server', done: 0 });
    const { session } = customers.current();
    expect(session.openingScene).toMatch(/sat down at a table/);
    expect(readTable(session.systemInstruction)).not.toBeNull();
    expect(customerNow(store).table).not.toBeNull();
  });

  it('starts the order pad with one empty diner line, and nothing to send', () => {
    const { store } = atTheStaffDoor();
    store.getState().startShift();

    expect(selectOrderPad(store.getState())).toEqual({ diners: [{ dish: null, drink: null, note: null }], at: 0 });
    expect(selectCanServe(store.getState())).toBe(false);
  });

  it('writes a dish and a drink on the diner line being written, a second tap of either replacing the first', () => {
    const { store } = atTheStaffDoor();
    store.getState().startShift();
    for (const itemId of ['fish-dish', 'cola', 'pork-dish', 'juice'] as const) store.getState().tapMenuItem(itemId);

    expect(selectOrderPad(store.getState()).diners).toEqual([{ dish: 'pork-dish', drink: 'juice', note: null }]);
    expect(selectCanServe(store.getState())).toBe(true);
    // Nothing goes on the barista's tray.
    expect(selectTray(store.getState())).toEqual([]);
  });

  it("adds diner lines up to the biggest table, picks which is written, and takes one off, keeping the others' orders", () => {
    const { store } = atTheStaffDoor();
    store.getState().startShift();
    store.getState().tapMenuItem('fish-dish');
    for (let i = 0; i < ECONOMY.tableDiners.max + 1; i++) store.getState().addPadDiner();
    expect(selectOrderPad(store.getState()).diners).toHaveLength(ECONOMY.tableDiners.max);
    expect(selectOrderPad(store.getState()).at).toBe(ECONOMY.tableDiners.max - 1);

    store.getState().tapMenuItem('cola');
    store.getState().choosePadDiner(0);
    store.getState().tapMenuItem('juice');
    expect(selectOrderPad(store.getState()).diners[0]).toEqual({ dish: 'fish-dish', drink: 'juice', note: null });

    store.getState().choosePadDiner(1);
    store.getState().removePadDiner();
    expect(selectOrderPad(store.getState()).diners).toEqual([
      { dish: 'fish-dish', drink: 'juice', note: null },
      { dish: null, drink: 'cola', note: null },
    ]);
  });

  it('never takes the last diner line off, and Clear starts the pad again', () => {
    const { store } = atTheStaffDoor();
    store.getState().startShift();
    store.getState().tapMenuItem('fish-dish');
    store.getState().removePadDiner();
    expect(selectOrderPad(store.getState()).diners).toHaveLength(1);

    store.getState().addPadDiner();
    store.getState().clearTray();
    expect(selectOrderPad(store.getState())).toEqual({ diners: [{ dish: null, drink: null, note: null }], at: 0 });
  });

  it('notes a dietary need on the diner line being written, and takes it off again', () => {
    const { store } = atTheStaffDoor();
    store.getState().startShift();
    store.getState().setDietaryNote('no-pork');
    expect(selectOrderPad(store.getState()).diners[0]!.note).toBe('no-pork');
    store.getState().setDietaryNote(null);
    expect(selectOrderPad(store.getState()).diners[0]!.note).toBeNull();
  });

  it("serves a table whose every diner's order and need is on the pad, telling them what was written", () => {
    const { store, customers } = atTheStaffDoor();
    store.getState().startShift();
    customerIs(store, TABLE_OF_TWO);

    takeOrderRightly(store);

    expect(selectShift(store.getState())).toMatchObject({ done: 1, served: 1 });
    expect(customers.current().sent.at(-1)).toMatch(/野菜のトマトパスタ and オレンジジュース, noted ベジタリアン.*That is all just as you wanted/);
    customers.says('ありがとう！');
    expect(customers.opened).toHaveLength(2);
    expect(selectOrderPad(store.getState())).toEqual({ diners: [{ dish: null, drink: null, note: null }], at: 0 });
  });

  it('fails a table with the need missed or on the wrong diner, a drink missed, or a diner left off', () => {
    const [meat, veggie] = TABLE_OF_TWO.table!;
    const wrongs: PadDiner[][] = [
      [meat!, { ...veggie!, note: null }],
      [{ ...meat!, note: 'vegetarian' }, { ...veggie!, note: null }],
      [meat!, { ...veggie!, drink: null }],
      [veggie!],
    ];
    for (const written of wrongs) {
      const { store, customers } = atTheStaffDoor();
      store.getState().startShift();
      customerIs(store, TABLE_OF_TWO);
      writeDown(store, written);
      store.getState().serveTray();

      expect(selectShift(store.getState())).toMatchObject({ done: 1, served: 0 });
      expect(customers.current().sent.at(-1)).toMatch(/That is not all as you wanted/);
    }
  });

  it('works a whole Shift and tells the Recap what each table wanted and what the server wrote down', () => {
    const { store, customers, recaps } = atTheStaffDoor();
    store.getState().startShift();
    customerIs(store, TABLE_OF_TWO);
    takeOrderRightly(store);
    customers.says('ありがとう！');
    while (store.getState().game.possessions.shift) {
      takeOrderRightly(store);
      customers.says('ありがとう！');
    }

    const request = recaps[0]!;
    if (request.kind !== 'shift') throw new Error('not a Shift Recap');
    expect(request.jobId).toBe('server');
    expect(request.customers[0]).toMatchObject({ order: TABLE_OF_TWO.order, table: TABLE_OF_TWO.table, result: 'served', atTheTable: TABLE_OF_TWO.table });
    expect(store.getState().game.progression.lifeSkillXp.server).toBeGreaterThan(0);
  });
});

describe('the Server skill’s quick-pick dietary notes', () => {
  /** A server whose skill has reached the level that offers quick-pick notes, or just short of it. */
  const serverAt = (reached: boolean) => (game: GameState): GameState => ({
    ...game,
    progression: {
      ...game.progression,
      lifeSkillXp: { ...game.progression.lifeSkillXp, server: LIFE_SKILLS.xpToReachLevel[LIFE_SKILLS.jobAidsFromLevel.server.quickPickNotes - (reached ? 0 : 1)]! },
    },
  });

  it('are offered from the level that unlocks them, and not before', () => {
    const before = atTheStaffDoor(serverAt(false));
    before.store.getState().startShift();
    expect(selectQuickPickNotes(before.store.getState())).toBe(false);

    const after = atTheStaffDoor(serverAt(true));
    after.store.getState().startShift();
    expect(selectQuickPickNotes(after.store.getState())).toBe(true);
  });
});
