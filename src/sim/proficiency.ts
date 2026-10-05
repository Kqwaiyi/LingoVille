import { weighRecapEvidence, type EvidenceLine, type HelpShown } from './helpEvidence.ts';
import type { GameState } from './state.ts';
import { PROFICIENCY, PROFICIENCY_STEPS, type ProficiencyStep } from './tuning.ts';

/** What a finished conversation tells the sim about the Player's Language Proficiency. */
export type ConversationEvidence = {
  /** The Recap's CEFR estimate. */
  cefrEstimate: ProficiencyStep;
  lines: EvidenceLine[];
  helpLog: HelpShown[];
  /** How many of the Player's turns the NPC couldn't make sense of at all. */
  notUnderstoodTurns: number;
};

/** How much a conversation counts for its length: a very short one counts very little, and one where the Player never spoke counts nothing. */
function lengthWeight(lines: EvidenceLine[]) {
  const playerTurns = lines.filter((line) => line.speaker === 'player').length;
  if (playerTurns === 0) return 0;
  return playerTurns <= PROFICIENCY.shortConversation.maxPlayerTurns ? PROFICIENCY.shortConversation.weight : 1;
}

/**
 * The step the score falls in, read with a buffer: the step only changes once
 * the score is past a boundary by `stepBuffer`, so it doesn't flicker. Step n
 * runs from n to n + 1 on the score.
 */
function stepFor(score: number, current: ProficiencyStep): ProficiencyStep {
  let at = PROFICIENCY_STEPS.indexOf(current);
  while (at < PROFICIENCY_STEPS.length - 1 && score >= at + 1 + PROFICIENCY.stepBuffer) at++;
  while (at > 0 && score < at - PROFICIENCY.stepBuffer) at--;
  return PROFICIENCY_STEPS[at]!;
}

const higherStep = (a: ProficiencyStep, b: ProficiencyStep) => (PROFICIENCY_STEPS.indexOf(b) > PROFICIENCY_STEPS.indexOf(a) ? b : a);

/**
 * Moves the hidden Proficiency score partway toward the Recap's estimate after
 * a finished conversation: faster for the first few conversations, so a wrong
 * self-assessment corrects itself early. Very short conversations count very
 * little, each turn the NPC couldn't make sense of pulls toward a lower level,
 * and turns that leaned on Help count for less. Help only ever reduces how much
 * a conversation counts: it never lowers the estimate. The current step follows
 * the score both ways; the highest step reached only ever goes up.
 */
export function applyRecapEvidence(state: GameState, evidence: ConversationEvidence): GameState {
  const { cefrEstimate, lines, helpLog } = evidence;
  const weight = lengthWeight(lines) * weighRecapEvidence({ cefrEstimate, lines, helpLog }).weight;
  if (weight === 0) return state;
  const { progression } = state;
  // Each turn the NPC couldn't make sense of is evidence of a lower level than the estimate.
  const target = Math.max(0, PROFICIENCY.stepCentre[cefrEstimate] - PROFICIENCY.notUnderstoodPull * evidence.notUnderstoodTurns);
  const rate = progression.evidenceSoFar < PROFICIENCY.fastStartInteractions ? PROFICIENCY.fastStartUpdateRate : PROFICIENCY.updateRate;
  const proficiencyScore = progression.proficiencyScore + rate * weight * (target - progression.proficiencyScore);
  const proficiencyStep = stepFor(proficiencyScore, state.proficiencyStep);
  return {
    ...state,
    proficiencyStep,
    progression: {
      ...progression,
      proficiencyScore,
      evidenceSoFar: progression.evidenceSoFar + weight,
      highestStep: higherStep(progression.highestStep, proficiencyStep),
    },
  };
}
