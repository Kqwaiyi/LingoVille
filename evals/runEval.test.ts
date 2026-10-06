import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { MODELS } from '../server/config.ts';
import type { Recap, Segment } from '../src/ai/index.ts';
import type { LiveSocketHandlers } from '../src/voice/liveSession.ts';
import type { NpcCase } from './cases/schema.ts';
import { runEval, type EvalCases } from './runEval.ts';

// Stands in for Gemini: answers each generateContent call from the model and the prompt.
type Answer = (call: { model: string; text: string; body: unknown }) => unknown;

function fakeGemini(answer: Answer) {
  const calls: { model: string; text: string }[] = [];
  const fetch = (async (url: string, init: { body: string }) => {
    if (url.endsWith('/auth_tokens')) return new Response(JSON.stringify({ name: 'auth_tokens/test-token' }), { status: 200 });
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
  npc: [],
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

// --- a fake Live NPC -----------------------------------------------------------

/** What the fake NPC hears: the opening scene or a typed line, a recorded turn, or the game's answer to its tool call. */
type Heard = { text: string } | { audio: string[] } | { toolResponse: { name: string; response: { result: string } } };
/** What it does in reply, in order: says a line, or calls a tool and waits for the answer. */
type Reply = { say: string } | { call: string; args: unknown } | { heard: string } | { drop: true };
type FakeNpc = (heard: Heard) => Reply[];

/** Stands in for Gemini Live: each message the session sends is answered by `npc`, a frame at a time, like the real socket. */
function fakeLive(npc: FakeNpc) {
  const sessions: { url: string; sent: Record<string, unknown>[] }[] = [];
  const openSocket = (url: string, handlers: LiveSocketHandlers) => {
    const sent: Record<string, unknown>[] = [];
    sessions.push({ url, sent });
    let calls = 0;
    let audio: string[] = [];
    const emit = (message: unknown) => setTimeout(() => handlers.onMessage(JSON.stringify(message)), 0);
    const reply = (replies: Reply[]) => {
      for (const r of replies) {
        if ('say' in r) emit({ serverContent: { outputTranscription: { text: r.say } } });
        else if ('heard' in r) emit({ serverContent: { inputTranscription: { text: r.heard } } });
        else if ('drop' in r) setTimeout(() => handlers.onClose(1006, 'gone'), 0);
        else emit({ toolCall: { functionCalls: [{ id: `call-${++calls}`, name: r.call, args: r.args }] } });
      }
      // A tool call waits for its answer; anything else ends the turn.
      if (!replies.some((r) => 'call' in r || 'drop' in r)) emit({ serverContent: { turnComplete: true } });
    };
    setTimeout(() => handlers.onOpen(), 0);
    return {
      send: (text: string) => {
        const message = JSON.parse(text);
        sent.push(message);
        if (message.setup) return emit({ setupComplete: {} });
        if (message.clientContent) return reply(npc({ text: message.clientContent.turns.at(-1).parts[0].text }));
        if (message.toolResponse) {
          const { name, response } = message.toolResponse.functionResponses[0];
          return reply(npc({ toolResponse: { name, response } }));
        }
        if (message.realtimeInput?.audio) audio.push(message.realtimeInput.audio.data);
        if (message.realtimeInput?.activityEnd) {
          const heard = audio;
          audio = [];
          return reply(npc({ audio: heard }));
        }
      },
      close: () => {},
    };
  };
  return { openSocket, sessions };
}

/** A well-behaved barista: greets, reads the order back, serves once confirmed, and calls not_understood for anything else. */
const goodBarista: FakeNpc = (heard) => {
  if ('toolResponse' in heard) {
    if (heard.toolResponse.response.result === 'served') return [{ say: '好的，请拿好。慢走！' }];
    if (heard.toolResponse.response.result === 'out_of_patience') return [{ say: '对不起，再见。' }];
    return [{ say: '不好意思，我没听懂。' }];
  }
  if ('audio' in heard) return [{ say: '一杯热拿铁，对吗？' }];
  if (heard.text.startsWith('[SCENE')) return [{ say: '欢迎光临！您要点什么？' }];
  if (heard.text.includes('拿铁')) return [{ say: '一杯热拿铁，对吗？' }];
  if (heard.text === '对') return [{ call: 'serve_order', args: { items: [{ item: 'latte', quantity: 1 }] } }];
  return [{ call: 'not_understood', args: { reason: 'unintelligible' } }];
};

const LATTE_ORDER: NpcCase = {
  id: 'zh-npc-latte',
  interactionId: 'order-drink',
  targetLanguage: 'zh',
  step: 'A1',
  turns: [
    { tag: 'noisy', text: '我要一百拿铁' },
    { tag: 'clean', text: '对', confirms: true },
  ],
  expected: { outcome: 'completed', args: { items: [{ item: 'latte', quantity: 1 }] } },
};

const npcOnly = (...npc: NpcCase[]): EvalCases => ({ recap: [], npc, annotate: [] });

function run(options: {
  fetch: typeof globalThis.fetch;
  live?: ReturnType<typeof fakeLive>;
  recordings?: Record<string, Uint8Array>;
  confirm?: () => Promise<boolean>;
  args?: string[];
  cases?: EvalCases;
}) {
  const log: string[] = [];
  const result = runEval({
    openLiveSocket: (options.live ?? fakeLive(goodBarista)).openSocket,
    readRecording: async (file) => options.recordings?.[file] ?? null,
    npcTiming: { settleMs: 5, turnTimeoutMs: 1_000, chunkMs: 0 },
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

type JudgeBody = { generationConfig: { responseSchema: { properties?: Record<string, unknown> } } };

/** The judge passing everything: every NPC line suits the step, the read-back was confirmed and matched, and every correction is right. */
const fairJudge: Answer = ({ text, body }) => {
  if ((body as JudgeBody).generationConfig.responseSchema.properties?.corrections) {
    const corrections = [...text.matchAll(/^CORRECTION (\d+):/gm)].map((m) => ({ correction: Number(m[1]), correct: true, why: 'Right.' }));
    return { corrections };
  }
  const lines = [...text.matchAll(/^(\d+)\. NPC:/gm)].map((m) => ({ line: Number(m[1]), stepAppropriate: true, why: 'Simple.' }));
  return { lines, readBackConfirmed: true, argumentsMatchReadBack: true, why: 'Matches.' };
};

// Every call answered well: a matching estimate, the gold readings and a fair judge.
const goodAnswers: Answer = (call) => {
  if (call.model === MODELS.evalJudge) return fairJudge(call);
  return call.model === MODELS.annotate ? { translation: 'A hot latte.', segments: LATTE } : recapAnswer('A1');
};

const failedBars = (outcome: Awaited<ReturnType<typeof runEval>>) =>
  outcome.ran ? outcome.report.bars.filter((bar) => !bar.passed).map((bar) => bar.name) : [];

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
      npc: [],
      annotate: Array.from({ length: 20 }, (_, i) => ({ ...CASES.annotate[0]!, id: `zh-latte-${i}` })),
    };
    await writeFile(baselinePath, JSON.stringify({ metrics: { annotateGoldReadings: 1 } }));
    const misread = LATTE.map((segment) => (segment.base === '热' ? { ...segment, reading: 're' } : segment));
    let annotated = 0;
    const gemini = fakeGemini(() => ({ translation: 'A hot latte.', segments: annotated++ === 0 ? misread : LATTE }));

    const outcome = await run({ fetch: gemini.fetch, cases: twenty }).result;

    expect(failedBars(outcome)).toEqual([]);
  });

  it("asks the judge about the Recap's corrections, and fails the run when too few are correct", async () => {
    const corrections: Recap['corrections'] = [
      { said: '我要一百拿铁', natural: '我要一杯拿铁', why: '"一杯" is one cup.' },
      { said: '对', natural: '对的', why: 'Wrong: "对" is fine.' },
    ];
    const gemini = fakeGemini((call) => {
      if (call.model === MODELS.evalJudge) {
        return { corrections: [{ correction: 1, correct: true, why: 'Right.' }, { correction: 2, correct: false, why: '对 was fine.' }] };
      }
      return call.model === MODELS.annotate ? goodAnswers(call) : { ...recapAnswer('A1'), corrections };
    });

    const outcome = await run({ fetch: gemini.fetch }).result;

    expect(failedBars(outcome)).toEqual(['correctionsCorrect ≥ 90.0%']);
    // Only the Recap as it was is judged, not the one without its Help log.
    const judged = gemini.calls.filter((call) => call.model === MODELS.evalJudge);
    expect(judged).toHaveLength(1);
    expect(judged[0]!.text).toContain('CORRECTION 2: said "对"');
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
      npc: [],
      annotate: Array.from({ length: 5 }, (_, i) => ({ ...CASES.annotate[0]!, id: `zh-latte-${i}` })),
    };
    const gemini = fakeGemini(goodAnswers);

    const outcome = await run({ fetch: gemini.fetch, args: ['--quick'], cases: many }).result;

    expect(outcome).toMatchObject({ ran: true, report: { quick: true } });
    expect(gemini.calls.length).toBeGreaterThan(0);
    expect(gemini.calls.length).toBeLessThan(5);
  });
});

