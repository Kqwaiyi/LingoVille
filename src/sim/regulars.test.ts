import { describe, expect, it } from 'vitest';
import { INTERACTIONS, type NamedNpcId } from '../content/index.ts';
import {
  applyInteractionOutcome,
  applyRecapEvidence,
  createSave,
  FAMILIARITY,
  memoryOf,
  MOOD,
  PROFICIENCY,
  casualRegisterDue,
  casualRegisterOffered,
  parkWaveDue,
  parkWaveMade,
  onTheHouseGiven,
  rollOnTheHouse,
  usualOffered,
  type EvidenceLine,
  type GameState,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

const { orderDrink, getATable, orderAMeal } = INTERACTIONS;
const LATTE = { items: [{ item: 'latte', quantity: 1 }] };
const TEA = { items: [{ item: 'tea', quantity: 1 }] };

function atTheCafe(): GameState {
  const state = createSave(TEST_SETUP);
  return { ...state, placeId: 'cafe', character: { ...state.character, moneyInShifts: 20 } };
}

function ordered(state: GameState, args: unknown, times = 1, interaction = orderDrink): GameState {
  for (let i = 0; i < times; i++) state = applyInteractionOutcome(state, interaction, { kind: 'success', args }).state;
  return state;
}

const IN_A_ROW = FAMILIARITY.usualOrderAfterIdenticalOrders;

describe('usualOrder', () => {
  it('is set once the same thing has been ordered from the NPC enough times in a row', () => {
    const almost = ordered(atTheCafe(), LATTE, IN_A_ROW - 1);
    expect(memoryOf(almost, 'barista').usualOrder).toBeNull();

    const regular = ordered(almost, LATTE);

    expect(memoryOf(regular, 'barista').usualOrder).toEqual({ interactionId: 'order-drink', args: LATTE });
  });

  it('starts counting again when something else is ordered in between', () => {
    const interrupted = ordered(ordered(ordered(atTheCafe(), LATTE, IN_A_ROW - 1), TEA), LATTE, IN_A_ROW - 1);

    expect(memoryOf(interrupted, 'barista').usualOrder).toBeNull();
  });

  it('counts the same items in any order, and the same quantities, as the same order', () => {
    const both = { items: [{ item: 'latte', quantity: 1 }, { item: 'tea', quantity: 2 }] };
    const reversed = { items: [{ item: 'tea', quantity: 2 }, { item: 'latte', quantity: 1 }] };
    const regular = ordered(ordered(atTheCafe(), both, IN_A_ROW - 1), reversed);

    expect(memoryOf(regular, 'barista').usualOrder?.interactionId).toBe('order-drink');
    expect(memoryOf(ordered(ordered(atTheCafe(), LATTE, IN_A_ROW - 1), { items: [{ item: 'latte', quantity: 2 }] }), 'barista').usualOrder).toBeNull();
  });

  it('is kept when something else is ordered once, and replaced by a new order made enough times in a row', () => {
    const regular = ordered(atTheCafe(), LATTE, IN_A_ROW);

    const once = ordered(regular, TEA);
    expect(memoryOf(once, 'barista').usualOrder?.args).toEqual(LATTE);

    const changed = ordered(once, TEA, IN_A_ROW - 1);
    expect(memoryOf(changed, 'barista').usualOrder?.args).toEqual(TEA);
  });

  it('counts only orders: a failed or abandoned one, or getting a table in between, breaks no run', () => {
    let state = ordered(atTheCafe(), LATTE, IN_A_ROW - 1);
    state = applyInteractionOutcome(state, orderDrink, { kind: 'failure' }).state;
    state = applyInteractionOutcome(state, orderDrink, { kind: 'abandon' }).state;
    expect(memoryOf(ordered(state, LATTE), 'barista').usualOrder?.args).toEqual(LATTE);

    const meal = { items: [{ item: 'fish-dish', quantity: 1 }] };
    let restaurant: GameState = { ...atTheCafe(), placeId: 'restaurant' };
    for (let i = 0; i < IN_A_ROW; i++) {
      restaurant = ordered(restaurant, { party: 1, seating: 'window' }, 1, getATable);
      restaurant = ordered(restaurant, meal, 1, orderAMeal);
      restaurant = { ...restaurant, restaurant: { seated: false, bill: [] } };
    }
    expect(memoryOf(restaurant, 'server').usualOrder).toEqual({ interactionId: 'order-a-meal', args: meal });
  });

  it('is never set for something that is not an order, like paying the same rent', () => {
    const atHome: GameState = { ...atTheCafe(), placeId: 'home' };
    const paid = ordered(atHome, { amount: 1 }, IN_A_ROW, INTERACTIONS.payRent);

    expect(memoryOf(paid, 'landlord').usualOrder).toBeNull();
  });
});

/** The barista, after `familiarity` points, with the latte as the Character's usual. */
function regularAt(familiarity: number): GameState {
  const regular = ordered(atTheCafe(), LATTE, IN_A_ROW);
  const memory = memoryOf(regular, 'barista');
  return { ...regular, people: { barista: { ...memory, familiarity } } };
}

describe('"the usual?"', () => {
  it('is offered from acquaintance up, in the interaction the usual is ordered in', () => {
    const { acquaintance, friend } = FAMILIARITY.tierThresholds;

    expect(usualOffered(memoryOf(regularAt(acquaintance - 1), 'barista'), orderDrink)).toBeNull();
    expect(usualOffered(memoryOf(regularAt(acquaintance), 'barista'), orderDrink)).toEqual(LATTE);
    expect(usualOffered(memoryOf(regularAt(friend), 'barista'), orderDrink)).toEqual(LATTE);
    expect(usualOffered(memoryOf(regularAt(friend), 'barista'), INTERACTIONS.askBaristaForWork)).toBeNull();
  });

  it('is not offered with no usual yet', () => {
    const state = atTheCafe();
    const known = { ...memoryOf(state, 'barista'), familiarity: FAMILIARITY.tierThresholds.friend };

    expect(usualOffered(known, orderDrink)).toBeNull();
  });

  it('accepted, is a normal success: paid for, served, Mood lifted, and still the usual', () => {
    const before = regularAt(FAMILIARITY.tierThresholds.acquaintance);

    const { state, result } = applyInteractionOutcome(before, orderDrink, { kind: 'success', args: usualOffered(memoryOf(before, 'barista'), orderDrink) });

    expect(result).toMatchObject({ kind: 'success', served: [{ itemId: 'latte', quantity: 1 }], moodChange: MOOD.changes.goalInteractionSuccess });
    expect(state.character.moneyInShifts).toBeLessThan(before.character.moneyInShifts);
    expect(memoryOf(state, 'barista').usualOrder?.args).toEqual(LATTE);
  });

  it('accepted in a word, counts as small level evidence, because the Player said so little', () => {
    const before = regularAt(FAMILIARITY.tierThresholds.acquaintance);
    const settled = { ...before, progression: { ...before.progression, evidenceSoFar: PROFICIENCY.fastStartInteractions } };
    const usual: EvidenceLine[] = [
      { speaker: 'npc', text: 'Morning, Sam! The usual?' },
      { speaker: 'player', text: 'Yes, please.' },
      { speaker: 'npc', text: "One latte, coming up. That's £3.20." },
    ];
    const chatty: EvidenceLine[] = Array.from({ length: 6 }, (_, i): EvidenceLine[] => [
      { speaker: 'npc', text: `NPC line ${i}` },
      { speaker: 'player', text: `Player turn ${i}` },
    ]).flat();
    const moved = (lines: EvidenceLine[]) =>
      applyRecapEvidence(settled, { cefrEstimate: 'B1', lines, helpLog: [], notUnderstoodTurns: 0 }).progression.proficiencyScore -
      settled.progression.proficiencyScore;

    expect(moved(usual) / moved(chatty)).toBeCloseTo(PROFICIENCY.shortConversation.weight);
  });
});

/** At the café with the barista a friend (or `familiarity` points), on `day`, with the RNG seeded `seed`. */
function friendAtTheCafe({ seed = 1, day = 10, familiarity = FAMILIARITY.tierThresholds.friend as number } = {}): GameState {
  const state = createSave({ ...TEST_SETUP, rngSeed: seed });
  const memory = { ...memoryOf(state, 'barista'), familiarity };
  return { ...state, placeId: 'cafe', clock: { ...state.clock, day }, character: { ...state.character, moneyInShifts: 20 }, people: { barista: memory } };
}

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('"on the house"', () => {
  it('happens now and then when a friend takes an order, drawn from the save’s RNG', () => {
    const rolls = SEEDS.map((seed) => rollOnTheHouse(friendAtTheCafe({ seed }), orderDrink));
    const given = rolls.filter(({ onTheHouse }) => onTheHouse).length;

    expect(given).toBeGreaterThan(SEEDS.length * FAMILIARITY.onTheHouseChance * 0.6);
    expect(given).toBeLessThan(SEEDS.length * FAMILIARITY.onTheHouseChance * 1.4);
    expect(rollOnTheHouse(friendAtTheCafe({ seed: 7 }), orderDrink)).toEqual(rollOnTheHouse(friendAtTheCafe({ seed: 7 }), orderDrink));
  });

  it('never comes from an acquaintance, or with anything but an order', () => {
    const acquaintance = FAMILIARITY.tierThresholds.friend - 1;

    expect(SEEDS.some((seed) => rollOnTheHouse(friendAtTheCafe({ seed, familiarity: acquaintance }), orderDrink).onTheHouse)).toBe(false);
    expect(SEEDS.some((seed) => rollOnTheHouse(friendAtTheCafe({ seed }), INTERACTIONS.askBaristaForWork).onTheHouse)).toBe(false);
  });

  /** Whether any seed's roll gives something on the house in `state`. */
  const anyRollGives = (state: GameState) =>
    SEEDS.some((s) => rollOnTheHouse({ ...state, rngState: friendAtTheCafe({ seed: s }).rngState }, orderDrink).onTheHouse);

  it('comes at most once a week from each NPC, counted from the day it was given', () => {
    const given = onTheHouseGiven(friendAtTheCafe(), 'barista');
    const later = (days: number): GameState => ({ ...given, clock: { ...given.clock, day: given.clock.day + days } });

    expect(anyRollGives(later(FAMILIARITY.onTheHouseCooldownDays - 1))).toBe(false);
    expect(anyRollGives(later(FAMILIARITY.onTheHouseCooldownDays))).toBe(true);
  });

  it('only draws: a roll that gives something uses up nothing until it is given', () => {
    const seed = SEEDS.find((s) => rollOnTheHouse(friendAtTheCafe({ seed: s }), orderDrink).onTheHouse)!;
    const rolled = rollOnTheHouse(friendAtTheCafe({ seed }), orderDrink).state;

    expect(anyRollGives(rolled)).toBe(true);
  });

  it('is flavour only: the order costs the same', () => {
    const seed = SEEDS.find((s) => rollOnTheHouse(friendAtTheCafe({ seed: s }), orderDrink).onTheHouse)!;
    const before = friendAtTheCafe({ seed });
    const onTheHouse = rollOnTheHouse(before, orderDrink).state;

    const paid = (state: GameState) => state.character.moneyInShifts - applyInteractionOutcome(state, orderDrink, { kind: 'success', args: LATTE }).state.character.moneyInShifts;

    expect(paid(onTheHouse)).toBeGreaterThan(0);
    expect(paid(onTheHouse)).toBeCloseTo(paid(atTheCafe()));
  });
});

describe('the casual register', () => {
  it('is offered by a friend, and by no one less familiar', () => {
    expect(casualRegisterDue(memoryOf(friendAtTheCafe(), 'barista'))).toBe(true);
    expect(casualRegisterDue(memoryOf(friendAtTheCafe({ familiarity: FAMILIARITY.tierThresholds.friend - 1 }), 'barista'))).toBe(false);
  });

  it('is offered once only (registerOffered)', () => {
    const offered = casualRegisterOffered(friendAtTheCafe(), 'barista');

    expect(memoryOf(offered, 'barista').registerOffered).toBe(true);
    expect(casualRegisterDue(memoryOf(offered, 'barista'))).toBe(false);
  });
});

const REGULARS: NamedNpcId[] = ['park-regular-1', 'park-regular-2', 'park-regular-3'];

/** Walking from the tram stop into the park, on `day`. */
function intoThePark(state: GameState, day = state.clock.day) {
  const before: GameState = { ...state, placeId: 'tram-stop', clock: { ...state.clock, day } };
  return { before, after: { ...before, placeId: 'park' as const } };
}

describe('park regulars waving the Character over', () => {
  it('happens on coming into the park', () => {
    const { before, after } = intoThePark(createSave(TEST_SETUP));

    expect(parkWaveDue(before, after)).toBe(true);
    expect(parkWaveDue(after, after)).toBe(false);
    expect(parkWaveDue(before, { ...before, placeId: 'cafe' })).toBe(false);
  });

  it('is one of the park regulars, drawn from the save’s RNG', () => {
    const waved = (seed: number) => parkWaveMade(createSave({ ...TEST_SETUP, rngSeed: seed }), REGULARS).npcId;
    const seen = new Set(Array.from({ length: 50 }, (_, i) => waved(i + 1)));

    expect([...seen].sort()).toEqual(REGULARS);
    expect(waved(3)).toBe(waved(3));
  });

  it('happens at most once a day', () => {
    const { after } = intoThePark(createSave(TEST_SETUP));
    const waved = parkWaveMade(after, REGULARS).state;

    const again = intoThePark(waved);
    expect(parkWaveDue(again.before, again.after)).toBe(false);

    const tomorrow = intoThePark(waved, waved.clock.day + 1);
    expect(parkWaveDue(tomorrow.before, tomorrow.after)).toBe(true);
  });
});
