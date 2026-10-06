import { describe, expect, it } from 'vitest';
import { readCheckout, type NpcSession, type Recap, type RecapRequest, type ToolResponse } from '../ai/index.ts';
import { BEHIND_THE_COUNTER, tillFor, type ItemId } from '../content/index.ts';
import { createSave, hire, LIFE_SKILLS, type GameState, type ShiftCustomer } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  selectCanSuggestChange,
  selectCheckoutCounter,
  selectConversation,
  selectShift,
  selectStaffDoor,
  selectTill,
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
    openVoiceSession,
  };
}

/** A hired cashier at the supermarket staff door at 10:00 on day 3, in the ja pack. */
function atTheStaffDoor(change: (game: GameState) => GameState = (game) => game) {
  const { saves, written } = recordingSaves();
  const customers = fakeCustomers();
  const recaps: RecapRequest[] = [];
  const requestRecap = (request: RecapRequest) => (recaps.push(request), new Promise<Recap>(() => {}));
  const game = hire(createSave(DEV_SETUP), 'cashier');
  const store = createGameStore(change({ ...game, placeId: 'supermarket', clock: { day: 3, minuteOfDay: 10 * 60 } }), {
    saves,
    openVoiceSession: customers.openVoiceSession,
    requestRecap,
  });
  store.getState().setInteractable('staff-door');
  return { store, customers, written, recaps };
}

type Store = ReturnType<typeof createGameStore>;
const YEN = tillFor('ja');

/** The customer at the till, as the sim holds them. */
const customerNow = (store: Store) => store.getState().game.possessions.shift!.customer!;

/** The customer at the till is this one instead, as if they'd been drawn. */
function customerIs(store: Store, customer: Partial<ShiftCustomer>) {
  const { game } = store.getState();
  const shift = game.possessions.shift!;
  store.setState({ game: { ...game, possessions: { ...game.possessions, shift: { ...shift, customer: { ...shift.customer!, ...customer } } } } });
}

/** Eggs ×2 and stamps from behind the counter (¥360 × 2 + ¥120 = ¥840), a bag, no points card, paying ¥1,000: ¥160 change. */
const PAYS_CASH: Partial<ShiftCustomer> = {
  templateId: 'cashier-pays-cash',
  order: [{ itemId: 'eggs', quantity: 2 }, { itemId: 'stamps', quantity: 1 }],
  changedFrom: null,
  checkout: { bag: true, pointsCard: false, fromBehindTheCounter: 'stamps', cashHanded: 1000, changeDue: 160 },
};

/** Scans or fetches each item, as often as it's wanted. */
function ringUp(store: Store, items: readonly { itemId: ItemId; quantity: number }[]) {
  for (const { itemId, quantity } of items) for (let i = 0; i < quantity; i++) store.getState().tapMenuItem(itemId);
}

/** Does everything at the till the customer at the till wants, exactly, and finishes the sale. */
function checkOutRightly(store: Store) {
  const { order, checkout } = customerNow(store);
  ringUp(store, order);
  if (checkout!.bag) store.getState().toggleBag();
  if (checkout!.pointsCard) store.getState().togglePointsCard();
  for (const coin of checkout!.changeDue ? [...YEN.denominations].reverse().flatMap(coinsFor(checkout!.changeDue)) : []) store.getState().addChangeCoin(coin);
  store.getState().serveTray();
}

/** Counts `amount` out greedily, a coin at a time: the test's own sum, not the Cashier skill's. */
const coinsFor = (amount: number) => {
  let left = amount;
  return (coin: number) => {
    const n = Math.floor(left / coin + 1e-9);
    left -= n * coin;
    return Array<number>(n).fill(coin);
  };
};

