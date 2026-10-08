import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { NpcSession, ToolResponse } from '../ai/index.ts';
import { INTERACTIONS, placeHours } from '../content/index.ts';
import {
  createSave,
  ECONOMY,
  LIFE_SKILLS,
  MOOD,
  weekdayOf,
  type GameState,
  type LanguageCode,
  type OpeningHours,
} from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import { createGameStore, DEV_SETUP, selectConversation, selectSmallTalkKey, selectTalkWithE, selectTalkWithF } from './index.ts';

const HOUR = 60;
const BATHHOUSE = placeHours('bathhouse', DEV_SETUP.culturePackId) as Exclude<OpeningHours, null>;
/** The first Sunday of the game. */
const SUNDAY = [1, 2, 3, 4, 5, 6, 7].find((day) => weekdayOf(day) === 'sunday')!;

type AtTheBathhouse = { day?: number; memberUntilDay?: number | null; packId?: LanguageCode; at?: 'attendant' | 'gym' };

/** A store with the Character at the bathhouse an hour after it opens. The test speaks for the attendant. */
function atTheBathhouse({ day = 2, memberUntilDay = null, packId = DEV_SETUP.culturePackId, at = 'attendant' }: AtTheBathhouse = {}) {
  const npc = { session: null as NpcSession | null, events: null as VoiceSessionEvents | null, answers: [] as ToolResponse[] };
  const openVoiceSession: OpenVoiceSession = (session, events) => {
    npc.session = session;
    npc.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: () => {},
      sendToolResponse: (_, response) => npc.answers.push(response),
      close: () => {},
    };
  };
  const save = createSave({ ...DEV_SETUP, targetLanguage: packId, culturePackId: packId });
  const game: GameState = {
    ...save,
    clock: { day, minuteOfDay: BATHHOUSE.opensAt + HOUR },
    possessions: { ...save.possessions, gymMembershipUntilDay: memberUntilDay },
  };
  const store = createGameStore(game, { openVoiceSession });
  store.getState().enterPlace('bathhouse');
  store.getState().setInteractable(at);
  return { store, npc };
}

describe('the bathhouse attendant', () => {
  it('sells a bath on E, joins the gym on F, and chats on T', () => {
    const { store } = atTheBathhouse();

    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.buyBathEntry);
    expect(selectTalkWithF(store.getState())).toBe(INTERACTIONS.joinTheGym);
    expect(selectSmallTalkKey(store.getState())).toBe('T');
  });

  it('a bath charges the entry and lifts Mood by the bathhouse lift', () => {
    const { store, npc } = atTheBathhouse();
    const { mood, moneyInShifts } = store.getState().game.character;
    store.getState().talk('E');

    npc.events!.onToolCall({ id: 'call-1', name: 'admit', args: { options: ['towel'] } });

    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(store.getState().game.character.moneyInShifts).toBeLessThan(moneyInShifts);
    expect(store.getState().game.character.mood).toBe(mood + MOOD.changes.goalInteractionSuccess + MOOD.changes.comfortPurchase.bathhouse);
  });

  it('joining on F gives 30 days at the gym, after which F has nothing to offer until it runs out', () => {
    const { store, npc } = atTheBathhouse();
    store.getState().talk('F');

    npc.events!.onToolCall({ id: 'call-1', name: 'register_member', args: { kind: 'join' } });

    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(store.getState().game.possessions.gymMembershipUntilDay).toBe(2 + ECONOMY.gymMembershipDays - 1);
    store.getState().leaveConversation();
    store.getState().skipRecap();
    expect(selectTalkWithF(store.getState())).toBeNull();
  });

  it('renews a membership that has run out on F', () => {
    const { store } = atTheBathhouse({ memberUntilDay: 1 });

    store.getState().talk('F');

    expect(selectConversation(store.getState())?.interaction).toBe(INTERACTIONS.renewGymMembership);
  });

  it('is at work on Sundays in the de pack, when nearly everything else is shut', () => {
    const { store } = atTheBathhouse({ day: SUNDAY, packId: 'de' });

    store.getState().talk('E');

    expect(selectConversation(store.getState())?.interaction).toBe(INTERACTIONS.buyBathEntry);
  });
});

describe('the gym', () => {
  it('works out once a day for a member: Fitness XP, a small Mood lift and an hour gone', () => {
    const { store } = atTheBathhouse({ memberUntilDay: 10, at: 'gym' });
    const { clock, character } = store.getState().game;

    store.getState().workOut();

    const after = store.getState().game;
    expect(after.progression.lifeSkillXp.fitness).toBeGreaterThan(0);
    expect(after.character.mood).toBeGreaterThan(character.mood);
    expect(after.clock.minuteOfDay).toBe(clock.minuteOfDay + LIFE_SKILLS.gymSessionGameMinutes);

    store.getState().workOut();
    expect(store.getState().game).toBe(after);
    expect(store.getState().toast).toEqual({ kind: 'gymRefused', refusal: 'doneToday' });
  });

  it('turns away a Character who is not a member, or whose membership has run out', () => {
    const neverJoined = atTheBathhouse({ at: 'gym' }).store;
    neverJoined.getState().workOut();
    expect(neverJoined.getState().toast).toEqual({ kind: 'gymRefused', refusal: 'notMember' });
    expect(neverJoined.getState().game.progression.lifeSkillXp.fitness).toBe(0);

    const runOut = atTheBathhouse({ memberUntilDay: 1, at: 'gym' }).store;
    runOut.getState().workOut();
    expect(runOut.getState().toast).toEqual({ kind: 'gymRefused', refusal: 'expired' });
  });
});
