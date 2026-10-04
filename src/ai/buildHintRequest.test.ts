import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS, INTERACTIONS, interactionFacts } from '../content/index.ts';
import { buildHintRequest, HintRequestSchema, HintsSchema, type HintRequest } from './index.ts';

const MID_ORDER: HintRequest = {
  culturePackId: 'ja',
  step: 'A1',
  nativeLanguage: 'en',
  interactionId: INTERACTIONS.orderDrink.id,
  transcript: [
    { speaker: 'npc', text: 'いらっしゃいませ！ご注文はお決まりですか？' },
    { speaker: 'player', text: 'ラテ', typed: true },
    { speaker: 'npc', text: 'ホットラテですね。450円です。よろしいですか？' },
  ],
};

const text = (request: HintRequest) => {
  const body = buildHintRequest(request);
  return `${body.systemInstruction.parts[0]!.text}\n\n${body.contents[0]!.parts[0]!.text}`;
};

describe('buildHintRequest', () => {
  it('builds hints for the moment in a conversation', () => {
    expect(buildHintRequest(MID_ORDER)).toMatchSnapshot();
  });

  it('builds hints before anything has been said', () => {
    expect(buildHintRequest({ ...MID_ORDER, culturePackId: 'de', step: 'B2', nativeLanguage: 'zh', transcript: [] })).toMatchSnapshot();
  });

  it('is built from the goal, the facts, the step and the transcript so far', () => {
    const prompt = text(MID_ORDER);

    expect(prompt).toContain(INTERACTIONS.orderDrink.goal);
    for (const fact of interactionFacts(INTERACTIONS.orderDrink, 'ja')) expect(prompt).toContain(fact);
    expect(prompt).toContain('CEFR A1');
    for (const line of MID_ORDER.transcript) expect(prompt).toContain(line.text);
  });

  it('asks for full sentences in the Target Language, translated into the Native Language', () => {
    const prompt = text({ ...MID_ORDER, nativeLanguage: 'de' });

    expect(prompt).toContain(CULTURE_PACKS.ja.languageName);
    expect(prompt).toContain(CULTURE_PACKS.de.languageName);
    expect(prompt).toMatch(/full sentence/i);
  });

  it('is the same at every step, apart from the level it names', () => {
    const a1 = text(MID_ORDER);
    const c2 = text({ ...MID_ORDER, step: 'C2' });

    expect(c2.replaceAll('CEFR C2', 'CEFR A1')).toBe(a1);
  });

  it('asks for 2–3 hints, each a sentence with its translation', () => {
    const schema = buildHintRequest(MID_ORDER).generationConfig.responseSchema;

    expect(schema.properties!.hints!.minItems).toBe(2);
    expect(schema.properties!.hints!.maxItems).toBe(3);
    const hint = { text: 'はい、お願いします。', translation: 'Yes, please.' };
    expect(HintsSchema.safeParse({ hints: [hint, hint] }).success).toBe(true);
    expect(HintsSchema.safeParse({ hints: [hint] }).success).toBe(false);
    expect(HintsSchema.safeParse({ hints: [hint, hint, hint, hint] }).success).toBe(false);
  });

  it('accepts only requests it can build hints for', () => {
    expect(HintRequestSchema.safeParse(MID_ORDER).success).toBe(true);
    expect(HintRequestSchema.safeParse({ ...MID_ORDER, interactionId: 'fly-a-plane' }).success).toBe(false);
    expect(HintRequestSchema.safeParse({ ...MID_ORDER, step: 'D1' }).success).toBe(false);
  });
});
