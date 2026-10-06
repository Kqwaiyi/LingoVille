import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { toHiragana } from 'wanakana';
import { z } from 'zod';
import {
  annotationSchemaFor,
  buildAnnotateRequest,
  buildRecapRequest,
  checkReadings,
  recapSchemaFor,
  type GenerateContentBody,
  type ReadingLanguage,
  type Recap,
  type RecapRequest,
  type Segment,
} from '../src/ai/index.ts';
import { ENDPOINT_VERSIONS, GEMINI_API_BASE, VOICES } from '../server/config.ts';
import { liveSessionTarget, mintLiveToken } from '../server/gateway.ts';
import type { LiveDeps } from '../src/voice/liveSession.ts';
import { PROFICIENCY_STEPS, type ProficiencyStep } from '../src/sim/index.ts';
import type { AnnotateCase, NpcCase, RecapCase } from './cases/schema.ts';
import { callCost, liveSessionCost, MODEL_FOR, type Endpoint } from './cost.ts';
import { NPC_TIMING, npcSessionFor, playNpcCase, type NpcEvent, type NpcTiming, type RecordedTurn } from './npcConversation.ts';
import { correctionsJudgeRequest, CorrectionsVerdictSchema, npcJudgeRequest } from './judge.ts';
import { npcResult, withVerdict, type NpcResult } from './npcResult.ts';
import { pcmChunks } from './recordings.ts';

export type EvalCases = { recap: RecapCase[]; npc: NpcCase[]; annotate: AnnotateCase[] };

export type EvalOptions = {
  args: string[];
  apiKey: string;
  fetch: typeof globalThis.fetch;
  /** Asks the dev a yes/no question. */
  confirm: (question: string) => Promise<boolean>;
  now: () => Date;
  cases: EvalCases;
  reportsDir: string;
  /** Read only: the harness never writes the baseline. Only a human edits it. */
  baselinePath: string;
  log: (line: string) => void;
  /** Opens a Live socket: Node's WebSocket for a real run. */
  openLiveSocket: LiveDeps['openSocket'];
  /** A recording listed in `recordings/manifest.json`, or null when the dev's file isn't there. */
  readRecording: (file: string) => Promise<Uint8Array | null>;
  npcTiming?: NpcTiming;
};

// --- bars --------------------------------------------------------------------

// Rates, as fractions. `higher` says which way is better.
const RATES = {
  noisyUnderstood: { higher: true, bar: 0.9 },
  gibberishAccepted: { higher: false, bar: 0.1 },
  stepAppropriateSpeech: { higher: true, bar: 0.85 },
  correctionsCorrect: { higher: true, bar: 0.9 },
  npcOutcomeMatches: { higher: true, bar: undefined },
  cefrWithinOneStep: { higher: true, bar: 0.85 },
  annotateValidationFailures: { higher: false, bar: 0.15 },
  annotateGoldReadings: { higher: true, bar: undefined },
} as const satisfies Record<string, { higher: boolean; bar: number | undefined }>;
type Rate = keyof typeof RATES;

/** About this share of the judge's verdicts are picked for the dev to check by hand, so the judge itself is watched. */
const SPOT_CHECK_SHARE = 0.1;

/** How far a rate may fall against the baseline before the run fails, in points. */
const REGRESSION_POINTS = 5;

/** What `--quick` runs: the first few cases per kind and language. */
const QUICK_CASES_PER_LANGUAGE = 2;

/** Model calls in flight at once. */
const CONCURRENCY = 4;

const BaselineSchema = z.object({ metrics: z.partialRecord(z.enum(Object.keys(RATES) as [Rate, ...Rate[]]), z.number().min(0).max(1)) });

// --- calling the model -------------------------------------------------------

type Answer = { ok: true; json: unknown } | { ok: false; error: string };

