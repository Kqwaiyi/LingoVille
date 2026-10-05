import { describe, expect, it } from 'vitest';
import {
  isOutOfPatience,
  isUnreadableTranscript,
  losePatience,
  newPlayerTurn,
  npcExpression,
  PATIENCE,
  PROFICIENCY_STEP_TABLE,
  startPatience,
  type Patience,
  type ProficiencyStep,
} from './index.ts';

/** Loses Patience over `turns` separate player turns. */
function afterUnintelligibleTurns(patience: Patience, turns: number) {
  for (let i = 0; i < turns; i++) patience = losePatience(newPlayerTurn(patience));
  return patience;
}

describe('Patience', () => {
  it.each(Object.keys(PROFICIENCY_STEP_TABLE) as ProficiencyStep[])('starts from the step table at %s', (step) => {
    const start = startPatience(step);
    const { startingPatience } = PROFICIENCY_STEP_TABLE[step];

    expect(isOutOfPatience(afterUnintelligibleTurns(start, startingPatience - 1))).toBe(false);
    expect(isOutOfPatience(afterUnintelligibleTurns(start, startingPatience))).toBe(true);
  });

  it('costs at most one per player turn, however many times that turn is not understood', () => {
    const turn = newPlayerTurn(startPatience('A1'));

    expect(losePatience(losePatience(turn))).toEqual(losePatience(turn));
  });

  it('never goes below zero', () => {
    const out = afterUnintelligibleTurns(startPatience('C2'), PROFICIENCY_STEP_TABLE.C2.startingPatience);

    expect(afterUnintelligibleTurns(out, 3).left).toBe(0);
  });

  it('counts each turn the NPC could not make sense of once, even after it has run out', () => {
    const turn = newPlayerTurn(startPatience('C2'));

    expect(losePatience(losePatience(turn)).turnsNotUnderstood).toBe(1);
    expect(afterUnintelligibleTurns(startPatience('C2'), PROFICIENCY_STEP_TABLE.C2.startingPatience + 2).turnsNotUnderstood).toBe(
      PROFICIENCY_STEP_TABLE.C2.startingPatience + 2,
    );
  });

  it('shows on the NPC’s face: relaxed at the start, puzzled as it wears thin, strained near the end', () => {
    const start = startPatience('A1');
    const { startingPatience } = PROFICIENCY_STEP_TABLE.A1;

    expect(npcExpression(start)).toBe('relaxed');
    expect(npcExpression(afterUnintelligibleTurns(start, 1))).toBe('puzzled');
    expect(npcExpression(afterUnintelligibleTurns(start, startingPatience - PATIENCE.strainedAtOrBelow))).toBe('strained');
  });
});

describe('isUnreadableTranscript', () => {
  it.each(['', '   ', '???', '…', '!!! ...'])('treats %j as unreadable', (text) => {
    expect(isUnreadableTranscript(text)).toBe(true);
  });

  it.each(['はい', '拿铁', 'latte', 'Kaffee, bitte', 'asdf', '2'])('treats %j as something to make sense of', (text) => {
    expect(isUnreadableTranscript(text)).toBe(false);
  });
});
