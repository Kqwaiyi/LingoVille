import { describe, expect, it } from 'vitest';
import { INTERACTIONS } from '../content/index.ts';
import { buildRecapRequest, RecapRequestSchema, RecapSchema, type RecapConversation, type RecapRequest } from './index.ts';

const ORDER: RecapConversation = {
  interactionId: INTERACTIONS.orderDrink.id,
  outcome: 'success',
  transcript: [
    { speaker: 'npc', text: '欢迎光临！您要点什么？' },
    { speaker: 'player', text: '我要一百拿铁' },
    { speaker: 'npc', text: '一杯热拿铁，对吗？二十八块。' },
    { speaker: 'player', text: '对', typed: true },
    { speaker: 'npc', text: '好的，请拿好。慢走！' },
  ],
  helpLog: [],
};

const goal: RecapRequest = { kind: 'goal', culturePackId: 'zh', step: 'A1', nativeLanguage: 'en', conversation: ORDER };

const text = (request: RecapRequest) => {
  const body = buildRecapRequest(request);
  return `${body.systemInstruction.parts[0]!.text}\n\n${body.contents[0]!.parts[0]!.text}`;
};

describe('buildRecapRequest', () => {
  it('builds the Recap for a Goal Interaction', () => {
    expect(buildRecapRequest(goal)).toMatchSnapshot();
  });

  it('builds a lighter Recap for Small Talk', () => {
    expect(
      buildRecapRequest({
        kind: 'smallTalk',
        culturePackId: 'de',
        step: 'B1',
        nativeLanguage: 'ja',
        npcId: 'barista',
        transcript: [
          { speaker: 'npc', text: 'Na, wie war dein Wochenende?' },
          { speaker: 'player', text: 'Gut, ich war im Park.' },
        ],
        helpLog: [],
      }),
    ).toMatchSnapshot();
  });

  it('builds one combined Recap for a whole Shift', () => {
    expect(
      buildRecapRequest({
        kind: 'shift',
        culturePackId: 'ja',
        step: 'A2',
        nativeLanguage: 'zh',
        customers: [ORDER, { ...ORDER, outcome: 'failure', transcript: ORDER.transcript.slice(0, 2) }],
      }),
    ).toMatchSnapshot();
  });

  it('marks spoken player lines as possibly misheard, and typed ones as typed', () => {
    const prompt = text(goal);

    expect(prompt).toContain('2. PLAYER (heard as, may be misheard): 我要一百拿铁');
    expect(prompt).toContain('4. PLAYER (typed): 对');
    expect(prompt).toContain('3. NPC: 一杯热拿铁，对吗？二十八块。');
  });

  it('treats a likely mishearing as a pronunciation point', () => {
    expect(text(goal)).toMatch(/pronunciation point/i);
  });

  it('asks for the explanations in the Native Language and the examples in the Target Language', () => {
    const prompt = text({ ...goal, nativeLanguage: 'de' });

    expect(prompt).toMatch(/in German/);
    expect(prompt).toMatch(/in Mandarin Chinese/);
  });

  it('lists the Help the Player used, placed among the lines', () => {
    const prompt = text({
      ...goal,
      conversation: {
        ...ORDER,
        helpLog: [
          { afterLine: 1, kind: 'hint', text: '我要一杯拿铁。' },
          { afterLine: 3, kind: 'translate', text: '一杯热拿铁，对吗？二十八块。' },
        ],
      },
    });

    expect(prompt).toContain('- after line 1: hint shown: 我要一杯拿铁。');
    expect(prompt).toContain('- after line 3: translated NPC line: 一杯热拿铁，对吗？二十八块。');
  });

  it('asks for at most three corrections, and fewer in Small Talk', () => {
    const corrections = (request: RecapRequest) =>
      buildRecapRequest(request).generationConfig.responseSchema.properties!.corrections!.maxItems;

    expect(corrections(goal)).toBe(3);
    expect(
      corrections({ kind: 'smallTalk', culturePackId: 'zh', step: 'A1', nativeLanguage: 'en', npcId: 'barista', transcript: [], helpLog: [] }),
    ).toBeLessThan(3);
  });

  it('is pure: the same request gives the same body', () => {
    expect(buildRecapRequest(goal)).toEqual(buildRecapRequest(goal));
  });
});

describe('RecapRequestSchema', () => {
  it('accepts a well-formed request', () => {
    expect(RecapRequestSchema.safeParse(goal).success).toBe(true);
  });

  it('rejects an unknown interaction, language or step', () => {
    const bad = [
      { ...goal, conversation: { ...ORDER, interactionId: 'rob-the-bank' } },
      { ...goal, nativeLanguage: 'fr' },
      { ...goal, step: 'D1' },
    ];
    for (const request of bad) expect(RecapRequestSchema.safeParse(request).success).toBe(false);
  });
});

describe('RecapSchema', () => {
  const recap = {
    outcome: 'You ordered a hot latte.',
    corrections: [{ said: '我要一百拿铁', natural: '我要一杯拿铁', why: 'yī bēi (a cup), not yī bǎi (a hundred).' }],
    newWords: [{ base: '慢走', reading: 'màn zǒu', gloss: 'take care (said to someone leaving)' }],
    cefrEstimate: 'A1',
  };

  it('accepts a Recap with or without a last topic', () => {
    expect(RecapSchema.safeParse(recap).success).toBe(true);
    expect(RecapSchema.safeParse({ ...recap, lastTopic: 'a hot latte' }).success).toBe(true);
  });

  it('rejects more than three corrections', () => {
    const corrections = Array.from({ length: 4 }, () => recap.corrections[0]);
    expect(RecapSchema.safeParse({ ...recap, corrections }).success).toBe(false);
  });
});
