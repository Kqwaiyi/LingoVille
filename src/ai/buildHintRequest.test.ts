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

/** A barista at a Shift, with a customer at the counter who has just ordered. */
const MID_SHIFT: HintRequest = {
  culturePackId: 'ja',
  step: 'B1',
  nativeLanguage: 'en',
  jobId: 'barista',
  transcript: [{ speaker: 'npc', text: 'すみません、紅茶のLサイズをアイスで、レモン付きでお願いします。' }],
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
    expect(HintRequestSchema.safeParse(MID_SHIFT).success).toBe(true);
    expect(HintRequestSchema.safeParse({ ...MID_SHIFT, jobId: 'astronaut' }).success).toBe(false);
    expect(HintRequestSchema.safeParse({ ...MID_ORDER, interactionId: 'fly-a-plane' }).success).toBe(false);
    expect(HintRequestSchema.safeParse({ ...MID_ORDER, step: 'D1' }).success).toBe(false);
  });
});

describe('buildHintRequest at a Shift', () => {
  it('builds hints for the Player’s own lines as the staff member', () => {
    expect(buildHintRequest(MID_SHIFT)).toMatchSnapshot();
  });

  it('writes the hints as the staff member says them, from the step and the transcript so far', () => {
    const prompt = text(MID_SHIFT);

    expect(prompt).toContain('CEFR B1');
    expect(prompt).toMatch(/working a Shift as the barista/);
    expect(prompt).toMatch(/never the customer's/i);
    for (const line of MID_SHIFT.transcript) expect(prompt).toContain(line.text);
  });

  it('never helps the Player understand the customer: no order restated, guessed or translated', () => {
    const prompt = text(MID_SHIFT);

    expect(prompt).toMatch(/never say, repeat back, guess or translate what the customer wants/i);
    expect(prompt).not.toContain(INTERACTIONS.orderDrink.goal);
  });

  it('is the same at every step, apart from the level it names', () => {
    expect(text({ ...MID_SHIFT, step: 'C2' }).replaceAll('CEFR C2', 'CEFR B1')).toBe(text(MID_SHIFT));
  });

  it('builds a cashier’s hints at the till: about the bag, the points card and the change, never the customer’s wishes', () => {
    const atTheTill: HintRequest = { ...MID_SHIFT, jobId: 'cashier', transcript: [{ speaker: 'npc', text: 'こんにちは。' }] };
    const prompt = text(atTheTill);

    expect(buildHintRequest(atTheTill)).toMatchSnapshot();
    expect(prompt).toMatch(/working a Shift as the cashier at スーパーまるやま/);
    expect(prompt).toMatch(/bag/);
    expect(prompt).toMatch(/points card/);
    expect(prompt).not.toMatch(/hot or iced/);
    expect(prompt).toMatch(/never say, repeat back, guess or translate what the customer wants/i);
  });

  it('builds a server’s hints at a table: about what they’d like and dietary needs, never what anyone wants', () => {
    const atTheTable: HintRequest = { ...MID_SHIFT, jobId: 'server', transcript: [{ speaker: 'npc', text: 'こんにちは。' }] };
    const prompt = text(atTheTable);

    expect(buildHintRequest(atTheTable)).toMatchSnapshot();
    expect(prompt).toMatch(/working a Shift as the server at レストランひまわり, serving a table/);
    expect(prompt).not.toMatch(/at the counter/);
    expect(prompt).toMatch(/dietary needs/);
    expect(prompt).toMatch(/never say, repeat back, guess or translate what the customer wants/i);
  });
});

describe('buildHintRequest: asking a passer-by the way', () => {
  it('writes hints for someone at a tram stop talking to a passer-by, with the tram line facts', () => {
    const hint = text({ culturePackId: 'de', step: 'A1', nativeLanguage: 'en', interactionId: INTERACTIONS.askForDirections.id, transcript: [] });
    expect(hint).toContain('They are at a tram stop, talking to the passer-by');
    expect(hint).toContain(CULTURE_PACKS.de.tramStops['east-stop'].name);
  });
});
