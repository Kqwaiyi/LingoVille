import { describe, expect, it } from 'vitest';
import {
  applyRecapEvidence,
  applyShiftEvidence,
  createSave,
  PROFICIENCY,
  PROFICIENCY_STEPS,
  type ConversationEvidence,
  type EvidenceLine,
  type GameState,
  type HelpShown,
  type ProficiencyStep,
  type ShiftCustomerEvidence,
  type ShiftEvidence,
  type StartingStep,
} from './index.ts';
import { TEST_SETUP } from './testSetup.ts';

/** A conversation with this many player turns, each answering an NPC line. */
function linesWithPlayerTurns(playerTurns: number): EvidenceLine[] {
  return Array.from({ length: playerTurns }, (_, i): EvidenceLine[] => [
    { speaker: 'npc', text: `NPC line ${i}` },
    { speaker: 'player', text: `Player turn ${i}` },
  ]).flat();
}

/** A Help log where a hint repeating each of the full conversation's player turns showed just before it. */
function everyTurnCopiedFromAHint(): HelpShown[] {
  return linesWithPlayerTurns(6).flatMap((line, i) => (line.speaker === 'player' ? [{ afterLine: i, kind: 'hint', text: line.text }] : []));
}

/** A full conversation: enough player turns to count in full, with no Help and nothing misunderstood. */
function evidence(change: Partial<ConversationEvidence> = {}): ConversationEvidence {
  return { cefrEstimate: 'B1', lines: linesWithPlayerTurns(6), helpLog: [], notUnderstoodTurns: 0, ...change };
}

/** A save that has already had its first conversations assessed, so the fast start is over. */
function settledSave(startingStep: StartingStep = 'A1'): GameState {
  const state = createSave({ ...TEST_SETUP, startingStep });
  return { ...state, progression: { ...state.progression, evidenceSoFar: PROFICIENCY.fastStartInteractions } };
}

