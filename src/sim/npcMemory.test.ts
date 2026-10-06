import { describe, expect, it } from 'vitest';
import { INTERACTIONS } from '../content/index.ts';
import { applyInteractionOutcome, createSave, memoryOf, type GameState } from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const { orderDrink } = INTERACTIONS;
const LATTE = { items: [{ item: 'latte', quantity: 1 }] };

function atTheCafe(): GameState {
  return { ...createSave(TEST_SETUP), placeId: 'cafe' };
}

describe('NPC Memory', () => {
  it('treats the Character as a stranger when the NPC has no record', () => {
    expect(memoryOf(atTheCafe(), 'barista')).toEqual({
      familiarity: 0,
      todaysGain: { day: 1, amount: 0 },
      timesMet: 0,
      knowsName: false,
      usualOrder: null,
      lastTopic: null,
      favouriteKnown: false,
      lastGiftDay: null,
      registerOffered: false,
    });
  });

  it('counts a first finished conversation as meeting the NPC once', () => {
    const { state } = applyInteractionOutcome(atTheCafe(), orderDrink, { kind: 'success', args: LATTE });

    expect(state.people.barista).toMatchObject({ timesMet: 1, familiarity: 0, knowsName: false });
    expect(state.people.nurse).toBeUndefined();
  });

  it('goes up after every finished conversation, however it ended', () => {
    let state = atTheCafe();
    state = applyInteractionOutcome(state, orderDrink, { kind: 'success', args: LATTE }).state;
    state = applyInteractionOutcome(state, orderDrink, { kind: 'failure' }).state;
    state = applyInteractionOutcome(state, orderDrink, { kind: 'abandon' }).state;

    expect(memoryOf(state, 'barista').timesMet).toBe(3);
  });

  it('keeps the rest of the record as it was', () => {
    const cafe = atTheCafe();
    const known = { ...memoryOf(cafe, 'barista'), timesMet: 4, knowsName: true, lastTopic: 'the rain' };
    const state: GameState = { ...cafe, people: { barista: known } };

    const after = applyInteractionOutcome(state, orderDrink, { kind: 'failure' }).state;

    expect(after.people.barista).toEqual({ ...known, timesMet: 5 });
  });

  it("doesn't count a turn that leaves the conversation going on", () => {
    const state = atTheCafe();
    const broke = { ...state, character: { ...state.character, moneyInShifts: 0 } };

    expect(applyInteractionOutcome(broke, orderDrink, { kind: 'success', args: LATTE }).state.people).toEqual({});
    expect(applyInteractionOutcome(state, orderDrink, { kind: 'success', args: { items: [] } }).state.people).toEqual({});
  });
});
