import { describe, expect, it } from 'vitest';
import { chargeInShifts, CULTURE_PACKS, INTERACTIONS, menuPrice } from '../content/index.ts';
import { applyInteractionOutcome, createSave, ECONOMY, GROCERIES, MOOD, type GameState, type InventoryItem } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const DAY = 5;

/** Day 5 at noon, with `money` and `inventory`, in the ja pack unless told otherwise. */
function onDay5({ money = 2, inventory = [] as InventoryItem[], addressRegistered = false, packId = TEST_SETUP.culturePackId } = {}): GameState {
  const state = createSave({ ...TEST_SETUP, targetLanguage: packId, culturePackId: packId });
  return {
    ...state,
    clock: { day: DAY, minuteOfDay: 12 * 60 },
    character: { ...state.character, moneyInShifts: money },
    possessions: { ...state.possessions, inventory, addressRegistered },
  };
}

const freshEggs = (quantity: number): InventoryItem => ({ itemId: 'eggs', quantity, expiresOnDay: DAY + 1 });
const goneOffEggs: InventoryItem = { itemId: 'eggs', quantity: 1, expiresOnDay: DAY - 1 };
const success = (args: unknown) => ({ kind: 'success' as const, args });

describe('Goal Interaction #6: returning a faulty item to the supermarket', () => {
  const refund = (state: GameState, item = 'eggs') => applyInteractionOutcome(state, INTERACTIONS.returnAnItem, success({ item, reason: 'cracked' }));

  it('takes one of the item out of the inventory and pays its shelf price back, with the usual Mood lift', () => {
    const before = onDay5({ inventory: [freshEggs(2)] });
    const { state, result } = refund(before);

    expect(state.possessions.inventory).toEqual([freshEggs(1)]);
    expect(state.character.moneyInShifts).toBeCloseTo(2 + menuPrice('eggs', 'ja'));
    expect(state.character.mood).toBe(before.character.mood + MOOD.changes.goalInteractionSuccess);
    expect(result).toMatchObject({ kind: 'success', paidInShifts: 0, refundedInShifts: menuPrice('eggs', 'ja') });
  });

  it('pays back the price in the Character’s pack', () => {
    const { state } = refund(onDay5({ inventory: [freshEggs(1)], packId: 'de' }));
    expect(state.possessions.inventory).toEqual([]);
    expect(state.character.moneyInShifts).toBeCloseTo(2 + menuPrice('eggs', 'de'));
  });

  it('refuses an item the Character hasn’t got, changing nothing', () => {
    const before = onDay5({ inventory: [freshEggs(1)] });
    const { state, result } = refund(before, 'noodles');
    expect(result).toMatchObject({ kind: 'invalid_arguments', error: expect.stringContaining(CULTURE_PACKS.ja.goods.noodles.name) });
    expect(state).toBe(before);
  });

  it('refuses an item past its date, and takes back one still in date instead of it', () => {
    expect(refund(onDay5({ inventory: [goneOffEggs] })).result).toMatchObject({ kind: 'invalid_arguments', error: expect.stringMatching(/past its date/) });
    expect(refund(onDay5({ inventory: [goneOffEggs, freshEggs(1)] })).state.possessions.inventory).toEqual([goneOffEggs]);
  });

  it('counts groceries as in date to the end of their expiry day', () => {
    const lastDay: InventoryItem = { itemId: 'eggs', quantity: 1, expiresOnDay: DAY };
    expect(GROCERIES.expiryDays).toBeGreaterThan(0);
    expect(refund(onDay5({ inventory: [lastDay] })).result.kind).toBe('success');
  });
});

describe('Goal Interaction #23: registering an address at the town office', () => {
  const register = (state: GameState, name = 'Sam') =>
    applyInteractionOutcome(state, INTERACTIONS.registerAddress, success({ fields: { name, address: 'Sakura House', nationality: 'Irish' } }));

  it('records the address as registered in the save, costing nothing', () => {
    const before = onDay5();
    const { state, result } = register(before);
    expect(state.possessions.addressRegistered).toBe(true);
    expect(state.character.moneyInShifts).toBe(before.character.moneyInShifts);
    expect(result).toMatchObject({ kind: 'success', moodChange: MOOD.changes.goalInteractionSuccess });
  });

  it('says the clerk misheard a name that isn’t the Character’s, and registers nothing', () => {
    const before = onDay5();
    expect(register(before, 'Tom')).toEqual({ state: before, result: { kind: 'wrong_name' } });
  });

  it('won’t register an address twice', () => {
    expect(register(onDay5({ addressRegistered: true })).result.kind).toBe('invalid_arguments');
  });
});

describe('Goal Interaction #24: sending a parcel home', () => {
  const ship = (state: GameState, speed = 'air') => applyInteractionOutcome(state, INTERACTIONS.sendAParcel, success({ destination: 'Ireland', speed }));

  it('charges the postage for its speed, and lifts Mood more than a plain success', () => {
    const before = onDay5();
    const { state, result } = ship(before, 'express');
    const postage = chargeInShifts(ECONOMY.postageInShifts.express, 'ja');
    expect(state.character.moneyInShifts).toBeCloseTo(2 - postage);
    expect(result).toMatchObject({ kind: 'success', paidInShifts: postage });
    expect(state.character.mood).toBe(before.character.mood + MOOD.changes.goalInteractionSuccess + MOOD.changes.parcelSent);
  });

  it('can’t send it without the postage', () => {
    const before = onDay5({ money: 0.01 });
    expect(ship(before)).toEqual({ state: before, result: { kind: 'cannot_afford' } });
  });
});

describe('Goal Interaction #25: asking a passer-by which tram goes to a place', () => {
  it('names the stop to get off at, for its route marker', () => {
    const before = onDay5();
    const { state, result } = applyInteractionOutcome(before, INTERACTIONS.askForDirections, success({ stop: 'east-stop' }));
    expect(result).toMatchObject({ kind: 'success', paidInShifts: 0, directedTo: 'east-stop' });
    expect(state.character.mood).toBe(before.character.mood + MOOD.changes.goalInteractionSuccess);
  });

  it('leaves no NPC Memory: a passer-by is no one the Character gets to know', () => {
    const before = onDay5();
    for (const outcome of [success({ stop: 'west-stop' }), { kind: 'failure' as const }, { kind: 'abandon' as const }]) {
      expect(applyInteractionOutcome(before, INTERACTIONS.askForDirections, outcome).state.people).toEqual({});
    }
  });
});
