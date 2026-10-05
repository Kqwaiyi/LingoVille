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
  return moveScore(state, recapTarget(cefrEstimate, evidence.notUnderstoodTurns), weight);
}

/** Where the Recap's estimate pulls the score: each turn the NPC couldn't make sense of is evidence of a lower level than the estimate. */
function recapTarget(cefrEstimate: ProficiencyStep, notUnderstoodTurns: number) {
  return Math.max(0, PROFICIENCY.stepCentre[cefrEstimate] - PROFICIENCY.notUnderstoodPull * notUnderstoodTurns);
}

/** One Shift Customer, as Proficiency evidence: what was said, the Help used, and whether the Player served their order. */
export type ShiftCustomerEvidence = {
  lines: EvidenceLine[];
  helpLog: HelpShown[];
  notUnderstoodTurns: number;
  served: boolean;
};

/** What a finished Shift tells the sim about the Player's Language Proficiency. */
export type ShiftEvidence = {
  /** The combined Shift Recap's CEFR estimate. */
  cefrEstimate: ProficiencyStep;
  /** The step the Shift Customers spoke at. */
  listenedAt: ProficiencyStep;
  /** The customers the Player dealt with, in order. One lost to the network isn't among them. */
  customers: ShiftCustomerEvidence[];
};

/**
 * Moves the hidden Proficiency score after a Shift, as one piece of evidence however many customers it had.
 * The combined Recap's estimate counts as for a conversation, from everything the Player said to the customers.
 * The Shift's results count as listening evidence: serving every order is evidence of the step the customers
 * spoke at, and each missed one pulls lower. A customer's lines the Player had translated count for nothing as listening.
 */
export function applyShiftEvidence(state: GameState, evidence: ShiftEvidence): GameState {
  const { cefrEstimate, customers } = evidence;
  const weighed = customers.map(({ lines, helpLog }) => weighRecapEvidence({ cefrEstimate, lines, helpLog }).lineWeights);
  const lines = customers.flatMap((customer) => customer.lines);
  const lineWeights = weighed.flat();
  const speakingWeight = lineWeights.length === 0 ? 0 : (lengthWeight(lines) * lineWeights.reduce((sum, w) => sum + w, 0)) / lineWeights.length;
  const speakingTarget = recapTarget(cefrEstimate, customers.reduce((sum, customer) => sum + customer.notUnderstoodTurns, 0));

  // How much each customer counts as listening evidence: the share of their lines the Player heard untranslated.
  const listened = customers.map(({ lines: said }, i) => {
    const npcWeights = weighed[i]!.filter((_, line) => said[line]!.speaker === 'npc');
    return npcWeights.length === 0 ? 0 : npcWeights.reduce((sum, w) => sum + w, 0) / npcWeights.length;
  });
  const listeningWeight = listened.length === 0 ? 0 : listened.reduce((sum, w) => sum + w, 0) / listened.length;
  const missed = listened.reduce((sum, w, i) => sum + (customers[i]!.served ? 0 : w), 0);
  const listeningTarget =
    PROFICIENCY.stepCentre[evidence.listenedAt] - (listeningWeight === 0 ? 0 : PROFICIENCY.shiftListening.missedOrderPull * (missed / (listeningWeight * listened.length)));

  // Speaking and listening each count up to their share of one piece of evidence.
  const listeningShare = PROFICIENCY.shiftListening.weight * listeningWeight;
  const total = speakingWeight + listeningShare;
  if (total === 0) return state;
  const target = Math.max(0, (speakingWeight * speakingTarget + listeningShare * listeningTarget) / total);
  return moveScore(state, target, total / (1 + PROFICIENCY.shiftListening.weight));
}

/**
 * Moves the score partway toward `target`, by the update rate times `weight` (0 to 1): faster for the first few pieces of
 * evidence. The current step follows the score both ways; the highest step reached only ever goes up.
 */
function moveScore(state: GameState, target: number, weight: number): GameState {
  if (weight === 0) return state;
  const { progression } = state;
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