describe('a cashier Shift', () => {
  it('starts with E at the supermarket staff door: a customer walks up to the till with their shopping and speaks first', () => {
    const { store, customers } = atTheStaffDoor();
    expect(selectStaffDoor(store.getState())).toEqual({ jobId: 'cashier', refusal: null });

    store.getState().startShift();

    expect(selectShift(store.getState())).toMatchObject({ jobId: 'cashier', done: 0 });
    const { session } = customers.current();
    expect(session.openingScene).toMatch(/walk up to the till/);
    expect(readCheckout(session.systemInstruction)).not.toBeNull();
    expect(customerNow(store).checkout).not.toBeNull();
  });

  it('shows the shopping on the counter, but not what the customer wants from behind it', () => {
    const { store } = atTheStaffDoor();
    store.getState().startShift();
    customerIs(store, PAYS_CASH);

    expect(selectCheckoutCounter(store.getState())).toEqual([{ itemId: 'eggs', quantity: 2 }]);
  });

  it('scans the shopping and fetches from behind the counter onto the till, which shows the total in local money', () => {
    const { store } = atTheStaffDoor();
    store.getState().startShift();
    customerIs(store, PAYS_CASH);

    ringUp(store, PAYS_CASH.order!);

    expect(selectTray(store.getState())).toEqual(PAYS_CASH.order);
    expect(selectTill(store.getState())).toMatchObject({ total: 840, bag: false, pointsCard: false, change: [], changeGiven: 0 });
  });

  it('toggles the bag and the points card, and counts change out of the pack’s coins and notes, refusing any other', () => {
    const { store } = atTheStaffDoor();
    store.getState().startShift();
    store.getState().toggleBag();
    store.getState().togglePointsCard();
    store.getState().togglePointsCard();
    for (const coin of [100, 50, 10, 3]) store.getState().addChangeCoin(coin);

    expect(selectTill(store.getState())).toMatchObject({ bag: true, pointsCard: false, change: [100, 50, 10], changeGiven: 160 });

    store.getState().clearChange();
    expect(selectTill(store.getState())).toMatchObject({ change: [], changeGiven: 0 });
  });

  it('works out the change due from the cash the Player keys in as handed over', () => {
    const { store } = atTheStaffDoor();
    store.getState().startShift();
    customerIs(store, PAYS_CASH);
    ringUp(store, PAYS_CASH.order!);

    expect(selectTill(store.getState()).changeDue).toBeNull();
    store.getState().setCashReceived(1000);
    expect(selectTill(store.getState())).toMatchObject({ received: 1000, changeDue: 160 });
    // Keyed in wrong, the till works out the wrong change: it only knows what it was told.
    store.getState().setCashReceived(2000);
    expect(selectTill(store.getState()).changeDue).toBe(1160);
  });

  it('serves a customer whose items, bag, points card and change are exactly right, telling them what was done', () => {
    const { store, customers } = atTheStaffDoor();
    store.getState().startShift();
    customerIs(store, PAYS_CASH);

    checkOutRightly(store);

    expect(selectShift(store.getState())).toMatchObject({ done: 1, served: 1 });
    expect(customers.current().sent.at(-1)).toMatch(/puts your shopping in a bag.*¥160 in change.*That is all just as you wanted/);
    customers.says('ありがとう！');
    expect(customers.opened).toHaveLength(2);
    expect(selectTill(store.getState())).toMatchObject({ bag: false, pointsCard: false, received: null, change: [] });
  });

  it('fails a customer given the wrong change, the wrong bag or points card, or without what they asked for from behind the counter', () => {
    const wrongs: ((store: Store) => void)[] = [
      (store) => store.getState().addChangeCoin(10),
      (store) => store.getState().toggleBag(),
      (store) => store.getState().togglePointsCard(),
      (store) => store.getState().undoTray(),
    ];
    for (const wrong of wrongs) {
      const { store, customers } = atTheStaffDoor();
      store.getState().startShift();
      customerIs(store, PAYS_CASH);
      ringUp(store, PAYS_CASH.order!);
      store.getState().toggleBag();
      for (const coin of [100, 50, 10]) store.getState().addChangeCoin(coin);
      wrong(store);
      store.getState().serveTray();

      expect(selectShift(store.getState())).toMatchObject({ done: 1, served: 0 });
      expect(customers.current().sent.at(-1)).toMatch(/That is not all as you wanted/);
    }
  });

  it('works a whole Shift and tells the Recap what each customer wanted at the till and what the cashier did', () => {
    const { store, customers, recaps } = atTheStaffDoor();
    store.getState().startShift();
    const first = customerNow(store);
    checkOutRightly(store);
    customers.says('ありがとう！');
    while (store.getState().game.possessions.shift) {
      checkOutRightly(store);
      customers.says('ありがとう！');
    }

    const request = recaps[0]!;
    if (request.kind !== 'shift') throw new Error('not a Shift Recap');
    expect(request.jobId).toBe('cashier');
    expect(request.customers[0]).toMatchObject({
      order: first.order,
      checkout: first.checkout,
      result: 'served',
      atTheTill: { bag: first.checkout!.bag, pointsCard: first.checkout!.pointsCard, change: first.checkout!.changeDue ?? 0 },
    });
    expect(store.getState().game.progression.lifeSkillXp.cashier).toBeGreaterThan(0);
  });
});

