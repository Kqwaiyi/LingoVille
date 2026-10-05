import { describe, expect, it } from 'vitest';
import type { NpcSession, ToolResponse } from '../ai/index.ts';
import { menuPrice, placeHours } from '../content/index.ts';
import { createSave, GROCERIES, METER_MAX, WELL_BEING, type GameState, type OpeningHours } from '../sim/index.ts';
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
} from './index.ts';

const SUPERMARKET = placeHours('supermarket', DEV_SETUP.culturePackId) as Exclude<OpeningHours, null>;
const DAY = 2;

/** A stand-in NPC the test speaks for, recording the session it was opened with and how the store answers tool calls. */
function fakeVoice() {
  let calls = 0;
  const fake = {
    events: null as VoiceSessionEvents | null,
    session: null as NpcSession | null,
    answers: [] as ToolResponse[],
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
      sendText: () => {},
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
};

/** In the supermarket an hour after it opens on day 2, or wherever and whenever `where` says. */
function inTheSupermarket({ placeId = 'supermarket', minuteOfDay = SUPERMARKET.opensAt + 60, inventory = [], moneyInShifts }: Where = {}) {
  const { fake, open } = fakeVoice();
  const save = createSave(DEV_SETUP);
  const game: GameState = {
    ...save,
    placeId,
    clock: { day: DAY, minuteOfDay },
    character: { ...save.character, moneyInShifts: moneyInShifts ?? save.character.moneyInShifts },
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
    expect(selectConversation(s())?.interaction.id).toBe('pay-for-groceries');
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
    expect(selectConversation(s())?.interaction.id).toBe('find-an-item');
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
    expect(selectConversation(s())?.interaction.id).toBe('buy-counter-food');
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
