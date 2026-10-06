import { describe, expect, it } from 'vitest';
import type { NpcSession, ToolResponse } from '../ai/index.ts';
import { createSave } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import { createGameStore, DEV_SETUP, selectClosingCard, selectConversation, selectTalkWithF } from './index.ts';
import { recordingSaves } from './testSaves.ts';

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

/** At the café counter at 09:00 on day 2, the Character named Sam (the dev setup's name). */
function atTheCounter() {
  const { saves, written } = recordingSaves();
  const { npc, openVoiceSession } = fakeNpc();
  const game = createSave(DEV_SETUP);
  const store = createGameStore({ ...game, placeId: 'cafe', clock: { day: 2, minuteOfDay: 9 * 60 } }, {
    saves,
    openVoiceSession,
    requestRecap: () => new Promise(() => {}),
  });
  store.getState().setInteractable('barista');
  return { store, npc, written };
}

const APPLICATION = { name: 'Sam', start: 'tomorrow' };

describe('asking the barista for work', () => {
  it('asks for work with F, and hires the Character under their own name, saving the Job', () => {
    const { store, npc, written } = atTheCounter();

    store.getState().talk('F');
    expect(selectConversation(store.getState())).toMatchObject({ interaction: { id: 'ask-barista-for-work' } });
    store.getState().sendTypedLine('サムです。明日から働けます。');
    npc.calls('hire_applicant', APPLICATION);
    npc.says('採用です！');

    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(store.getState().game.possessions.jobsHired).toEqual(['barista']);
    expect(written.at(-1)?.game.possessions.jobsHired).toEqual(['barista']);
    expect(selectClosingCard(store.getState())).toMatchObject({ kind: 'success', hired: 'barista' });
  });

  it('tells the barista they misheard a name that is not the Character’s, and the conversation goes on', () => {
    const { store, npc } = atTheCounter();
    store.getState().talk('F');
    store.getState().sendTypedLine('サムです。');

    npc.calls('hire_applicant', { ...APPLICATION, name: 'Pam' });

    expect(npc.answers).toEqual([{ result: 'wrong_name' }]);
    expect(selectConversation(store.getState())?.outcome).toBeNull();
    expect(store.getState().game.possessions.jobsHired).toEqual([]);

    npc.calls('hire_applicant', APPLICATION);
    expect(npc.answers.at(-1)).toEqual({ result: 'done' });
  });

  it('can be tried again after failing', () => {
    const { store, npc } = atTheCounter();
    store.getState().talk('F');
    for (let turn = 0; turn < 10 && !selectConversation(store.getState())?.outcome; turn++) {
      store.getState().sendTypedLine('あの…');
      npc.calls('not_understood', { reason: 'unintelligible' });
    }
    expect(selectConversation(store.getState())?.outcome).toMatchObject({ kind: 'failure' });
    store.getState().leaveConversation();
    store.getState().skipRecap();

    store.getState().talk('F');

    expect(selectConversation(store.getState())).toMatchObject({ interaction: { id: 'ask-barista-for-work' } });
  });

  it('hires a cashier the same way: F at the cashier with no shopping, the name check, and a retry after failing', () => {
    const { store, npc, written } = atTheCounter();
    store.setState({ game: { ...store.getState().game, placeId: 'supermarket' } });
    store.getState().setInteractable('cashier');

    store.getState().talk('F');
    expect(selectConversation(store.getState())).toMatchObject({ interaction: { id: 'ask-cashier-for-work' } });
    npc.calls('hire_applicant', { ...APPLICATION, name: 'Pam' });
    expect(npc.answers).toEqual([{ result: 'wrong_name' }]);
    npc.calls('hire_applicant', APPLICATION);
    npc.says('採用です！');

    expect(npc.answers.at(-1)).toEqual({ result: 'done' });
    expect(written.at(-1)?.game.possessions.jobsHired).toEqual(['cashier']);
    expect(selectClosingCard(store.getState())).toMatchObject({ kind: 'success', hired: 'cashier' });
    store.getState().leaveConversation();
    store.getState().skipRecap();
    expect(selectTalkWithF(store.getState())).toBeNull();
  });

  it('offers nothing more on F once the Character is hired', () => {
    const { store, npc } = atTheCounter();
    store.getState().talk('F');
    npc.calls('hire_applicant', APPLICATION);
    store.getState().leaveConversation();
    store.getState().skipRecap();

    expect(selectTalkWithF(store.getState())).toBeNull();
  });
});
