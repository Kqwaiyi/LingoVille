import { describe, expect, it } from 'vitest';
import type { NpcSession, ToolResponse } from '../ai/index.ts';
import { createSave, type GameState } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  selectClosingCard,
  selectConversation,
  selectDebts,
  selectHeldStill,
  selectMoneyInShifts,
} from './index.ts';
import { recordingSaves } from './testSaves.ts';

const HOUR = 60;

/** A stand-in NPC the test speaks for, recording the session it was opened with and the answers to its tool calls. */
function fakeNpc() {
  const npc = {
    session: null as NpcSession | null,
    events: null as VoiceSessionEvents | null,
    answers: [] as ToolResponse[],
    says(text: string) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      npc.events!.onToolCall({ id: `call-${npc.answers.length}`, name, args });
    },
  };
  const openVoiceSession: OpenVoiceSession = (session, events) => {
    npc.session = session;
    npc.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: () => {},
      sendToolResponse: (_, response) => void npc.answers.push(response),
      close: () => {},
    };
  };
  return { npc, openVoiceSession };
}

/** At home in the ja pack on `day` at `minuteOfDay`, with 3 Shifts in hand and this week's rent unpaid. */
function atHome(day: number, minuteOfDay: number, change: (state: GameState) => GameState = (s) => s) {
  const { saves } = recordingSaves();
  const { npc, openVoiceSession } = fakeNpc();
  const game = createSave(DEV_SETUP);
  const store = createGameStore(change({ ...game, clock: { day, minuteOfDay }, character: { ...game.character, moneyInShifts: 3 } }), {
    saves,
    openVoiceSession,
    requestRecap: () => new Promise(() => {}),
  });
  return { store, npc };
}

const inRentDebt = (state: GameState): GameState => ({ ...state, debts: [{ kind: 'rent', amountInShifts: 0.5 }] });
const reachedB1 = (state: GameState): GameState => ({ ...state, progression: { ...state.progression, highestStep: 'B1' } });

describe('the landlord in the hallway', () => {
  it('catches the Character on the way past when rent is due and unpaid, and speaks first', () => {
    const { store, npc } = atHome(7, 9 * HOUR);

    store.getState().setInteractable('landlord');

    expect(selectConversation(store.getState())).toMatchObject({ npcId: 'landlord', interaction: { id: 'rent-reminder' } });
    expect(npc.session?.openingScene).toMatch(/hallway/);
    // ¥6,000: a week at the A1 Newcomer Discount.
    expect(npc.session?.systemInstruction).toContain('Altogether the tenant owes ¥6,000');
  });

  it('stops the Character in their tracks: walking keys held as the landlord comes up count only once let go', () => {
    const { store } = atHome(7, 9 * HOUR);
    expect(selectHeldStill(store.getState())).toBe(false);

    store.getState().setInteractable('landlord');
    expect(selectHeldStill(store.getState())).toBe(true);

    store.getState().letGoOfWalkKeys();
    expect(selectHeldStill(store.getState())).toBe(false);
  });

  it('reminds the Character once a day: walking past again, they are left be', () => {
    const { store } = atHome(9, 9 * HOUR, inRentDebt);
    store.getState().setInteractable('landlord');
    store.getState().leaveConversation();
    store.getState().setInteractable(null);

    store.getState().setInteractable('landlord');

    expect(selectConversation(store.getState())).toBeNull();
  });

  it('isn’t there before 8:00', () => {
    const { store } = atHome(7, 7 * HOUR + 30);
    store.getState().setInteractable('landlord');
    expect(selectConversation(store.getState())).toBeNull();
  });

  it('leaves the Character be when nothing is due', () => {
    const { store } = atHome(4, 9 * HOUR);
    store.getState().setInteractable('landlord');
    expect(selectConversation(store.getState())).toBeNull();
  });

  it('announces a Newcomer Discount step-down in conversation, with the new rent, once', () => {
    const { store, npc } = atHome(4, 9 * HOUR, reachedB1);

    store.getState().setInteractable('landlord');

    expect(selectConversation(store.getState())).toMatchObject({ interaction: { id: 'newcomer-discount-news' } });
    // ¥9,000: a week at the B1 Newcomer Discount.
    expect(npc.session?.systemInstruction).toContain("From now on the tenant's weekly rent is ¥9,000.");
    store.getState().leaveConversation();
    store.getState().setInteractable(null);
    store.getState().setInteractable('landlord');
    expect(selectConversation(store.getState())).toBeNull();
  });
});

describe('paying the landlord and asking for more time', () => {
  it('pays rent with E: the landlord takes it, and the rent debt is cleared', () => {
    const { store, npc } = atHome(9, 9 * HOUR, inRentDebt);
    store.getState().setInteractable('landlord');
    store.getState().leaveConversation();

    store.getState().talk('E');
    expect(selectConversation(store.getState())).toMatchObject({ interaction: { id: 'pay-rent' } });
    store.getState().sendTypedLine('九千円です');
    npc.calls('accept_rent', { amount: 9000 });

    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(selectDebts(store.getState())).toEqual([]);
    expect(selectMoneyInShifts(store.getState())).toBeCloseTo(1.5);
    npc.says('ありがとうございます。');
    expect(selectClosingCard(store.getState())).toMatchObject({ kind: 'success', paidInShifts: 1.5 });
  });

  it('tells the landlord when the Character offers more than they owe, and the conversation goes on', () => {
    const { store, npc } = atHome(5, 9 * HOUR);
    store.getState().setInteractable('landlord');
    store.getState().talk('E');
    store.getState().sendTypedLine('一万円です');

    npc.calls('accept_rent', { amount: 10000 });

    expect(npc.answers).toEqual([{ result: 'invalid_arguments', error: expect.any(String) }]);
    expect(selectConversation(store.getState())?.outcome).toBeNull();
  });

  it('asks for more time with F, and the closing card says how many days', () => {
    const { store, npc } = atHome(5, 9 * HOUR);
    store.getState().setInteractable('landlord');

    store.getState().talk('F');
    expect(selectConversation(store.getState())).toMatchObject({ interaction: { id: 'ask-for-more-time' } });
    store.getState().sendTypedLine('三日待ってください');
    npc.calls('grant_extension', { days: 3 });
    npc.says('わかりました。');

    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(store.getState().game.rent.extendedThroughDay).toBe(9);
    expect(selectClosingCard(store.getState())).toMatchObject({ kind: 'success', extendedDays: 3 });
  });
});
