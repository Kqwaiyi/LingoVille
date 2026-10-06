import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { NOT_UNDERSTOOD_TOOL } from '../src/ai/index.ts';
import type { NpcCase, TurnTag } from './cases/schema.ts';
import { NpcVerdictSchema, type NpcVerdict } from './judge.ts';
import { interactionById, needsReadBack, type PlayedConversation } from './npcConversation.ts';
import { offTargetLanguage } from './targetLanguage.ts';

// What one played NPC case comes to: the checks a script can make on its own, then the judge's verdict.

export type NpcResult = PlayedConversation & {
  id: string;
  language: NpcCase['targetLanguage'];
  step: NpcCase['step'];
  outcomeMatches: boolean;
  /** Each scripted `noisy` turn the NPC heard, and whether it cost Patience. */
  noisyTurns: { turn: number; understood: boolean }[];
  /** Each scripted `gibberish` turn the NPC heard, and whether it let it pass without costing Patience. */
  gibberishTurns: { turn: number; accepted: boolean }[];
  /** Completion calls made before the player had confirmed a read-back. */
  prematureCompletions: string[];
  /** NPC lines outside the Target Language, and why. */
  offTargetLines: string[];
  /** Completion calls whose arguments the judge found differ from the read-back the player confirmed. */
  argumentsDifferFromReadBack: string[];
  /** The judge's verdict on each NPC line: does it suit the step? */
  stepAppropriate: { line: number; text: string; appropriate: boolean; why: string }[];
  verdict?: NpcVerdict;
  /** The judge's call failed, or its answer didn't cover every NPC line. */
  judgeError?: string;
};

/** Arrays compare in any order: an order of a latte and a tea is the same as a tea and a latte. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    const sorted = (list: unknown[]) => list.map((item) => JSON.stringify(item)).sort();
    return isDeepStrictEqual(sorted(a), sorted(b));
  }
  return isDeepStrictEqual(a, b);
}

function outcomeMatches(c: NpcCase, played: PlayedConversation) {
  if (played.outcome !== c.expected.outcome) return false;
  if (c.expected.outcome !== 'completed') return true;
  const args = (played.completedWith ?? {}) as Record<string, unknown>;
  return Object.entries(c.expected.args).every(([key, value]) => sameValue(args[key], value));
}

/**
 * A completion may only come once the player has confirmed a read-back: after a scripted turn marked `confirms`.
 * A goal with no effect (the nurse asking how the patient feels) has nothing to read back.
 */
function prematureCompletions(c: NpcCase, played: PlayedConversation) {
  const interaction = interactionById(c.interactionId);
  if (!needsReadBack(interaction)) return [];
  const { name } = interaction.completion;
  return played.transcript.flatMap((event) => {
    if (event.speaker !== 'tool' || event.name !== name) return [];
    const confirmed = event.afterTurn !== null && c.turns.slice(0, event.afterTurn + 1).some((turn) => turn.confirms);
    return confirmed ? [] : [`${name} after ${event.afterTurn === null ? 'the greeting' : `turn ${event.afterTurn + 1}`}, before any confirmation`];
  });
}

export function npcResult(c: NpcCase, played: PlayedConversation): NpcResult {
  const sent = played.transcript.flatMap((event) => (event.speaker === 'player' ? [event.turn] : []));
  const costPatience = (turn: number) =>
    played.transcript.some((event) => event.speaker === 'tool' && event.name === NOT_UNDERSTOOD_TOOL && event.afterTurn === turn);
  const tagged = (tag: TurnTag) => sent.filter((turn) => c.turns[turn]!.tag === tag);
  return {
    id: c.id,
    language: c.targetLanguage,
    step: c.step,
    ...played,
    outcomeMatches: outcomeMatches(c, played),
    noisyTurns: tagged('noisy').map((turn) => ({ turn, understood: !costPatience(turn) })),
    gibberishTurns: tagged('gibberish').map((turn) => ({ turn, accepted: !costPatience(turn) })),
    prematureCompletions: prematureCompletions(c, played),
    argumentsDifferFromReadBack: [],
    stepAppropriate: [],
    offTargetLines: played.transcript.flatMap((event) => {
      if (event.speaker !== 'npc') return [];
      const why = offTargetLanguage(c.targetLanguage, event.text);
      return why ? [`"${event.text}" (${why})`] : [];
    }),
  };
}

/**
 * Adds the judge's verdict on the NPC lines `npcLines`. A completion it finds came without a confirmed read-back joins
 * the script's own premature completions.
 */
export function withVerdict(c: NpcCase, result: NpcResult, npcLines: { line: number; text: string }[], answer: { ok: true; json: unknown } | { ok: false; error: string }): NpcResult {
  if (!answer.ok) return { ...result, judgeError: answer.error };
  const parsed = NpcVerdictSchema.safeParse(answer.json);
  if (!parsed.success) return { ...result, judgeError: `schema: ${z.prettifyError(parsed.error)}` };
  const verdict = parsed.data;
  const stepAppropriate = npcLines.flatMap(({ line, text }) => {
    const found = verdict.lines.find((v) => v.line === line);
    return found ? [{ line, text, appropriate: found.stepAppropriate, why: found.why }] : [];
  });
  if (stepAppropriate.length < npcLines.length) return { ...result, verdict, judgeError: 'the judge left out some NPC lines' };

  const { name } = interactionById(c.interactionId).completion;
  const completed = result.transcript.some((event) => event.speaker === 'tool' && event.name === name);
  return {
    ...result,
    verdict,
    stepAppropriate,
    prematureCompletions: [...result.prematureCompletions, ...(completed && !verdict.readBackConfirmed ? [`judge: ${verdict.why}`] : [])],
    argumentsDifferFromReadBack: completed && !verdict.argumentsMatchReadBack ? [`judge: ${verdict.why}`] : [],
  };
}
