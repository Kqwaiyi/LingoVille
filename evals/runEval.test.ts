import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { MODELS } from '../server/config.ts';
import type { Recap, Segment } from '../src/ai/index.ts';
import { runEval, type EvalCases } from './runEval.ts';

// Stands in for Gemini: answers each generateContent call from the model and the prompt.
type Answer = (call: { model: string; text: string; body: unknown }) => unknown;

function fakeGemini(answer: Answer) {
  const calls: { model: string; text: string }[] = [];
  const fetch = (async (url: string, init: { body: string }) => {
    const model = /models\/([^:]+):generateContent/.exec(url)![1]!;
    const body = JSON.parse(init.body) as { contents: { parts: { text: string }[] }[] };
    const text = body.contents[0]!.parts[0]!.text;
    calls.push({ model, text });
    const json = answer({ model, text, body });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }), { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

const recapAnswer = (cefrEstimate: Recap['cefrEstimate']): Recap => ({
  outcome: 'Nicely done.',
  corrections: [],
  newWords: [],
  cefrEstimate,
});

const LATTE: Segment[] = [
  { base: '一杯', reading: 'yì bēi' },
  { base: '热', reading: 'rè' },
  { base: '拿铁', reading: 'ná tiě' },
  { base: '。', reading: '' },
];

const CASES: EvalCases = {
  recap: [
    {
      id: 'zh-order-latte',
      expectedStep: 'A1',
      request: {
        kind: 'goal',
        culturePackId: 'zh',
        step: 'A1',
        nativeLanguage: 'en',
        conversation: {
          interactionId: 'order-drink',
          outcome: 'success',
          transcript: [
            { speaker: 'npc', text: '欢迎光临！您要点什么？' },
            { speaker: 'player', text: '我要一杯热拿铁' },
          ],
          helpLog: [{ afterLine: 1, kind: 'hint', text: '我要一杯热拿铁' }],
        },
      },
    },
  ],
  annotate: [{ id: 'zh-latte', targetLanguage: 'zh', nativeLanguage: 'en', line: '一杯热拿铁。', gold: LATTE }],
};

let dir: string;
let reportsDir: string;
let baselinePath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'evals-'));
  reportsDir = join(dir, 'reports');
  baselinePath = join(dir, 'baseline.json');
});

function run(options: { fetch: typeof globalThis.fetch; confirm?: () => Promise<boolean>; args?: string[]; cases?: EvalCases }) {
  const log: string[] = [];
  const result = runEval({
    args: options.args ?? [],
    apiKey: 'test-key',
    fetch: options.fetch,
    confirm: options.confirm ?? (async () => true),
    now: () => new Date('2026-10-05T09:30:00.000Z'),
    cases: options.cases ?? CASES,
    reportsDir,
    baselinePath,
    log: (line) => log.push(line),
  });
  return { result, log };
}

// Every call answered well: a matching estimate, and the gold readings.
const goodAnswers: Answer = ({ model }) =>
  model === MODELS.annotate ? { translation: 'A hot latte.', segments: LATTE } : recapAnswer('A1');

