import { describe, expect, it } from 'vitest';
import { INTERACTIONS } from '../content/index.ts';
import {
  applyInteractionOutcome,
  createSave,
  endSmallTalk,
  FAMILIARITY,
  familiarityTier,
  learnName,
  memoryOf,
  MOOD,
  rememberTopic,
  SMALL_TALK,
  smallTalkExchange,
  startSmallTalk,
  type GameState,
  type NpcMemory,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

function inThePark(): GameState {
  return { ...createSave(TEST_SETUP), placeId: 'park' };
}

/** As many understood exchanges with one NPC as it takes to use up the day's cap. */
const EXCHANGES_PER_DAY = Math.ceil(FAMILIARITY.dailyCapPerNpc / FAMILIARITY.smallTalkExchange);

function chat(state: GameState, npcId: 'park-regular-1' | 'park-regular-2', exchanges: number) {
  for (let i = 0; i < exchanges; i++) state = smallTalkExchange(state, npcId).state;
  return state;
}

function nextDay(state: GameState): GameState {
  return { ...state, clock: { ...state.clock, day: state.clock.day + 1 } };
}

function knownFor(state: GameState, familiarity: number): GameState {
  const memory: NpcMemory = { ...memoryOf(state, 'park-regular-1'), familiarity };
  return { ...state, people: { 'park-regular-1': memory } };
}

describe('Small Talk', () => {
  it('lifts Mood and Familiarity for each understood exchange', () => {
    const before = inThePark();

    const { state, moodChange } = smallTalkExchange(before, 'park-regular-1');

    expect(moodChange).toBe(MOOD.changes.smallTalkExchange.stranger);
    expect(state.character.mood).toBe(before.character.mood + moodChange);
    expect(memoryOf(state, 'park-regular-1').familiarity).toBe(FAMILIARITY.smallTalkExchange);
    expect(familiarityTier(memoryOf(state, 'park-regular-1'))).toBe('stranger');
  });

  it("stops changing Mood and Familiarity once the day's cap with that NPC is used up", () => {
    const capped = chat(inThePark(), 'park-regular-1', EXCHANGES_PER_DAY);

    const { state, moodChange } = smallTalkExchange(capped, 'park-regular-1');

    expect(memoryOf(capped, 'park-regular-1').familiarity).toBe(FAMILIARITY.dailyCapPerNpc);
    expect(moodChange).toBe(0);
    expect(state.character.mood).toBe(capped.character.mood);
    expect(memoryOf(state, 'park-regular-1').familiarity).toBe(FAMILIARITY.dailyCapPerNpc);
  });

  it('caps each NPC on their own, so talking to someone else still counts', () => {
    const capped = chat(inThePark(), 'park-regular-1', EXCHANGES_PER_DAY);

    expect(smallTalkExchange(capped, 'park-regular-2').moodChange).toBeGreaterThan(0);
  });

  it('starts the cap again the next day', () => {
    const capped = chat(inThePark(), 'park-regular-1', EXCHANGES_PER_DAY);

    expect(smallTalkExchange(nextDay(capped), 'park-regular-1').moodChange).toBeGreaterThan(0);
  });

  it('lifts Mood more the better the NPC knows the Character', () => {
    const { acquaintance, friend } = FAMILIARITY.tierThresholds;
    const mood = (familiarity: number) => smallTalkExchange(knownFor(inThePark(), familiarity), 'park-regular-1').moodChange;

    expect(mood(acquaintance)).toBe(MOOD.changes.smallTalkExchange.acquaintance);
    expect(mood(friend)).toBe(MOOD.changes.smallTalkExchange.friend);
    expect(mood(friend)).toBeGreaterThan(mood(acquaintance));
    expect(mood(acquaintance)).toBeGreaterThan(mood(0));
  });
});

describe('Familiarity', () => {
  it('reads as stranger, acquaintance and friend from the tuning thresholds', () => {
    const { acquaintance, friend } = FAMILIARITY.tierThresholds;
    const tier = (familiarity: number) => familiarityTier(memoryOf(knownFor(inThePark(), familiarity), 'park-regular-1'));

    expect(tier(0)).toBe('stranger');
    expect(tier(acquaintance - 1)).toBe('stranger');
    expect(tier(acquaintance)).toBe('acquaintance');
    expect(tier(friend - 1)).toBe('acquaintance');
    expect(tier(friend)).toBe('friend');
  });

  it('makes a friend of an NPC chatted with daily in one to two weeks', () => {
    let state = inThePark();
    let days = 0;
    while (familiarityTier(memoryOf(state, 'park-regular-1')) !== 'friend') {
      state = nextDay(chat(state, 'park-regular-1', EXCHANGES_PER_DAY));
      days++;
    }

    expect(days).toBeGreaterThanOrEqual(7);
    expect(days).toBeLessThanOrEqual(14);
  });

  it('never decays, however long the Character stays away', () => {
    const friends = knownFor(inThePark(), FAMILIARITY.tierThresholds.friend);
    let later = friends;
    for (let i = 0; i < 60; i++) later = nextDay(later);
    const { state } = smallTalkExchange(later, 'park-regular-2');

    expect(memoryOf(state, 'park-regular-1').familiarity).toBe(FAMILIARITY.tierThresholds.friend);
  });

  it('grows a little from a successful Goal Interaction with that NPC', () => {
    const cafe: GameState = { ...createSave(TEST_SETUP), placeId: 'cafe' };
    const latte = { items: [{ item: 'latte', quantity: 1 }] };

    const { state } = applyInteractionOutcome(cafe, INTERACTIONS.orderDrink, { kind: 'success', args: latte });
    const failed = applyInteractionOutcome(cafe, INTERACTIONS.orderDrink, { kind: 'failure' }).state;

    expect(memoryOf(state, 'barista').familiarity).toBe(FAMILIARITY.goalInteractionSuccess);
    expect(memoryOf(failed, 'barista').familiarity).toBe(0);
  });

  it('shares the daily cap between Goal Interactions and Small Talk', () => {
    const cafe: GameState = { ...createSave(TEST_SETUP), placeId: 'cafe' };
    let state = cafe;
    for (let i = 0; i < EXCHANGES_PER_DAY; i++) state = smallTalkExchange(state, 'barista').state;
    const latte = { items: [{ item: 'latte', quantity: 1 }] };

    const after = applyInteractionOutcome(state, INTERACTIONS.orderDrink, { kind: 'success', args: latte }).state;

    expect(memoryOf(after, 'barista').familiarity).toBe(FAMILIARITY.dailyCapPerNpc);
  });
});

describe('Small Talk length', () => {
  it("draws how many exchanges the NPC chats for from the save's RNG", () => {
    const lengths = new Set<number>();
    let state = inThePark();
    for (let i = 0; i < 50; i++) {
      const started = startSmallTalk(state);
      expect(started.exchanges).toBeGreaterThanOrEqual(SMALL_TALK.exchanges.min);
      expect(started.exchanges).toBeLessThanOrEqual(SMALL_TALK.exchanges.max);
      lengths.add(started.exchanges);
      state = started.state;
    }

    expect(lengths.size).toBe(SMALL_TALK.exchanges.max - SMALL_TALK.exchanges.min + 1);
    expect(startSmallTalk(inThePark())).toEqual(startSmallTalk(inThePark()));
  });

  it('counts as meeting the NPC once it ends', () => {
    const state = endSmallTalk(endSmallTalk(inThePark(), 'park-regular-1'), 'park-regular-1');

    expect(memoryOf(state, 'park-regular-1').timesMet).toBe(2);
  });
});

describe('learn_name', () => {
  it("lets the NPC know the Character's name when it is the one from setup", () => {
    const { state, learned } = learnName(inThePark(), 'park-regular-1', 'sam');

    expect(learned).toBe(true);
    expect(memoryOf(state, 'park-regular-1').knowsName).toBe(true);
    expect(state.people['park-regular-2']).toBeUndefined();
  });

  it('changes nothing when the NPC misheard it', () => {
    const before = inThePark();

    const { state, learned } = learnName(before, 'park-regular-1', 'Pam');

    expect(learned).toBe(false);
    expect(state).toBe(before);
  });
});

describe('lastTopic', () => {
  it('overwrites the topic talked about last time', () => {
    const first = rememberTopic(inThePark(), 'park-regular-1', 'the rain');

    const state = rememberTopic(first, 'park-regular-1', 'a new puppy');

    expect(memoryOf(state, 'park-regular-1').lastTopic).toBe('a new puppy');
  });

  it('keeps the old topic when the Recap gives none', () => {
    const first = rememberTopic(inThePark(), 'park-regular-1', 'the rain');

    expect(rememberTopic(first, 'park-regular-1', undefined)).toBe(first);
    expect(rememberTopic(first, 'park-regular-1', '  ')).toBe(first);
  });
});

describe('what Familiarity never gives', () => {
  it('never makes anything cheaper', () => {
    const cafe: GameState = { ...createSave(TEST_SETUP), placeId: 'cafe' };
    const friend: NpcMemory = { ...memoryOf(cafe, 'barista'), familiarity: FAMILIARITY.tierThresholds.friend };
    const latte = { items: [{ item: 'latte', quantity: 1 }] };
    const paid = (state: GameState) => applyInteractionOutcome(state, INTERACTIONS.orderDrink, { kind: 'success', args: latte }).result;

    expect(paid({ ...cafe, people: { barista: friend } })).toEqual(paid(cafe));
  });
});