describe('applyRecapEvidence', () => {
  it('moves the score partway toward the Recap’s estimate', () => {
    const state = settledSave('A1');
    const before = state.progression.proficiencyScore;
    const target = PROFICIENCY.stepCentre.B1;

    const after = applyRecapEvidence(state, evidence({ cefrEstimate: 'B1' }));

    expect(after.progression.proficiencyScore).toBeCloseTo(before + PROFICIENCY.updateRate * (target - before));
  });

  it('moves faster during the first conversations, then settles to the normal rate', () => {
    let state = createSave({ ...TEST_SETUP, startingStep: 'B2' });
    const rates: number[] = [];
    for (let i = 0; i < PROFICIENCY.fastStartInteractions + 2; i++) {
      const before = state.progression.proficiencyScore;
      state = applyRecapEvidence(state, evidence({ cefrEstimate: 'A1' }));
      rates.push((before - state.progression.proficiencyScore) / (before - PROFICIENCY.stepCentre.A1));
    }

    const fast = rates.slice(0, PROFICIENCY.fastStartInteractions);
    const normal = rates.slice(PROFICIENCY.fastStartInteractions);
    fast.forEach((rate) => expect(rate).toBeCloseTo(PROFICIENCY.fastStartUpdateRate));
    normal.forEach((rate) => expect(rate).toBeCloseTo(PROFICIENCY.updateRate));
  });

  it('keeps the fast start through quick exchanges, which barely count', () => {
    let state = createSave({ ...TEST_SETUP, startingStep: 'A1' });
    for (let i = 0; i < PROFICIENCY.fastStartInteractions; i++) state = applyRecapEvidence(state, evidence({ lines: linesWithPlayerTurns(1) }));
    const before = state.progression.proficiencyScore;

    const after = applyRecapEvidence(state, evidence({ cefrEstimate: 'B1' })).progression.proficiencyScore;

    expect((after - before) / (PROFICIENCY.stepCentre.B1 - before)).toBeCloseTo(PROFICIENCY.fastStartUpdateRate);
  });

  it.each([1, 2])('counts a conversation of %i player turns for very little', (playerTurns) => {
    const state = settledSave('A1');
    const moved = (lines: EvidenceLine[]) =>
      applyRecapEvidence(state, evidence({ lines })).progression.proficiencyScore - state.progression.proficiencyScore;

    expect(moved(linesWithPlayerTurns(playerTurns)) / moved(linesWithPlayerTurns(6))).toBeCloseTo(
      PROFICIENCY.shortConversation.weight,
    );
  });

  it('counts a conversation in full once it has more than a couple of player turns', () => {
    const state = settledSave('A1');
    const moved = (lines: EvidenceLine[]) =>
      applyRecapEvidence(state, evidence({ lines })).progression.proficiencyScore - state.progression.proficiencyScore;

    expect(moved(linesWithPlayerTurns(PROFICIENCY.shortConversation.maxPlayerTurns + 1))).toBeCloseTo(
      moved(linesWithPlayerTurns(6)),
    );
  });

  it('takes each turn the NPC could not make sense of as evidence of a lower level', () => {
    const state = settledSave('B1');
    const scoreAfter = (notUnderstoodTurns: number) =>
      applyRecapEvidence(state, evidence({ cefrEstimate: 'B1', notUnderstoodTurns })).progression.proficiencyScore;

    expect(scoreAfter(1)).toBeLessThan(state.progression.proficiencyScore);
    expect(scoreAfter(2)).toBeLessThan(scoreAfter(1));
    expect(scoreAfter(3)).toBeLessThan(scoreAfter(2));
  });

  it('counts a conversation that leaned on Help for less', () => {
    const state = settledSave('A1');
    const moved = (helpLog: HelpShown[]) =>
      applyRecapEvidence(state, evidence({ cefrEstimate: 'B2', helpLog })).progression.proficiencyScore -
      state.progression.proficiencyScore;

    expect(moved(everyTurnCopiedFromAHint())).toBeGreaterThan(0);
    expect(moved(everyTurnCopiedFromAHint())).toBeLessThan(moved([]));
  });

  it('never lets Help lower the score: with a lower estimate, Help only softens the drop', () => {
    const state = settledSave('B2');
    const scoreAfter = (helpLog: HelpShown[]) =>
      applyRecapEvidence(state, evidence({ cefrEstimate: 'A1', helpLog })).progression.proficiencyScore;

    expect(scoreAfter(everyTurnCopiedFromAHint())).toBeLessThan(state.progression.proficiencyScore);
    expect(scoreAfter(everyTurnCopiedFromAHint())).toBeGreaterThan(scoreAfter([]));
  });

  it('does not move the score when the Player never spoke', () => {
    const state = settledSave('A1');

    const after = applyRecapEvidence(state, evidence({ lines: [{ speaker: 'npc', text: 'Hello!' }] }));

    expect(after.progression.proficiencyScore).toBe(state.progression.proficiencyScore);
  });

  it.each([
    { claimed: 'B2', real: 'A1' },
    { claimed: 'A1', real: 'B2' },
    { claimed: 'A2', real: 'B1' },
  ] as const)('corrects a self-assessment of $claimed to $real within the first conversations', ({ claimed, real }) => {
    let state = createSave({ ...TEST_SETUP, startingStep: claimed });
    for (let i = 0; i < PROFICIENCY.fastStartInteractions; i++) state = applyRecapEvidence(state, evidence({ cefrEstimate: real }));

    expect(state.proficiencyStep).toBe(real);
  });

  it('keeps the step it had while the score hovers just around a boundary', () => {
    // Just inside A2, next to the A1–A2 boundary.
    const boundary = PROFICIENCY_STEPS.indexOf('A2');
    const start = settledSave('A2');
    let state: GameState = { ...start, progression: { ...start.progression, proficiencyScore: boundary + 0.02 } };
    let dippedBelow = false;
    for (let i = 0; i < 6; i++) {
      state = applyRecapEvidence(state, evidence({ cefrEstimate: i % 2 === 0 ? 'A1' : 'A2' }));
      dippedBelow ||= state.progression.proficiencyScore < boundary;
      expect(state.proficiencyStep).toBe('A2');
    }
    expect(dippedBelow).toBe(true);
  });

  it('follows the score in both directions, changing step only once the score is past the buffer', () => {
    let state = settledSave('A1');
    const seen: ProficiencyStep[] = [];
    const conversations = [...Array<ProficiencyStep>(40).fill('C2'), ...Array<ProficiencyStep>(40).fill('A1')];
    for (const cefrEstimate of conversations) {
      const before = PROFICIENCY_STEPS.indexOf(state.proficiencyStep);
      state = applyRecapEvidence(state, evidence({ cefrEstimate }));
      const { proficiencyStep: step, progression } = state;
      // A step runs from its index to its index + 1 on the score.
      const at = PROFICIENCY_STEPS.indexOf(step);
      if (at !== before) seen.push(step);
      if (at > before) expect(progression.proficiencyScore).toBeGreaterThanOrEqual(at + PROFICIENCY.stepBuffer);
      if (at < before) expect(progression.proficiencyScore).toBeLessThan(at + 1 - PROFICIENCY.stepBuffer);
    }

    expect(seen).toEqual(['A2', 'B1', 'B2', 'C1', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']);
  });

  it('remembers the highest step reached, which only ever goes up', () => {
    let state = settledSave('A2');
    const highest: ProficiencyStep[] = [];
    for (const cefrEstimate of [...Array<ProficiencyStep>(30).fill('B2'), ...Array<ProficiencyStep>(30).fill('A1')]) {
      state = applyRecapEvidence(state, evidence({ cefrEstimate }));
      highest.push(state.progression.highestStep);
    }

    expect(state.proficiencyStep).toBe('A1');
    expect(state.progression.highestStep).toBe('B2');
    expect(new Set(highest)).toEqual(new Set(['A2', 'B1', 'B2']));
    expect(highest.map((step) => PROFICIENCY_STEPS.indexOf(step))).toEqual(
      highest.map((step) => PROFICIENCY_STEPS.indexOf(step)).toSorted((a, b) => a - b),
    );
  });
});

describe('applyShiftEvidence', () => {
  /** A Shift Customer who said their order, and whom the Player served without a word: listening only. */
  const listenedTo = (served: boolean): ShiftCustomerEvidence => ({
    lines: [{ speaker: 'npc', text: 'A latte, please.' }],
    helpLog: [],
    notUnderstoodTurns: 0,
    served,
  });

  /** A Shift of five customers at B1, served or not, with a Recap that saw too little speaking to judge. */
  const shift = (served: boolean[], change: Partial<ShiftEvidence> = {}): ShiftEvidence => ({
    cefrEstimate: 'A1',
    listenedAt: 'B1',
    customers: served.map(listenedTo),
    ...change,
  });

  it('counts serving every order as listening evidence of the step the customers spoke at, even when the Player never spoke', () => {
    const state = settledSave('A1');
    const before = state.progression.proficiencyScore;

    const after = applyShiftEvidence(state, shift([true, true, true, true, true]));

    expect(after.progression.proficiencyScore).toBeGreaterThan(before);
    expect(after.progression.proficiencyScore).toBeLessThan(PROFICIENCY.stepCentre.B1);
  });

  it('takes each missed order as evidence of a lower level', () => {
    const state = settledSave('B1');
    const score = (served: boolean[]) => applyShiftEvidence(state, shift(served)).progression.proficiencyScore;

    expect(score([true, true, true, true, false])).toBeLessThan(score([true, true, true, true, true]));
    expect(score([false, false, false, false, false])).toBeLessThan(score([true, true, true, true, false]));
    expect(score([false, false, false, false, false])).toBeLessThan(state.progression.proficiencyScore);
  });

  it('counts a whole Shift as one piece of evidence, however many customers it had', () => {
    const state = settledSave('A1');
    const after = applyShiftEvidence(state, shift(Array.from({ length: 8 }, () => true), { cefrEstimate: 'B1' }));

    expect(after.progression.evidenceSoFar - state.progression.evidenceSoFar).toBeGreaterThan(0);
    expect(after.progression.evidenceSoFar - state.progression.evidenceSoFar).toBeLessThanOrEqual(1);
  });

  it('counts a customer whose lines the Player had translated for nothing as listening evidence', () => {
    const state = settledSave('A1');
    const translated: ShiftCustomerEvidence = {
      ...listenedTo(true),
      helpLog: [{ afterLine: 1, kind: 'translate', text: 'A latte, please.' }],
    };

    const after = applyShiftEvidence(state, { ...shift([]), customers: [translated, translated] });

    expect(after).toEqual(state);
  });

  it('counts a tap-translated customer for nothing as listening, even if only one of their lines was translated', () => {
    const state = settledSave('A1');
    const partly: ShiftCustomerEvidence = {
      lines: [
        { speaker: 'npc', text: 'Hello!' },
        { speaker: 'npc', text: 'A large iced tea with lemon, please.' },
      ],
      helpLog: [{ afterLine: 2, kind: 'translate', text: 'A large iced tea with lemon, please.' }],
      notUnderstoodTurns: 0,
      served: true,
    };

    expect(applyShiftEvidence(state, { ...shift([]), customers: [partly, partly] })).toEqual(state);
  });

  it('also counts what the Player said, as the Recap judged it', () => {
    const state = settledSave('A1');
    const talked: ShiftCustomerEvidence = { lines: linesWithPlayerTurns(3), helpLog: [], notUnderstoodTurns: 0, served: true };
    const score = (cefrEstimate: ProficiencyStep) =>
      applyShiftEvidence(state, { cefrEstimate, listenedAt: 'A1', customers: [talked, talked] }).progression.proficiencyScore;

    expect(score('B2')).toBeGreaterThan(score('A1'));
  });
});
