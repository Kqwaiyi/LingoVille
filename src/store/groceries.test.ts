import { describe, expect, it } from 'vitest';
import type { NpcSession, ToolResponse } from '../ai/index.ts';
import { menuPrice, placeHours } from '../content/index.ts';
import { CLOCK, createSave, GROCERIES, METER_MAX, WELL_BEING, type GameState, type OpeningHours } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  selectBasket,
  selectClosingCard,
  selectConversation,
  selectInteractable,
  selectInventory,
  selectShelfMarker,
  selectTalkWithE,
  selectTalkWithF,
} from './index.ts';

const SUPERMARKET = placeHours('supermarket', DEV_SETUP.culturePackId) as Exclude<OpeningHours, null>;
const DAY = 2;

/** A stand-in NPC the test speaks for, recording the session it was opened with, what it is sent and how the store answers tool calls. */
function fakeVoice() {
  let calls = 0;
  const fake = {
    events: null as VoiceSessionEvents | null,
    session: null as NpcSession | null,
    answers: [] as ToolResponse[],
    sent: [] as string[],
    says(text: string) {
      fake.events!.onOutputTranscript(text);
      fake.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      fake.events!.onToolCall({ id: `call-${++calls}`, name, args });
      return fake.answers.at(-1);
    },
  };
  const open: OpenVoiceSession = (session, events) => {
    fake.session = session;
    fake.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: (text) => fake.sent.push(text),
      sendToolResponse: (_id, response) => fake.answers.push(response),
      close: () => {},
    };
  };
  return { fake, open };
}

type Where = {
  placeId?: GameState['placeId'];
  minuteOfDay?: number;
  inventory?: GameState['possessions']['inventory'];
  moneyInShifts?: number;
  /** Health about to run out, with Hunger and Thirst empty. */
  aboutToFaint?: boolean;
};

/** In the supermarket an hour after it opens on day 2, or wherever and whenever `where` says. */
function inTheSupermarket({
  placeId = 'supermarket',
  minuteOfDay = SUPERMARKET.opensAt + 60,
  inventory = [],
  moneyInShifts,
  aboutToFaint = false,
}: Where = {}) {
  const { fake, open } = fakeVoice();
  const save = createSave(DEV_SETUP);
  const game: GameState = {
    ...save,
    placeId,
    clock: { day: DAY, minuteOfDay },
    character: {
      ...save.character,
      moneyInShifts: moneyInShifts ?? save.character.moneyInShifts,
      ...(aboutToFaint && { health: 0.01, hunger: 0, thirst: 0 }),
    },
    possessions: { ...save.possessions, inventory },
  };
  const store = createGameStore(game, { openVoiceSession: open });
  return { store, fake, s: () => store.getState() };
}

describe('taking groceries off the shelves', () => {
  it('puts them in the basket, up to a few of each, and back again', () => {
    const { s } = inTheSupermarket();
    s().setInteractable('eggs');
    expect(selectInteractable(s())).toBe('eggs');

    s().takeFromShelf();
    s().takeFromShelf();
    s().setInteractable('noodles');
    s().takeFromShelf();
    expect(selectBasket(s())).toEqual([
      { itemId: 'eggs', quantity: 2 },
      { itemId: 'noodles', quantity: 1 },
    ]);

    s().putBack('eggs');
    expect(selectBasket(s())).toEqual([
      { itemId: 'eggs', quantity: 1 },
      { itemId: 'noodles', quantity: 1 },
    ]);
  });

  it('can’t be done while the supermarket is closed', () => {
    const { s } = inTheSupermarket({ minuteOfDay: SUPERMARKET.closesAt });
    s().setInteractable('eggs');
    expect(selectInteractable(s())).toBeNull();
    s().takeFromShelf();
    expect(selectBasket(s())).toEqual([]);
  });

  it('go back on the shelves when the Character goes somewhere else', () => {
    const { s } = inTheSupermarket();
    s().setInteractable('eggs');
    s().takeFromShelf();
    s().enterPlace('convenience-store');
    expect(selectBasket(s())).toEqual([]);
  });

  it('go back on the shelves, and the shelf marker goes, when the Character faints', () => {
    const { s, fake } = inTheSupermarket({ aboutToFaint: true });
    s().setInteractable('cashier');
    s().talk();
    fake.calls('point_to', { item: 'noodles' });
    s().leaveConversation();
    s().skipRecap();
    s().setInteractable('eggs');
    s().takeFromShelf();
    expect(selectShelfMarker(s())).toBe('noodles');

    s().advance(CLOCK.maxRealDeltaMs);
    expect(s().game.placeId).toBe('clinic');
    expect(selectBasket(s())).toEqual([]);
    expect(selectShelfMarker(s())).toBeNull();
  });
});