describe('runEval with NPC cases', () => {
  it('plays the script against a real NPC session and passes a conversation that meets every bar', async () => {
    const live = fakeLive(goodBarista);

    const outcome = await run({ fetch: fakeGemini(goodAnswers).fetch, live, cases: npcOnly(LATTE_ORDER) }).result;

    expect(outcome).toMatchObject({ ran: true, passed: true });
    if (!outcome.ran) return;
    expect(outcome.report.npc[0]).toMatchObject({
      id: 'zh-npc-latte',
      outcome: 'completed',
      outcomeMatches: true,
      transcript: [
        { speaker: 'npc', text: '欢迎光临！您要点什么？' },
        { speaker: 'player', text: '我要一百拿铁', tag: 'noisy' },
        { speaker: 'npc', text: '一杯热拿铁，对吗？' },
        { speaker: 'player', text: '对', tag: 'clean' },
        { speaker: 'tool', name: 'serve_order', response: { result: 'served' } },
        { speaker: 'npc', text: '好的，请拿好。慢走！' },
      ],
    });
    expect(outcome.report.metrics).toMatchObject({ noisyUnderstood: 1, npcOutcomeMatches: 1 });
    expect(live.sessions[0]!.url).toContain('access_token=auth_tokens%2Ftest-token');
  });

  const GIBBERISH: NpcCase = {
    id: 'zh-npc-gibberish',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'C1',
    turns: [
      { tag: 'gibberish', text: '呃啊嗯那个嗯' },
      { tag: 'gibberish', text: 'blorp' },
      { tag: 'clean', text: '我要一杯拿铁' },
    ],
    expected: { outcome: 'outOfPatience' },
  };

  it('answers not_understood the way the game does: Patience runs out, and the NPC ends the conversation', async () => {
    const outcome = await run({ fetch: fakeGemini(goodAnswers).fetch, cases: npcOnly(GIBBERISH) }).result;

    expect(outcome).toMatchObject({ ran: true, passed: true, report: { metrics: { gibberishAccepted: 0, npcOutcomeMatches: 1 } } });
    if (!outcome.ran) return;
    const [result] = outcome.report.npc;
    expect(result).toMatchObject({ outcome: 'outOfPatience' });
    expect(result!.transcript.filter((e) => e.speaker === 'tool').map((e) => 'response' in e && e.response)).toEqual([
      { result: 'noted' },
      { result: 'out_of_patience' },
    ]);
    // The third turn is never sent: the conversation is over.
    expect(result!.transcript.filter((e) => e.speaker === 'player')).toHaveLength(2);
  });

  it('counts the Live sessions and their judging in the estimated cost, and opens no session when the dev declines', async () => {
    const live = fakeLive(goodBarista);
    const gemini = fakeGemini(goodAnswers);

    const { result, log } = run({ fetch: gemini.fetch, live, cases: npcOnly(LATTE_ORDER), confirm: async () => false });
    await result;

    expect(log[0]).toMatch(/1 NPC and .*1 Live sessions.*≈ \$0\.0[1-9]/);
    expect(live.sessions).toHaveLength(0);
    expect(gemini.calls).toHaveLength(0);
  });

  /** A 16 kHz mono 16-bit WAV of `samples` samples of silence, as the dev's recordings are saved. */
  function wav(samples: number) {
    const bytes = new Uint8Array(44 + samples * 2);
    const view = new DataView(bytes.buffer);
    const text = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16_000, true);
    view.setUint32(28, 32_000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, samples * 2, true);
    return bytes;
  }

  const SPOKEN_ORDER: NpcCase = {
    ...LATTE_ORDER,
    id: 'zh-npc-latte-spoken',
    turns: [{ tag: 'noisy', recording: 'zh-latte.wav' }, LATTE_ORDER.turns[1]!],
  };

  it('skips a case whose recording is missing, and says so', async () => {
    const live = fakeLive(goodBarista);

    const { result, log } = run({ fetch: fakeGemini(goodAnswers).fetch, live, cases: npcOnly(SPOKEN_ORDER, LATTE_ORDER) });
    const outcome = await result;

    expect(outcome).toMatchObject({ ran: true, passed: true, report: { skipped: [{ id: 'zh-npc-latte-spoken', missing: ['zh-latte.wav'] }] } });
    expect(live.sessions).toHaveLength(1);
    expect(log.join('\n')).toContain('zh-npc-latte-spoken');
  });

  it("sends a recording as the player's voice, and keeps what the NPC heard", async () => {
    const live = fakeLive((heard) => ('audio' in heard ? [{ heard: '我要一百拿铁' }, { say: '一杯热拿铁，对吗？' }] : goodBarista(heard)));

    const outcome = await run({ fetch: fakeGemini(goodAnswers).fetch, live, cases: npcOnly(SPOKEN_ORDER), recordings: { 'zh-latte.wav': wav(4_000) } }).result;

    expect(outcome).toMatchObject({ ran: true, passed: true });
    if (!outcome.ran) return;
    expect(outcome.report.npc[0]!.transcript[1]).toEqual({ speaker: 'player', turn: 0, text: 'zh-latte.wav', tag: 'noisy', heardAs: '我要一百拿铁' });
    // 4,000 samples go as ~100 ms chunks of 1,600 samples: 3200, 3200 and 1600 bytes.
    const chunks = live.sessions[0]!.sent.flatMap((m) => {
      const audio = (m as { realtimeInput?: { audio?: { data: string } } }).realtimeInput?.audio;
      return audio ? [Buffer.from(audio.data, 'base64').length] : [];
    });
    expect(chunks).toEqual([3200, 3200, 1600]);
  });

  it('picks about 10% of the judge verdicts, at least one, for the dev to spot-check', async () => {
    const twelve = Array.from({ length: 12 }, (_, i) => ({ ...LATTE_ORDER, id: `zh-npc-latte-${i}` }));

    const { result, log } = run({ fetch: fakeGemini(goodAnswers).fetch, cases: npcOnly(...twelve) });
    const outcome = await result;

    if (!outcome.ran) throw new Error('did not run');
    // Three NPC lines each, and a read-back verdict each: 48 verdicts.
    expect(outcome.report.spotCheck).toHaveLength(5);
    expect(outcome.report.spotCheck[0]).toMatchObject({ id: expect.stringMatching(/^zh-npc-latte-/), verdict: expect.any(String), why: expect.any(String) });
    expect(log.join('\n')).toMatch(/spot-check 5 judge verdicts/i);
  });

  it('fails the run, without waiting out the turn timeout, when the Live connection drops', async () => {
    const dropping: FakeNpc = (heard) => ('text' in heard && heard.text.includes('拿铁') ? [{ drop: true }] : goodBarista(heard));
    const started = Date.now();

    const outcome = await run({ fetch: fakeGemini(goodAnswers).fetch, live: fakeLive(dropping), cases: npcOnly(LATTE_ORDER) }).result;

    expect(failedBars(outcome)).toContain('every NPC conversation played to its end');
    if (!outcome.ran) return;
    expect(outcome.report.npc[0]!.error).toBe('the Live connection dropped');
    expect(Date.now() - started).toBeLessThan(900);
  });

  it('fails the run when gibberish is accepted too often', async () => {
    const lenient: FakeNpc = (heard) => ('text' in heard && !heard.text.startsWith('[SCENE') ? [{ say: '好的。' }] : goodBarista(heard));

    const outcome = await run({ fetch: fakeGemini(goodAnswers).fetch, live: fakeLive(lenient), cases: npcOnly(GIBBERISH) }).result;

    expect(failedBars(outcome)).toEqual(['gibberishAccepted ≤ 10.0%']);
  });

  it('fails the run on an NPC line outside the Target Language, but allows loanwords', async () => {
    const slips: FakeNpc = (heard) => {
      if ('text' in heard && heard.text.startsWith('[SCENE')) return [{ say: '欢迎光临！要 latte 还是 coffee？' }];
      if ('text' in heard && heard.text.includes('拿铁')) return [{ say: 'One latte, is that right?' }];
      return goodBarista(heard);
    };

    const outcome = await run({ fetch: fakeGemini(goodAnswers).fetch, live: fakeLive(slips), cases: npcOnly(LATTE_ORDER) }).result;

    expect(failedBars(outcome)).toEqual(['no NPC line outside the Target Language']);
    if (!outcome.ran) return;
    const bar = outcome.report.bars.find((b) => b.name === 'no NPC line outside the Target Language')!;
    expect(bar.detail).toContain('One latte, is that right?');
    expect(bar.detail).not.toContain('欢迎光临');
  });

  it('asks the judge whether each NPC line suits the step, and fails the run when too few do', async () => {
    const gemini = fakeGemini((call) => {
      if (call.model !== MODELS.evalJudge) return goodAnswers(call);
      const verdict = fairJudge(call) as { lines: { stepAppropriate: boolean }[] };
      return { ...verdict, lines: verdict.lines.map((line, i) => ({ ...line, stepAppropriate: i === 0 })) };
    });

    const outcome = await run({ fetch: gemini.fetch, cases: npcOnly(LATTE_ORDER) }).result;

    expect(failedBars(outcome)).toEqual(['stepAppropriateSpeech ≥ 85.0%']);
    if (!outcome.ran) return;
    expect(outcome.report.metrics.stepAppropriateSpeech).toBeCloseTo(1 / 3);
    const [judged] = gemini.calls.filter((call) => call.model === MODELS.evalJudge);
    expect(judged!.text).toContain('CEFR A1');
    expect(judged!.text).toMatch(/serve_order.*"item":"latte"/);
  });

  it('fails the run when the judge finds the completion arguments differ from the read-back', async () => {
    const gemini = fakeGemini((call) =>
      call.model === MODELS.evalJudge ? { ...(fairJudge(call) as object), argumentsMatchReadBack: false, why: 'Read back a tea.' } : goodAnswers(call),
    );

    const outcome = await run({ fetch: gemini.fetch, cases: npcOnly(LATTE_ORDER) }).result;

    expect(failedBars(outcome)).toEqual(['completion arguments always match the read-back']);
  });

  it('fails the run when the judge finds no read-back before the completion', async () => {
    const gemini = fakeGemini((call) =>
      call.model === MODELS.evalJudge ? { ...(fairJudge(call) as object), readBackConfirmed: false, why: 'Never read back.' } : goodAnswers(call),
    );

    const outcome = await run({ fetch: gemini.fetch, cases: npcOnly(LATTE_ORDER) }).result;

    expect(failedBars(outcome)).toEqual(['no completion before a read-back and confirmation']);
  });

  it('does not ask for a read-back where the goal has none: the nurse lets the patient go once told how they feel', async () => {
    const nurse: FakeNpc = (heard) => {
      if ('toolResponse' in heard) return [{ say: '好的，回家好好休息。' }];
      if ('text' in heard && heard.text.startsWith('[SCENE')) return [{ say: '你醒了！感觉怎么样？' }];
      return [{ call: 'discharge_patient', args: { feeling: 'well' } }];
    };
    const ward: NpcCase = {
      id: 'zh-npc-ward',
      interactionId: 'wake-in-ward',
      targetLanguage: 'zh',
      step: 'A1',
      turns: [{ tag: 'clean', text: '我好多了。' }],
      expected: { outcome: 'completed', args: { feeling: 'well' } },
    };
    const gemini = fakeGemini(goodAnswers);

    const outcome = await run({ fetch: gemini.fetch, live: fakeLive(nurse), cases: npcOnly(ward) }).result;

    expect(outcome).toMatchObject({ ran: true, passed: true });
    const judged = gemini.calls.find((call) => call.model === MODELS.evalJudge)!;
    expect(judged.text).toContain('needs no read-back');
  });

  it('fails the run when the NPC completes before the player has confirmed a read-back', async () => {
    const hasty: FakeNpc = (heard) =>
      'text' in heard && heard.text.includes('拿铁') ? [{ call: 'serve_order', args: { items: [{ item: 'latte', quantity: 1 }] } }] : goodBarista(heard);

    const outcome = await run({ fetch: fakeGemini(goodAnswers).fetch, live: fakeLive(hasty), cases: npcOnly(LATTE_ORDER) }).result;

    expect(failedBars(outcome)).toEqual(['no completion before a read-back and confirmation']);
  });
});
