import { describe, expect, it } from 'vitest';
import { INTERACTIONS } from '../content/index.ts';
import { buildRecapRequest, RecapRequestSchema, RecapSchema, type RecapConversation, type RecapLine, type RecapRequest } from './index.ts';

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

const SHIFT_LINES: RecapLine[] = [
  { speaker: 'npc', text: 'すみません、ラテを一つください。' },
  { speaker: 'player', text: 'ラテ…ですか？' },
  { speaker: 'npc', text: 'はい、ラテです。' },
];

const shift: RecapRequest = {
  kind: 'shift',
  jobId: 'barista',
  culturePackId: 'ja',
  step: 'A2',
  nativeLanguage: 'zh',
  customers: [
    { order: [{ itemId: 'latte', quantity: 1 }], result: 'served', served: [{ itemId: 'latte', quantity: 1 }], transcript: SHIFT_LINES, helpLog: [] },
    {
      order: [{ itemId: 'latte', quantity: 1 }],
      result: 'wrongOrder',
      served: [{ itemId: 'tea', quantity: 1 }],
      transcript: SHIFT_LINES,
      helpLog: [{ afterLine: 1, kind: 'translate', text: 'すみません、ラテを一つください。' }],
    },
    { order: [{ itemId: 'coffee', quantity: 1 }], result: 'walkedOut', served: [], transcript: SHIFT_LINES.slice(0, 1), helpLog: [] },
  ],
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
    expect(buildRecapRequest(shift)).toMatchSnapshot();
  });

  it('tells the coach, for each Shift Customer, what they ordered and how the learner served them', () => {
    const prompt = text(shift);

    expect(prompt).toMatch(/learner was the barista/);
    expect(prompt).toContain('CUSTOMER 1\nThey ordered: 1 × ホットラテ. The barista served it right.');
    expect(prompt).toContain('CUSTOMER 2\nThey ordered: 1 × ホットラテ. The barista served 1 × 紅茶 instead.');
    expect(prompt).toContain('CUSTOMER 3\nThey ordered: 1 × ブレンドコーヒー. The barista never served them, and they left.');
    expect(prompt).toContain('2. PLAYER (heard as, may be misheard): ラテ…ですか？');
  });

  it('tells the coach how a drink made to order was made, and what a customer first asked for before changing their mind', () => {
    const made = (size: 'small' | 'large', temperature: 'hot' | 'iced', extra: 'milk' | 'lemon') => ({ size, temperature, extras: [extra] });
    const prompt = text({
      ...shift,
      customers: [
        {
          changedFrom: [{ itemId: 'coffee', quantity: 1, modifiers: made('small', 'hot', 'milk') }],
          order: [{ itemId: 'tea', quantity: 1, modifiers: made('large', 'iced', 'lemon') }],
          result: 'wrongOrder',
          served: [{ itemId: 'tea', quantity: 1, modifiers: made('large', 'hot', 'lemon') }],
          transcript: SHIFT_LINES,
          helpLog: [],
        },
      ],
    });

    expect(prompt).toContain(
      'CUSTOMER 1\nThey first ordered 1 × ブレンドコーヒー (Sサイズ, ホット, ミルク), then changed their mind halfway. They ordered: 1 × 紅茶 (Lサイズ, アイス, レモン). The barista served 1 × 紅茶 (Lサイズ, ホット, レモン) instead.',
    );
  });

  it('tells the coach, for each customer at the till, what they wanted and what the cashier did', () => {
    const prompt = text({
      ...shift,
      jobId: 'cashier',
      customers: [
        {
          order: [{ itemId: 'eggs', quantity: 2 }, { itemId: 'stamps', quantity: 1 }],
          checkout: { bag: true, pointsCard: false, fromBehindTheCounter: 'stamps', cashHanded: 2000, changeDue: 1160 },
          result: 'served',
          served: [{ itemId: 'eggs', quantity: 2 }, { itemId: 'stamps', quantity: 1 }],
          atTheTill: { bag: true, pointsCard: false, change: 1160 },
          transcript: SHIFT_LINES,
          helpLog: [],
        },
        {
          order: [{ itemId: 'noodles', quantity: 1 }],
          checkout: { bag: false, pointsCard: true, fromBehindTheCounter: null, cashHanded: null, changeDue: null },
          result: 'wrongOrder',
          served: [{ itemId: 'noodles', quantity: 1 }],
          atTheTill: { bag: true, pointsCard: false, change: 0 },
          transcript: SHIFT_LINES,
          helpLog: [],
        },
      ],
    });

    expect(prompt).toMatch(/learner was the cashier/);
    expect(prompt).toContain(
      'CUSTOMER 1\nThey brought 2 × 卵 to the till, asked for 1 × 切手 from behind the counter, wanted a bag, had no points card, and paid ¥2,000 in cash, so ¥1,160 change was due. The cashier got it all right.',
    );
    expect(prompt).toContain(
      'CUSTOMER 2\nThey brought 1 × うどん to the till, wanted no bag, had a points card, and paid by card. The cashier rang up 1 × うどん, gave a bag, scanned no points card and gave no change instead.',
    );
  });

  it('asks for at most three corrections across the whole Shift', () => {
    expect(buildRecapRequest(shift).generationConfig.responseSchema.properties!.corrections!.maxItems).toBe(3);
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

  it('never lets the Help the Player used lower the level estimate', () => {
    expect(text(goal)).toMatch(/never lower cefrEstimate because Help was used/);
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
