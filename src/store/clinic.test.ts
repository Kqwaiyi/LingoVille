import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { NpcSession, ToolResponse } from '../ai/index.ts';
import { INTERACTIONS, placeHours } from '../content/index.ts';
import { CLINIC, CLOCK, createSave, ECONOMY, weekdayOf, type GameState, type IllnessId, type LanguageCode, type OpeningHours } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import { createGameStore, DEV_SETUP, selectConversation, selectTalkWithE, selectTalkWithF } from './index.ts';

const HOUR = 60;
const CLINIC_HOURS = placeHours('clinic', DEV_SETUP.culturePackId) as Exclude<OpeningHours, null>;
/** The first Sunday of the game. */
const SUNDAY = [1, 2, 3, 4, 5, 6, 7].find((day) => weekdayOf(day) === 'sunday')!;
/** A weekday, with the clinic open. */
const WEEKDAY = [1, 2, 3, 4, 5, 6, 7].find((day) => weekdayOf(day) === 'tuesday')!;

type AtTheClinic = {
  day?: number;
  illnessId?: IllnessId | null;
  clinic?: Partial<GameState['clinic']>;
  debts?: GameState['debts'];
  packId?: LanguageCode;
  at?: 'receptionist' | 'pharmacist';
};

/** A store with the Character at the clinic an hour after it opens, by `at`. The test speaks for whoever they talk to. */
function atTheClinic({ day = WEEKDAY, illnessId = 'cold', clinic = {}, debts = [], packId = DEV_SETUP.culturePackId, at = 'receptionist' }: AtTheClinic = {}) {
  const npc = { session: null as NpcSession | null, events: null as VoiceSessionEvents | null, answers: [] as ToolResponse[] };
  const openVoiceSession: OpenVoiceSession = (session, events) => {
    npc.session = session;
    npc.events = events;
    npc.answers = [];
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
    clock: { day, minuteOfDay: (CLINIC_HOURS?.opensAt ?? 9 * HOUR) + HOUR },
    character: { ...save.character, illness: illnessId && { illnessId, onsetDay: day, treated: false } },
    clinic: { ...save.clinic, ...clinic },
    debts,
  };
  const store = createGameStore(game, { openVoiceSession });
  store.getState().enterPlace('clinic');
  store.getState().setInteractable(at);
  return { store, npc };
}

/** Plays on for `gameMinutes`, a frame at a time. */
function waitFor(store: ReturnType<typeof atTheClinic>['store'], gameMinutes: number) {
  const frames = Math.ceil((gameMinutes / CLOCK.gameMinutesPerRealSecond) * (1000 / CLOCK.maxRealDeltaMs));
  for (let i = 0; i < frames; i++) store.getState().advance(CLOCK.maxRealDeltaMs);
}

describe('reception', () => {
  it('checks the Character in on E, and the doctor calls their name once they have waited', () => {
    const { store, npc } = atTheClinic();
    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.checkIn);
    store.getState().talk('E');
    npc.events!.onToolCall({ id: 'call-1', name: 'register_patient', args: { reason: 'a cough' } });
    expect(npc.answers).toEqual([{ result: 'done' }]);
    store.getState().leaveConversation();
    store.getState().skipRecap();

    waitFor(store, CLINIC.waitForDoctorGameMinutes);

    const conversation = selectConversation(store.getState());
    expect(conversation?.interaction).toBe(INTERACTIONS.seeTheDoctor);
    expect(conversation?.npcId).toBe('doctor');
    expect(npc.session?.systemInstruction).toContain('cough, sore throat, runny nose');
    expect(store.getState().game.clinic.checkedInAt).toBeNull();
    expect(store.getState().doctorCall).not.toBeNull();
  });

  it('settles hospital debt on F while it is owed, and offers nothing on F otherwise', () => {
    const owing = atTheClinic({ illnessId: null, debts: [{ kind: 'hospital', amountInShifts: ECONOMY.faintingBillInShifts }] });
    expect(selectTalkWithF(owing.store.getState())).toBe(INTERACTIONS.settleHospitalBill);
    owing.store.getState().talk('F');
    owing.npc.events!.onToolCall({ id: 'call-1', name: 'set_payment_plan', args: { weeks: 3 } });
    expect(owing.npc.answers).toEqual([{ result: 'done' }]);
    expect(owing.store.getState().game.paymentPlans).toEqual([
      { debtKind: 'hospital', instalmentInShifts: ECONOMY.faintingBillInShifts / 3, nextDueDay: owing.store.getState().game.rent.dueDay },
    ]);

    expect(selectTalkWithF(atTheClinic().store.getState())).toBeNull();
  });

  it('is closed on Sundays', () => {
    const { store } = atTheClinic({ day: SUNDAY });

    expect(store.getState().game.placeId).not.toBe('clinic');
    expect(selectTalkWithE(store.getState())).toBeNull();
  });
});

describe('the doctor', () => {
  it("records the prescription for the diagnosis, which the pharmacist then hands over on E", () => {
    const { store, npc } = atTheClinic({ illnessId: 'cold', clinic: { checkedInAt: { day: WEEKDAY, minuteOfDay: 10 * HOUR } } });
    waitFor(store, CLINIC.waitForDoctorGameMinutes);
    npc.events!.onToolCall({ id: 'call-1', name: 'diagnose', args: { illness: 'cold' } });
    expect(npc.answers).toEqual([{ result: 'done' }]);
    expect(store.getState().game.clinic.prescription).toBe('cold-medicine');
    store.getState().leaveConversation();
    store.getState().skipRecap();

    store.getState().setInteractable('pharmacist');
    expect(selectTalkWithE(store.getState())).toBe(INTERACTIONS.getMedicine);
    store.getState().talk('E');
    expect(npc.session?.systemInstruction).toContain('(medicine id "cold-medicine")');
    npc.events!.onToolCall({ id: 'call-2', name: 'dispense', args: { medicine: 'cold-medicine' } });

    expect(npc.answers).toEqual([{ result: 'served' }]);
    expect(store.getState().game.character.illness).toBeNull();
  });
});

describe('the pharmacist', () => {
  it('has nothing to dispense without a prescription, so E chats', () => {
    const { store } = atTheClinic({ at: 'pharmacist' });

    expect(selectTalkWithE(store.getState())).toBeNull();
  });
});