async function generate(options: EvalOptions, endpoint: Endpoint, body: GenerateContentBody): Promise<Answer> {
  const model = MODEL_FOR[endpoint];
  try {
    const response = await options.fetch(`${GEMINI_API_BASE}/${ENDPOINT_VERSIONS.generateContent}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': options.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const answer = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    if (!response.ok) return { ok: false, error: `${model} ${response.status}: ${JSON.stringify(answer)}` };
    const text = (answer.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
    return { ok: true, json: JSON.parse(text || 'null') };
  } catch (error) {
    return { ok: false, error: `${model}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Runs the tasks at most `limit` at a time, keeping their order. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]!();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// --- cases -------------------------------------------------------------------

function firstPerLanguage<T>(cases: T[], language: (c: T) => string): T[] {
  const seen = new Map<string, number>();
  return cases.filter((c) => {
    const count = seen.get(language(c)) ?? 0;
    seen.set(language(c), count + 1);
    return count < QUICK_CASES_PER_LANGUAGE;
  });
}

function selectCases(cases: EvalCases, quick: boolean): EvalCases {
  if (!quick) return cases;
  return {
    recap: firstPerLanguage(cases.recap, (c) => c.request.culturePackId),
    npc: firstPerLanguage(cases.npc, (c) => c.targetLanguage),
    annotate: firstPerLanguage(cases.annotate, (c) => c.targetLanguage),
  };
}

/** The same request as if the learner had used no Help. */
function withoutHelp(request: RecapRequest): RecapRequest {
  switch (request.kind) {
    case 'goal':
      return { ...request, conversation: { ...request.conversation, helpLog: [] } };
    case 'smallTalk':
      return { ...request, helpLog: [] };
    case 'shift':
      return { ...request, customers: request.customers.map((c) => ({ ...c, helpLog: [] })) };
  }
}

const hasHelp = (request: RecapRequest) => JSON.stringify(withoutHelp(request)) !== JSON.stringify(request);

// --- judging answers ---------------------------------------------------------

const stepIndex = (step: ProficiencyStep) => PROFICIENCY_STEPS.indexOf(step);

type RecapResult = {
  id: string;
  language: string;
  expectedStep: ProficiencyStep;
  estimate: ProficiencyStep | null;
  /** The estimate for the same conversation without its Help log, when it had one. */
  estimateWithoutHelp?: ProficiencyStep | null;
  /** Calls Gemini refused or that never came back: not the model's answer, but the run can't vouch for it. */
  callErrors: string[];
  schemaFailures: string[];
  withinOneStep: boolean;
  helpLowered: boolean;
  /** The Recap's corrections, as it was. */
  corrections: Recap['corrections'];
  /** The judge's verdict on each correction. */
  correctionVerdicts: { correction: number; correct: boolean; why: string }[];
  /** The judge's call failed, or its answer didn't cover every correction. */
  judgeError?: string;
};

function judgeRecap(c: RecapCase, asWas: Answer, noHelp: Answer | undefined): RecapResult {
  const schema = recapSchemaFor(c.request.kind);
  const callErrors: string[] = [];
  const schemaFailures: string[] = [];
  const estimateOf = (answer: Answer, label: string) => {
    if (!answer.ok) {
      callErrors.push(`${label}: ${answer.error}`);
      return null;
    }
    const parsed = schema.safeParse(answer.json);
    if (!parsed.success) {
      schemaFailures.push(`${label}: ${z.prettifyError(parsed.error)}`);
      return null;
    }
    return parsed.data;
  };
  const asItWas = estimateOf(asWas, 'as it was');
  const estimate = asItWas?.cefrEstimate ?? null;
  const corrections = asItWas?.corrections ?? [];
  const estimateWithoutHelp = noHelp && (estimateOf(noHelp, 'without Help')?.cefrEstimate ?? null);
  return {
    id: c.id,
    language: c.request.culturePackId,
    expectedStep: c.expectedStep,
    estimate,
    ...(noHelp && { estimateWithoutHelp }),
    callErrors,
    schemaFailures,
    withinOneStep: estimate !== null && Math.abs(stepIndex(estimate) - stepIndex(c.expectedStep)) <= 1,
    helpLowered: estimate !== null && !!estimateWithoutHelp && stepIndex(estimate) < stepIndex(estimateWithoutHelp),
    corrections,
    correctionVerdicts: [],
  };
}

/** Adds the judge's verdict on each of the Recap's corrections. */
function withCorrectionVerdicts(result: RecapResult, answer: Answer): RecapResult {
  if (!answer.ok) return { ...result, judgeError: answer.error };
  const parsed = CorrectionsVerdictSchema.safeParse(answer.json);
  if (!parsed.success) return { ...result, judgeError: `schema: ${z.prettifyError(parsed.error)}` };
  const correctionVerdicts = result.corrections.flatMap((_, i) => parsed.data.corrections.filter((v) => v.correction === i + 1).slice(0, 1));
  if (correctionVerdicts.length < result.corrections.length) return { ...result, judgeError: 'the judge left out some corrections' };
  return { ...result, correctionVerdicts };
}

/** A whole line's reading, so readings split into words differently can be compared. */
function lineReading(language: ReadingLanguage, segments: Segment[]) {
  if (language === 'zh') return segments.flatMap((s) => s.reading.split(/\s+/).filter(Boolean)).join(' ');
  return toHiragana(segments.map((s) => s.reading || s.base).join(''), { passRomaji: true });
}

type AnnotateResult = {
  id: string;
  language: ReadingLanguage;
  /** Why the readings would not replace the library's, or null if they would. */
  validationFailure: string | null;
  callError: string | null;
  baseMismatch: boolean;
  matchesGold: boolean;
};

function judgeAnnotate(c: AnnotateCase, answer: Answer): AnnotateResult {
  const result = (validationFailure: string | null, baseMismatch = false, matchesGold = false): AnnotateResult => ({
    id: c.id,
    language: c.targetLanguage,
    validationFailure,
    callError: answer.ok ? null : answer.error,
    baseMismatch,
    matchesGold,
  });
  if (!answer.ok) return result(answer.error);
  const parsed = annotationSchemaFor(c.targetLanguage).safeParse(answer.json);
  if (!parsed.success) return result(`schema: ${z.prettifyError(parsed.error)}`);
  const segments = parsed.data.segments ?? [];
  const check = checkReadings(c.targetLanguage, c.line, segments);
  const matchesGold = lineReading(c.targetLanguage, segments) === lineReading(c.targetLanguage, c.gold);
  if (!check.ok) return result(`${check.rule}: ${check.detail}`, check.rule === 'base', matchesGold);
  return result(null, false, matchesGold);
}

// --- scoring -----------------------------------------------------------------

type JudgeVerdict = { id: string; about: string; verdict: string; why: string };

/** Every judge verdict in the run, then an evenly spread ~10% of them (at least one) for the dev to spot-check. */
function spotCheck(recaps: RecapResult[], npcs: NpcResult[]): JudgeVerdict[] {
  const verdicts: JudgeVerdict[] = [
    ...npcs.flatMap((n) => [
      ...n.stepAppropriate.map((s) => ({ id: n.id, about: `NPC line ${s.line} at ${n.step}: "${s.text}"`, verdict: s.appropriate ? 'suits the step' : 'does not suit the step', why: s.why })),
      ...(n.verdict
        ? [
            {
              id: n.id,
              about: 'the read-back and the completion arguments',
              verdict: `read-back ${n.verdict.readBackConfirmed ? 'confirmed' : 'missing'}, arguments ${n.verdict.argumentsMatchReadBack ? 'match' : 'differ'}`,
              why: n.verdict.why,
            },
          ]
        : []),
    ]),
    ...recaps.flatMap((r) =>
      r.correctionVerdicts.map((v) => {
        const correction = r.corrections[v.correction - 1]!;
        return { id: r.id, about: `correction "${correction.said}" → "${correction.natural}"`, verdict: v.correct ? 'correct' : 'wrong', why: v.why };
      }),
    ),
  ];
  if (verdicts.length === 0) return [];
  const picks = Math.ceil(verdicts.length * SPOT_CHECK_SHARE);
  return Array.from({ length: picks }, (_, i) => verdicts[Math.floor((i * verdicts.length) / picks)]!);
}

type Bar = { name: string; passed: boolean; detail: string };

const rate = (hits: number, total: number) => (total === 0 ? undefined : hits / total);
const percent = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

function metricsOf(recaps: RecapResult[], npcs: NpcResult[], annotations: AnnotateResult[]): Partial<Record<Rate, number>> {
  const noisy = npcs.flatMap((n) => n.noisyTurns);
  const gibberish = npcs.flatMap((n) => n.gibberishTurns);
  const spoken = npcs.flatMap((n) => n.stepAppropriate);
  const judgedCorrections = recaps.flatMap((r) => r.correctionVerdicts);
  const metrics: Partial<Record<Rate, number>> = {
    noisyUnderstood: rate(noisy.filter((t) => t.understood).length, noisy.length),
    gibberishAccepted: rate(gibberish.filter((t) => t.accepted).length, gibberish.length),
    stepAppropriateSpeech: rate(spoken.filter((line) => line.appropriate).length, spoken.length),
    correctionsCorrect: rate(judgedCorrections.filter((v) => v.correct).length, judgedCorrections.length),
    npcOutcomeMatches: rate(npcs.filter((n) => n.outcomeMatches).length, npcs.length),
    cefrWithinOneStep: rate(recaps.filter((r) => r.withinOneStep).length, recaps.length),
    annotateValidationFailures: rate(annotations.filter((a) => a.validationFailure !== null).length, annotations.length),
    annotateGoldReadings: rate(annotations.filter((a) => a.matchesGold).length, annotations.length),
  };
  return Object.fromEntries(Object.entries(metrics).filter(([, value]) => value !== undefined));
}

function hardBar(name: string, failures: string[]): Bar {
  return { name, passed: failures.length === 0, detail: failures.length === 0 ? 'no failures' : failures.join('; ') };
}

function bars(recaps: RecapResult[], npcs: NpcResult[], annotations: AnnotateResult[], metrics: Partial<Record<Rate, number>>, baseline: Partial<Record<Rate, number>> | null): Bar[] {
  const result: Bar[] = [
    hardBar('every model call answered', [
      ...recaps.flatMap((r) => r.callErrors.map((e) => `${r.id} (${e})`)),
      ...annotations.flatMap((a) => (a.callError ? [`${a.id} (${a.callError})`] : [])),
      ...[...recaps, ...npcs].flatMap((r) => (r.judgeError ? [`${r.id} judged (${r.judgeError})`] : [])),
    ]),
    hardBar('every NPC conversation played to its end', npcs.flatMap((n) => (n.error ? [`${n.id} (${n.error})`] : []))),
    hardBar('no NPC line outside the Target Language', npcs.flatMap((n) => n.offTargetLines.map((line) => `${n.id}: ${line}`))),
    hardBar(
      'no completion before a read-back and confirmation',
      npcs.flatMap((n) => n.prematureCompletions.map((p) => `${n.id}: ${p}`)),
    ),
    hardBar(
      'completion arguments always match the read-back',
      npcs.flatMap((n) => n.argumentsDifferFromReadBack.map((p) => `${n.id}: ${p}`)),
    ),
    hardBar('every Recap matches its schema', recaps.flatMap((r) => r.schemaFailures.map((f) => `${r.id} (${f})`))),
    hardBar(
      'Help discounting never lowers the CEFR estimate',
      recaps.filter((r) => r.helpLowered).map((r) => `${r.id}: ${r.estimateWithoutHelp} without Help, ${r.estimate} with it`),
    ),
    hardBar(
      '`base` segments join to the line exactly',
      annotations.filter((a) => a.baseMismatch).map((a) => `${a.id}: ${a.validationFailure}`),
    ),
  ];
  for (const [name, { higher, bar }] of Object.entries(RATES) as [Rate, (typeof RATES)[Rate]][]) {
    const value = metrics[name];
    if (value === undefined) continue;
    if (bar !== undefined) {
      const passed = higher ? value >= bar : value <= bar;
      result.push({ name: `${name} ${higher ? '≥' : '≤'} ${percent(bar)}`, passed, detail: percent(value) });
    }
    const before = baseline?.[name];
    if (before !== undefined) {
      // Rounded, so a drop of exactly 5 points isn't read as 5.000000000000004.
      const drop = Math.round((higher ? before - value : value - before) * 100 * 1e6) / 1e6;
      result.push({
        name: `${name} within ${REGRESSION_POINTS} points of the baseline`,
        passed: drop <= REGRESSION_POINTS,
        detail: `${percent(value)} against ${percent(before)}`,
      });
    }
  }
  return result;
}

async function readBaseline(path: string) {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return null;
  }
  return BaselineSchema.parse(JSON.parse(text)).metrics;
}

// --- the run -----------------------------------------------------------------

/** As many corrections as a Recap may hold, for the estimate before the Recaps are written. */
const PLACEHOLDER_CORRECTIONS: Recap['corrections'] = Array.from({ length: 3 }, () => ({ said: '…'.repeat(10), natural: '…'.repeat(10), why: '…'.repeat(40) }));

/** The estimated cost of playing a case and judging it, with a line of about 30 characters for each NPC turn. */
function npcCaseCost(c: NpcCase) {
  const npcLine: NpcEvent = { speaker: 'npc', text: '…'.repeat(30) };
  const transcript = c.turns.flatMap((turn, i): NpcEvent[] => [npcLine, { speaker: 'player', turn: i, text: turn.text ?? '…'.repeat(10), tag: turn.tag }]);
  return liveSessionCost(npcSessionFor(c).systemInstruction, c.turns.length) + callCost('judge', npcJudgeRequest(c, [...transcript, npcLine]).body);
}

/**
 * Reads the recordings the NPC cases use. A case whose recording isn't there is skipped: the audio is the dev's own,
 * and gitignored. A recording that is there but can't be read stops the run.
 */
async function loadRecordings(options: EvalOptions, npcCases: NpcCase[]) {
  const recordings = new Map<string, RecordedTurn>();
  const playable: NpcCase[] = [];
  const skipped: { id: string; missing: string[] }[] = [];
  for (const c of npcCases) {
    const missing: string[] = [];
    for (const file of new Set(c.turns.flatMap((turn) => (turn.recording ? [turn.recording] : [])))) {
      if (recordings.has(file)) continue;
      const wav = await options.readRecording(file);
      if (!wav) missing.push(file);
      else {
        try {
          recordings.set(file, pcmChunks(wav));
        } catch (error) {
          throw new Error(`evals/recordings/${file}: ${error instanceof Error ? error.message : error}`, { cause: error });
        }
      }
    }
    if (missing.length > 0) skipped.push({ id: c.id, missing });
    else playable.push(c);
  }
  return { playable, recordings, skipped };
}

/** Plays one NPC case in a fresh Live session, with its own one-use token. */
async function playCase(options: EvalOptions, c: NpcCase, recordings: Map<string, RecordedTurn>) {
  try {
    const token = await mintLiveToken(options.apiKey, { fetch: options.fetch, now: () => options.now().getTime() });
    const target = liveSessionTarget(VOICES[c.targetLanguage]);
    return await playNpcCase(c, { token, ...target }, options.openLiveSocket, recordings, options.npcTiming ?? NPC_TIMING);
  } catch (error) {
    return { transcript: [], outcome: 'open' as const, error: error instanceof Error ? error.message : String(error) };
  }
}

/** `npm run eval`: checks the real models against the hard bars, the rate bars and the baseline. */
export async function runEval(options: EvalOptions) {
  const startedAt = options.now();
  const quick = options.args.includes('--quick');
  const selected = selectCases(options.cases, quick);
  const { playable, recordings, skipped } = await loadRecordings(options, selected.npc);
  const cases = { ...selected, npc: playable };
  // A quick run's rates rest on a few cases each, so one miss moves them more than the regression rule allows.
  const baseline = quick ? null : await readBaseline(options.baselinePath);

  const recapCalls = cases.recap.map((c) => ({
    case: c,
    asWas: buildRecapRequest(c.request),
    noHelp: hasHelp(c.request) ? buildRecapRequest(withoutHelp(c.request)) : undefined,
  }));
  const annotateCalls = cases.annotate.map((c) => ({ case: c, body: buildAnnotateRequest(c) }));
  const bodies: { endpoint: Endpoint; body: GenerateContentBody }[] = [
    ...recapCalls.flatMap(({ asWas, noHelp }) => (noHelp ? [asWas, noHelp] : [asWas]).map((body) => ({ endpoint: 'recap' as const, body }))),
    ...annotateCalls.map(({ body }) => ({ endpoint: 'annotate' as const, body })),
  ];
  const estimatedCost =
    bodies.reduce((sum, { endpoint, body }) => sum + callCost(endpoint, body), 0) +
    cases.npc.reduce((sum, c) => sum + npcCaseCost(c), 0) +
    // At most one judging of each Recap's corrections.
    cases.recap.reduce((sum, c) => sum + callCost('judge', correctionsJudgeRequest(c.request, PLACEHOLDER_CORRECTIONS)), 0);

  options.log(`${quick ? 'Quick run: ' : ''}${cases.recap.length} Recap, ${cases.npc.length} NPC and ${cases.annotate.length} annotate cases: ${bodies.length} model calls, ${cases.npc.length} Live sessions and the judge, ≈ $${estimatedCost.toFixed(2)}.`);
  for (const s of skipped) options.log(`Skipping ${s.id}: no recording ${s.missing.join(', ')} in evals/recordings.`);
  if (quick) options.log('Quick run: rates are checked against their bars, not the baseline.');
  else if (!baseline) options.log(`No baseline at ${options.baselinePath}: rates are checked against their bars only.`);
  if (!(await options.confirm('Continue?'))) return { ran: false as const };

  const call = (endpoint: Endpoint, body: GenerateContentBody) => () => generate(options, endpoint, body);
  const recaps = await pool(
    recapCalls.map((c) => async () => {
      const [asWas, noHelp] = await Promise.all([call('recap', c.asWas)(), c.noHelp && call('recap', c.noHelp)()]);
      const result = judgeRecap(c.case, asWas, noHelp);
      if (result.corrections.length === 0) return result;
      return withCorrectionVerdicts(result, await call('judge', correctionsJudgeRequest(c.case.request, result.corrections))());
    }),
    CONCURRENCY,
  );
  const annotations = await pool(
    annotateCalls.map((c) => async () => judgeAnnotate(c.case, await call('annotate', c.body)())),
    CONCURRENCY,
  );

  // One Live session at a time: each one is a whole conversation.
  const npcs: NpcResult[] = [];
  for (const c of cases.npc) {
    const result = npcResult(c, await playCase(options, c, recordings));
    const judged = npcJudgeRequest(c, result.transcript);
    // Nothing to judge when the NPC never spoke.
    npcs.push(judged.npcLines.length === 0 ? result : withVerdict(c, result, judged.npcLines, await call('judge', judged.body)()));
  }

  const metrics = metricsOf(recaps, npcs, annotations);
  const checked = bars(recaps, npcs, annotations, metrics, baseline);
  const passed = checked.every((bar) => bar.passed);
  const spotChecks = spotCheck(recaps, npcs);
  const report = { startedAt: startedAt.toISOString(), quick, passed, estimatedCost, models: MODEL_FOR, metrics, baseline, bars: checked, spotCheck: spotChecks, recaps, npc: npcs, skipped, annotations };

  await mkdir(options.reportsDir, { recursive: true });
  const reportPath = join(options.reportsDir, `${startedAt.toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const bar of checked) options.log(`${bar.passed ? 'PASS' : 'FAIL'}  ${bar.name}: ${bar.detail}`);
  if (spotChecks.length > 0) options.log(`Spot-check ${spotChecks.length} judge verdicts by hand: "spotCheck" in the report.`);
  options.log(`${passed ? 'Passed' : 'Failed'}. Report: ${reportPath}`);
  return { ran: true as const, passed, reportPath, report };
}