describe('runEval', () => {
  it('prints an estimated cost and asks before calling the model; declining calls nothing and writes no report', async () => {
    const gemini = fakeGemini(goodAnswers);
    let asked = false;
    const { result, log } = run({ fetch: gemini.fetch, confirm: async () => ((asked = true), false) });

    const outcome = await result;

    expect(asked).toBe(true);
    expect(log.join('\n')).toMatch(/≈ \$\d+\.\d{2}/);
    expect(gemini.calls).toHaveLength(0);
    expect(outcome.ran).toBe(false);
    await expect(readdir(reportsDir)).rejects.toThrow();
  });

  it('passes a run whose answers meet every bar, and writes the report to a timestamped JSON file', async () => {
    const gemini = fakeGemini(goodAnswers);

    const outcome = await run({ fetch: gemini.fetch }).result;

    expect(outcome).toMatchObject({ ran: true, passed: true });
    expect(await readdir(reportsDir)).toEqual(['2026-10-05T09-30-00-000Z.json']);
    const report = JSON.parse(await readFile(join(reportsDir, '2026-10-05T09-30-00-000Z.json'), 'utf8'));
    expect(report).toMatchObject({ passed: true, quick: false, metrics: { cefrWithinOneStep: 1, annotateValidationFailures: 0 } });
  });

  it('runs a Recap case with a Help log twice: as it was, and with the Help log left out', async () => {
    const gemini = fakeGemini(goodAnswers);

    await run({ fetch: gemini.fetch }).result;

    const recapPrompts = gemini.calls.filter((call) => call.model !== MODELS.annotate).map((call) => call.text);
    expect(recapPrompts).toHaveLength(2);
    expect(recapPrompts.filter((text) => text.includes('Help used: none.'))).toHaveLength(1);
  });

  const failedBars = (outcome: Awaited<ReturnType<typeof runEval>>) =>
    outcome.ran ? outcome.report.bars.filter((bar) => !bar.passed).map((bar) => bar.name) : [];

  it('fails the run when a Recap does not match its schema', async () => {
    const gemini = fakeGemini((call) => (call.model === MODELS.annotate ? goodAnswers(call) : { outcome: 'Nicely done.' }));

    const outcome = await run({ fetch: gemini.fetch }).result;

    expect(outcome).toMatchObject({ ran: true, passed: false });
    expect(failedBars(outcome)).toContain('every Recap matches its schema');
  });

  it('fails the run when the Help log lowers the CEFR estimate', async () => {
    const gemini = fakeGemini((call) => {
      if (call.model === MODELS.annotate) return goodAnswers(call);
      return recapAnswer(call.text.includes('Help used: none.') ? 'A2' : 'A1');
    });

    const outcome = await run({ fetch: gemini.fetch }).result;

    expect(failedBars(outcome)).toEqual(['Help discounting never lowers the CEFR estimate']);
  });

  it('fails the run when annotated segments do not join to the line', async () => {
    const gemini = fakeGemini((call) =>
      call.model === MODELS.annotate ? { translation: 'A hot latte.', segments: LATTE.slice(0, 3) } : goodAnswers(call),
    );

    const outcome = await run({ fetch: gemini.fetch }).result;

    expect(failedBars(outcome)).toContain('`base` segments join to the line exactly');
  });

  it('fails the run when a rate misses its bar', async () => {
    const gemini = fakeGemini((call) => (call.model === MODELS.annotate ? goodAnswers(call) : recapAnswer('C1')));

    const outcome = await run({ fetch: gemini.fetch }).result;

    expect(failedBars(outcome)).toEqual(['cefrWithinOneStep ≥ 85.0%']);
  });

  it('fails a rate that drops more than 5 points against the baseline, and never writes the baseline', async () => {
    const baseline = `${JSON.stringify({ metrics: { annotateGoldReadings: 1 } })}\n`;
    await writeFile(baselinePath, baseline);
    // Readings that pass every check, but are not the gold ones.
    const misread = LATTE.map((segment) => (segment.base === '热' ? { ...segment, reading: 're' } : segment));
    const gemini = fakeGemini((call) => (call.model === MODELS.annotate ? { translation: 'A hot latte.', segments: misread } : goodAnswers(call)));

    const outcome = await run({ fetch: gemini.fetch }).result;

    expect(failedBars(outcome)).toEqual(['annotateGoldReadings within 5 points of the baseline']);
    expect(await readFile(baselinePath, 'utf8')).toBe(baseline);
    expect(await readdir(dir)).toEqual(['baseline.json', 'reports']);
  });

  it('passes a rate that drops exactly 5 points against the baseline', async () => {
    // 19 of 20 readings match the gold: 95%, against a baseline of 100%.
    const twenty: EvalCases = {
      recap: [],
      annotate: Array.from({ length: 20 }, (_, i) => ({ ...CASES.annotate[0]!, id: `zh-latte-${i}` })),
    };
    await writeFile(baselinePath, JSON.stringify({ metrics: { annotateGoldReadings: 1 } }));
    const misread = LATTE.map((segment) => (segment.base === '热' ? { ...segment, reading: 're' } : segment));
    let annotated = 0;
    const gemini = fakeGemini(() => ({ translation: 'A hot latte.', segments: annotated++ === 0 ? misread : LATTE }));

    const outcome = await run({ fetch: gemini.fetch, cases: twenty }).result;

    expect(failedBars(outcome)).toEqual([]);
  });

  it('fails a call Gemini refuses as a failed call, not as a bad answer', async () => {
    const fetch = (async () => new Response('{"error":"quota"}', { status: 429 })) as unknown as typeof globalThis.fetch;

    const outcome = await run({ fetch }).result;

    expect(failedBars(outcome)).toContain('every model call answered');
    expect(failedBars(outcome)).not.toContain('every Recap matches its schema');
  });

  it('does not check a --quick run against the baseline, whose rates come from the full set', async () => {
    await writeFile(baselinePath, JSON.stringify({ metrics: { annotateGoldReadings: 1 } }));
    const misread = LATTE.map((segment) => (segment.base === '热' ? { ...segment, reading: 're' } : segment));
    const gemini = fakeGemini((call) => (call.model === MODELS.annotate ? { translation: 'A hot latte.', segments: misread } : goodAnswers(call)));

    const outcome = await run({ fetch: gemini.fetch, args: ['--quick'] }).result;

    expect(outcome).toMatchObject({ ran: true, passed: true });
  });

  it('runs only a few cases per language with --quick', async () => {
    const many: EvalCases = {
      recap: [],
      annotate: Array.from({ length: 5 }, (_, i) => ({ ...CASES.annotate[0]!, id: `zh-latte-${i}` })),
    };
    const gemini = fakeGemini(goodAnswers);

    const outcome = await run({ fetch: gemini.fetch, args: ['--quick'], cases: many }).result;

    expect(outcome).toMatchObject({ ran: true, report: { quick: true } });
    expect(gemini.calls.length).toBeGreaterThan(0);
    expect(gemini.calls.length).toBeLessThan(5);
  });
});