describe('the Cashier skill’s coin suggestions', () => {
  /** A cashier whose skill has reached the level that suggests coins, or just short of it. */
  const cashierAt = (reached: boolean) => (game: GameState): GameState => ({
    ...game,
    progression: {
      ...game.progression,
      lifeSkillXp: { ...game.progression.lifeSkillXp, cashier: LIFE_SKILLS.xpToReachLevel[LIFE_SKILLS.jobAidsFromLevel.cashier.suggestedChange - (reached ? 0 : 1)]! },
    },
  });

  it('counts out the change for the cash keyed in with the fewest coins, once unlocked', () => {
    const { store } = atTheStaffDoor(cashierAt(true));
    store.getState().startShift();
    customerIs(store, PAYS_CASH);
    ringUp(store, PAYS_CASH.order!);
    expect(selectCanSuggestChange(store.getState())).toBe(false);

    store.getState().setCashReceived(1000);
    expect(selectCanSuggestChange(store.getState())).toBe(true);
    store.getState().addChangeCoin(1);
    store.getState().suggestChange();

    expect(selectTill(store.getState())).toMatchObject({ change: [100, 50, 10], changeGiven: 160 });
  });

  it('suggests from what was keyed in, never from what the customer actually handed over', () => {
    const { store } = atTheStaffDoor(cashierAt(true));
    store.getState().startShift();
    customerIs(store, PAYS_CASH);
    ringUp(store, PAYS_CASH.order!);
    store.getState().setCashReceived(5000);
    store.getState().suggestChange();

    expect(selectTill(store.getState()).changeGiven).toBe(4160);
  });

  it('suggests nothing before the level that unlocks it, or for less cash than the total', () => {
    const before = atTheStaffDoor(cashierAt(false));
    before.store.getState().startShift();
    before.store.getState().setCashReceived(1000);
    before.store.getState().suggestChange();
    expect(selectCanSuggestChange(before.store.getState())).toBe(false);
    expect(selectTill(before.store.getState()).change).toEqual([]);

    const short = atTheStaffDoor(cashierAt(true));
    short.store.getState().startShift();
    customerIs(short.store, PAYS_CASH);
    ringUp(short.store, PAYS_CASH.order!);
    short.store.getState().setCashReceived(500);
    expect(selectCanSuggestChange(short.store.getState())).toBe(false);
  });
});

describe('the till and the café', () => {
  it('fetches only from behind the supermarket counter at the till, and the barista’s grid has none of it', () => {
    const { store } = atTheStaffDoor((game) => ({ ...hire(game, 'barista'), placeId: 'cafe' }));
    store.getState().startShift();
    expect(selectShift(store.getState())?.jobId).toBe('barista');
    for (const itemId of BEHIND_THE_COUNTER) store.getState().tapMenuItem(itemId);
    expect(selectTray(store.getState())).toEqual([]);
    expect(selectConversation(store.getState())?.shiftCustomer).toBeTruthy();
  });
});