describe('paying at the till (#4)', () => {
  function atTheTillWithEggs(where: Where = {}) {
    const supermarket = inTheSupermarket(where);
    const { s, fake } = supermarket;
    s().setInteractable('eggs');
    s().takeFromShelf();
    s().takeFromShelf();
    s().setInteractable('cashier');
    s().talk();
    fake.says('いらっしゃいませ。レジ袋はご利用ですか？');
    return supermarket;
  }

  it('with shopping in the basket, E at the cashier starts paying, and the cashier knows what is on the counter', () => {
    const { s, fake } = atTheTillWithEggs();
    expect(selectConversation(s())?.interaction?.id).toBe('pay-for-groceries');
    expect(fake.session!.systemInstruction).toContain('2 × 卵');
  });

  it('takes payment for the basket and puts the groceries in the inventory, going off in a few days', () => {
    const { s, fake } = atTheTillWithEggs();
    const before = s().game.character.moneyInShifts;

    expect(fake.calls('complete_purchase', { bag: true, card: false })).toEqual({ result: 'served' });

    expect(s().game.character.moneyInShifts).toBeCloseTo(before - 2 * menuPrice('eggs', 'ja'));
    expect(selectInventory(s())).toEqual([{ itemId: 'eggs', quantity: 2, expiresOnDay: DAY + GROCERIES.expiryDays, goneOff: false }]);
    expect(selectBasket(s())).toEqual([]);

    fake.says('ありがとうございました！');
    expect(selectClosingCard(s())).toMatchObject({ kind: 'success', served: [{ itemId: 'eggs', quantity: 2 }] });
  });

  it('tells the cashier when the Character can’t afford it, and keeps the basket', () => {
    const { s, fake } = atTheTillWithEggs({ moneyInShifts: menuPrice('eggs', 'ja') });
    expect(fake.calls('complete_purchase', { bag: false, card: false })).toEqual({ result: 'cannot_afford' });
    expect(selectBasket(s())).toEqual([{ itemId: 'eggs', quantity: 2 }]);
  });

  it('lets the Character put something back at the till, tells the cashier the new total, and charges for what is left', () => {
    const { s, fake } = atTheTillWithEggs({ moneyInShifts: menuPrice('eggs', 'ja') });
    fake.calls('complete_purchase', { bag: false, card: false });

    s().putBack('eggs');
    expect(selectBasket(s())).toEqual([{ itemId: 'eggs', quantity: 1 }]);
    expect(fake.sent.at(-1)).toMatch(/^\[SCENE: /);
    expect(fake.sent.at(-1)).toContain('1 × 卵');
    expect(fake.sent.at(-1)).toContain('Total: ¥360.');

    expect(fake.calls('complete_purchase', { bag: false, card: false })).toEqual({ result: 'served' });
    expect(s().game.character.moneyInShifts).toBeCloseTo(0);
    expect(selectInventory(s())).toMatchObject([{ itemId: 'eggs', quantity: 1 }]);
  });

  it('keeps the last item on the counter: leaving the till is how to put everything back', () => {
    const { s, fake } = atTheTillWithEggs();
    s().putBack('eggs');
    s().putBack('eggs');
    expect(selectBasket(s())).toEqual([{ itemId: 'eggs', quantity: 1 }]);
    expect(fake.sent).toHaveLength(1);
  });

  it('rings up the basket as it is now when a dropped connection is replaced', () => {
    const { s, fake } = atTheTillWithEggs();
    s().putBack('eggs');
    fake.events!.onDisconnect();
    expect(fake.session!.systemInstruction).toContain('1 × 卵');
    expect(fake.session!.systemInstruction).toContain('Total: ¥360.');
  });

  it('puts nothing back once the cashier has given up, while reconnecting, while the Player is talking or while Help is open', () => {
    const givenUp = atTheTillWithEggs();
    for (let turn = 0; givenUp.fake.answers.at(-1)?.result !== 'out_of_patience' && turn < 10; turn++) {
      givenUp.s().sendTypedLine('xqzt');
      givenUp.fake.calls('not_understood', { reason: 'unintelligible' });
    }
    expect(selectClosingCard(givenUp.s()) ?? selectConversation(givenUp.s())?.outcome).toMatchObject({ kind: 'failure' });

    const reconnecting = atTheTillWithEggs();
    reconnecting.fake.events!.onDisconnect();

    const talking = atTheTillWithEggs();
    talking.s().startTalking();

    const inHelp = atTheTillWithEggs();
    inHelp.s().toggleHelp();

    for (const [when, { s, fake }] of Object.entries({ givenUp, reconnecting, talking, inHelp })) {
      const sent = fake.sent.length;
      s().putBack('eggs');
      expect(selectBasket(s()), when).toEqual([{ itemId: 'eggs', quantity: 2 }]);
      expect(fake.sent, when).toHaveLength(sent);
    }
  });

  it('puts nothing back while talking to anyone but the cashier at the till', () => {
    const { s } = inTheSupermarket();
    s().setInteractable('eggs');
    s().takeFromShelf();
    s().takeFromShelf();
    s().setInteractable('cashier');
    s().talk('F');
    s().putBack('eggs');
    expect(selectBasket(s())).toEqual([{ itemId: 'eggs', quantity: 2 }]);
  });
});

describe('asking where an item is (#5)', () => {
  function askingTheCashier() {
    const supermarket = inTheSupermarket();
    supermarket.s().setInteractable('cashier');
    supermarket.s().talk();
    supermarket.fake.says('何かお探しですか？');
    return supermarket;
  }

  it('with nothing in the basket, E at the cashier asks for help finding something', () => {
    const { s } = askingTheCashier();
    expect(selectConversation(s())?.interaction?.id).toBe('find-an-item');
  });

  it('marks the item on its shelf once the cashier points to it, until the Character takes one', () => {
    const { s, fake } = askingTheCashier();
    expect(selectShelfMarker(s())).toBeNull();

    expect(fake.calls('point_to', { item: 'noodles' })).toEqual({ result: 'done' });
    expect(selectShelfMarker(s())).toBe('noodles');

    fake.says('うどんはあちらの棚にございます。');
    s().leaveConversation();
    s().setInteractable('noodles');
    s().takeFromShelf();
    expect(selectShelfMarker(s())).toBeNull();
  });

  it('with shopping in the basket, F at the cashier asks where something else is, and the basket stays', () => {
    const { s, fake } = inTheSupermarket();
    s().setInteractable('eggs');
    s().takeFromShelf();
    s().setInteractable('cashier');
    expect(selectTalkWithE(s())?.id).toBe('pay-for-groceries');
    expect(selectTalkWithF(s())?.id).toBe('find-an-item');

    s().talk('F');
    expect(selectConversation(s())?.interaction?.id).toBe('find-an-item');
    expect(fake.calls('point_to', { item: 'noodles' })).toEqual({ result: 'done' });
    expect(selectShelfMarker(s())).toBe('noodles');
    expect(selectBasket(s())).toEqual([{ itemId: 'eggs', quantity: 1 }]);
  });

  it('with nothing in the basket, F does nothing more than E', () => {
    const { s } = inTheSupermarket();
    s().setInteractable('cashier');
    expect(selectTalkWithE(s())?.id).toBe('find-an-item');
    expect(selectTalkWithF(s())).toBeNull();
    s().talk('F');
    expect(selectConversation(s())).toBeNull();
  });

  it('clears the marker when the Character leaves the supermarket', () => {
    const { s, fake } = askingTheCashier();
    fake.calls('point_to', { item: 'eggs' });
    s().enterPlace('cafe');
    expect(selectShelfMarker(s())).toBeNull();
  });
});

describe('counter food at the convenience store (#7)', () => {
  it('E at the clerk orders over the counter; a served bento raises Hunger', () => {
    const { s, fake } = inTheSupermarket({ placeId: 'convenience-store' });
    s().setInteractable('convenience-clerk');
    s().talk();
    fake.says('いらっしゃいませ！');
    expect(selectConversation(s())?.interaction?.id).toBe('buy-counter-food');
    const hunger = s().game.character.hunger;

    expect(fake.calls('serve_order', { items: [{ item: 'bento', quantity: 1 }] })).toEqual({ result: 'served' });
    expect(s().game.character.hunger).toBe(Math.min(METER_MAX, hunger + WELL_BEING.bentoHunger));
    expect(selectInventory(s())).toEqual([]);
  });
});

describe('the inventory', () => {
  it('shows what the Character owns, and which groceries have gone off', () => {
    const fresh = { itemId: 'eggs' as const, quantity: 1, expiresOnDay: DAY };
    const off = { itemId: 'noodles' as const, quantity: 2, expiresOnDay: DAY - 1 };
    const { s } = inTheSupermarket({ inventory: [fresh, off] });
    expect(selectInventory(s())).toEqual([
      { ...fresh, goneOff: false },
      { ...off, goneOff: true },
    ]);
  });
});
