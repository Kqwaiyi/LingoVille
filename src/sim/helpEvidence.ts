import { HELP_EVIDENCE, type ProficiencyStep } from './tuning.ts';

/** One line of a finished conversation, as Proficiency evidence. */
export type EvidenceLine = { speaker: 'npc' | 'player'; text: string };

/**
 * Help the Player used, from the conversation's Help log. `afterLine` is how many
 * lines the conversation had when it was shown; a translated line carries the NPC's text.
 */
export type HelpShown = { afterLine: number; kind: 'hint' | 'phrasebook' | 'translate'; text: string };

export type RecapEvidence = {
  /** The Recap's CEFR estimate. Help never lowers it. */
  estimate: ProficiencyStep;
  /** How much the conversation counts, from 0 (nothing) to 1 (every line in full). */
  weight: number;
  /** How much each line counts: player lines as speaking evidence, NPC lines as listening evidence. */
  lineWeights: number[];
};

/** Letters and digits only, lowercased, so spacing and punctuation never decide a match. */
function normalise(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** The text's letter pairs, or the letter itself for a one-letter text. */
function pairs(text: string) {
  if (text.length < 2) return [text];
  return Array.from({ length: text.length - 1 }, (_, i) => text.slice(i, i + 2));
}

/** Dice similarity of two texts' letter pairs: 1 for the same text, 0 for nothing in common. */
function similarity(a: string, b: string) {
  const left = pairs(normalise(a));
  const right = pairs(normalise(b));
  if (left[0] === '' || right[0] === '') return 0;
  const unmatched = [...right];
  let shared = 0;
  for (const pair of left) {
    const at = unmatched.indexOf(pair);
    if (at === -1) continue;
    unmatched.splice(at, 1);
    shared++;
  }
  return (2 * shared) / (left.length + right.length);
}

/** Hints and phrases shown since the Player's previous turn, before the turn at `line`. */
function shownJustBefore(lines: EvidenceLine[], line: number, helpLog: HelpShown[]) {
  let previousTurn = -1;
  for (let i = line - 1; i >= 0; i--) {
    if (lines[i]!.speaker === 'player') {
      previousTurn = i;
      break;
    }
  }
  return helpLog.filter((help) => help.kind !== 'translate' && help.afterLine > previousTurn && help.afterLine <= line);
}

/** The NPC line a Translate entry was for: the latest one with its text before it was pressed. */
function translatedLine(lines: EvidenceLine[], help: HelpShown) {
  for (let i = Math.min(help.afterLine, lines.length) - 1; i >= 0; i--) {
    if (lines[i]!.speaker === 'npc' && lines[i]!.text === help.text) return i;
  }
  return -1;
}

function lineWeight(lines: EvidenceLine[], line: number, helpLog: HelpShown[]): number {
  const { speaker, text } = lines[line]!;
  if (speaker === 'npc') {
    const translated = helpLog.some((help) => help.kind === 'translate' && translatedLine(lines, help) === line);
    return translated ? 0 : 1;
  }
  const copied = shownJustBefore(lines, line, helpLog).some((help) => similarity(text, help.text) >= HELP_EVIDENCE.closeRepeatSimilarity);
  return copied ? HELP_EVIDENCE.copiedTurnWeight : 1;
}

/**
 * How much a finished conversation counts as evidence of the Recap's estimate.
 * A player turn that closely repeats a hint or phrase shown just before it counts
 * for little, and a translated NPC line counts for nothing as listening evidence.
 * Help only ever reduces the weight: it never lowers the estimate.
 */
export function weighRecapEvidence(input: { cefrEstimate: ProficiencyStep; lines: EvidenceLine[]; helpLog: HelpShown[] }): RecapEvidence {
  const { cefrEstimate, lines, helpLog } = input;
  const lineWeights = lines.map((_, line) => lineWeight(lines, line, helpLog));
  const weight = lineWeights.length === 0 ? 0 : lineWeights.reduce((sum, w) => sum + w, 0) / lineWeights.length;
  return { estimate: cefrEstimate, weight, lineWeights };
}
