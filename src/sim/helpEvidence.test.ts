import { describe, expect, it } from 'vitest';
import { HELP_EVIDENCE, PROFICIENCY_STEPS, weighRecapEvidence, type EvidenceLine, type HelpShown } from './index.ts';

const ORDER: EvidenceLine[] = [
  { speaker: 'npc', text: 'いらっしゃいませ！ご注文はお決まりですか？' },
  { speaker: 'player', text: 'ホットラテをください' },
  { speaker: 'npc', text: 'ホットラテですね。450円です。よろしいですか？' },
  { speaker: 'player', text: 'はい、お願いします' },
];

const weights = (lines: EvidenceLine[], helpLog: HelpShown[]) =>
  weighRecapEvidence({ cefrEstimate: 'A2', lines, helpLog }).lineWeights;

describe('weighRecapEvidence', () => {
  it('counts every turn in full when no Help was used', () => {
    const evidence = weighRecapEvidence({ cefrEstimate: 'A2', lines: ORDER, helpLog: [] });

    expect(evidence.lineWeights).toEqual([1, 1, 1, 1]);
    expect(evidence.weight).toBe(1);
    expect(evidence.estimate).toBe('A2');
  });

  it('counts a turn that closely repeats a hint shown just before it for little', () => {
    const hint: HelpShown = { afterLine: 1, kind: 'hint', text: 'ホットラテをください。' };

    expect(weights(ORDER, [hint])).toEqual([1, HELP_EVIDENCE.copiedTurnWeight, 1, 1]);
    expect(HELP_EVIDENCE.copiedTurnWeight).toBeLessThan(1);
  });

  it('counts a turn copied from a phrasebook entry shown just before it for little too', () => {
    const phrase: HelpShown = { afterLine: 3, kind: 'phrasebook', text: 'はい、お願いします。' };

    expect(weights(ORDER, [phrase])).toEqual([1, 1, 1, HELP_EVIDENCE.copiedTurnWeight]);
  });

  it('ignores case, spacing and punctuation when deciding a turn repeats a hint', () => {
    const lines: EvidenceLine[] = [
      { speaker: 'npc', text: 'Hiya! What can I get you?' },
      { speaker: 'player', text: 'can i have a latte please' },
    ];
    const hint: HelpShown = { afterLine: 1, kind: 'hint', text: 'Can I have a latte, please?' };

    expect(weights(lines, [hint])).toEqual([1, HELP_EVIDENCE.copiedTurnWeight]);
  });

  it('counts a turn in full when it only shares a word or two with the hint', () => {
    const lines: EvidenceLine[] = [ORDER[0]!, { speaker: 'player', text: 'はい' }];
    const hint: HelpShown = { afterLine: 1, kind: 'hint', text: 'はい、ホットラテをお願いします。' };

    expect(weights(lines, [hint])).toEqual([1, 1]);
  });

  it('counts a turn in full when the hint it repeats was shown before an earlier turn', () => {
    const lines: EvidenceLine[] = [...ORDER, { speaker: 'npc', text: 'もう一度お願いします。' }, { speaker: 'player', text: 'ホットラテをください' }];
    const hint: HelpShown = { afterLine: 1, kind: 'hint', text: 'ホットラテをください。' };

    expect(weights(lines, [hint]).at(-1)).toBe(1);
  });

  it('counts a translated NPC line for nothing as listening evidence', () => {
    const translated: HelpShown = { afterLine: 3, kind: 'translate', text: ORDER[2]!.text };

    expect(weights(ORDER, [translated])).toEqual([1, 1, 0, 1]);
  });

  it('counts only the line that was translated for nothing, when the NPC said the same thing earlier', () => {
    const lines: EvidenceLine[] = [ORDER[0]!, ORDER[1]!, ORDER[0]!];
    const translated: HelpShown = { afterLine: 3, kind: 'translate', text: ORDER[0]!.text };

    expect(weights(lines, [translated])).toEqual([1, 1, 0]);
  });

  it('never lowers the estimate, and only ever reduces how much the conversation counts', () => {
    const helpLogs: HelpShown[][] = [
      [{ afterLine: 1, kind: 'hint', text: 'ホットラテをください。' }],
      [{ afterLine: 1, kind: 'translate', text: ORDER[0]!.text }],
      [
        { afterLine: 0, kind: 'phrasebook', text: 'メニューをください。' },
        { afterLine: 1, kind: 'translate', text: ORDER[0]!.text },
        { afterLine: 3, kind: 'hint', text: 'はい、お願いします。' },
        { afterLine: 3, kind: 'translate', text: ORDER[2]!.text },
      ],
    ];
    for (const cefrEstimate of PROFICIENCY_STEPS) {
      const unhelped = weighRecapEvidence({ cefrEstimate, lines: ORDER, helpLog: [] });
      for (const helpLog of helpLogs) {
        const helped = weighRecapEvidence({ cefrEstimate, lines: ORDER, helpLog });
        expect(helped.estimate).toBe(cefrEstimate);
        expect(helped.weight).toBeLessThan(unhelped.weight);
        expect(helped.weight).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives no weight to a conversation with no lines', () => {
    expect(weighRecapEvidence({ cefrEstimate: 'B1', lines: [], helpLog: [] }).weight).toBe(0);
  });
});
