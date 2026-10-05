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
  type RecapRequest,
  type Segment,
} from '../src/ai/index.ts';
import { ENDPOINT_VERSIONS, GEMINI_API_BASE } from '../server/config.ts';
import { PROFICIENCY_STEPS, type ProficiencyStep } from '../src/sim/index.ts';
import type { AnnotateCase, RecapCase } from './cases/schema.ts';
import { callCost, MODEL_FOR, type Endpoint } from './cost.ts';

export type EvalCases = { recap: RecapCase[]; annotate: AnnotateCase[] };

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
};

// --- bars --------------------------------------------------------------------

// Rates, as fractions. `higher` says which way is better.
const RATES = {
  cefrWithinOneStep: { higher: true, bar: 0.85 },
  annotateValidationFailures: { higher: false, bar: 0.15 },
  annotateGoldReadings: { higher: true, bar: undefined },
} as const satisfies Record<string, { higher: boolean; bar: number | undefined }>;
type Rate = keyof typeof RATES;

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
    return parsed.data.cefrEstimate;
  };
  const estimate = estimateOf(asWas, 'as it was');
  const estimateWithoutHelp = noHelp && estimateOf(noHelp, 'without Help');
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
  };
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

type Bar = { name: string; passed: boolean; detail: string };

const rate = (hits: number, total: number) => (total === 0 ? undefined : hits / total);
const percent = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

function metricsOf(recaps: RecapResult[], annotations: AnnotateResult[]): Partial<Record<Rate, number>> {
  const metrics: Partial<Record<Rate, number>> = {
    cefrWithinOneStep: rate(recaps.filter((r) => r.withinOneStep).length, recaps.length),
    annotateValidationFailures: rate(annotations.filter((a) => a.validationFailure !== null).length, annotations.length),
    annotateGoldReadings: rate(annotations.filter((a) => a.matchesGold).length, annotations.length),
  };
  return Object.fromEntries(Object.entries(metrics).filter(([, value]) => value !== undefined));
}

function hardBar(name: string, failures: string[]): Bar {
  return { name, passed: failures.length === 0, detail: failures.length === 0 ? 'no failures' : failures.join('; ') };
}

function bars(recaps: RecapResult[], annotations: AnnotateResult[], metrics: Partial<Record<Rate, number>>, baseline: Partial<Record<Rate, number>> | null): Bar[] {
  const result: Bar[] = [
    hardBar('every model call answered', [
      ...recaps.flatMap((r) => r.callErrors.map((e) => `${r.id} (${e})`)),
      ...annotations.flatMap((a) => (a.callError ? [`${a.id} (${a.callError})`] : [])),
    ]),
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

/** `npm run eval`: checks the real models against the hard bars, the rate bars and the baseline. */
export async function runEval(options: EvalOptions) {
  const startedAt = options.now();
  const quick = options.args.includes('--quick');
  const cases = selectCases(options.cases, quick);
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
  const estimatedCost = bodies.reduce((sum, { endpoint, body }) => sum + callCost(endpoint, body), 0);

  options.log(`${quick ? 'Quick run: ' : ''}${cases.recap.length} Recap and ${cases.annotate.length} annotate cases, ${bodies.length} model calls, ≈ $${estimatedCost.toFixed(2)}.`);
  if (quick) options.log('Quick run: rates are checked against their bars, not the baseline.');
  else if (!baseline) options.log(`No baseline at ${options.baselinePath}: rates are checked against their bars only.`);
  if (!(await options.confirm('Continue?'))) return { ran: false as const };

  const call = (endpoint: Endpoint, body: GenerateContentBody) => () => generate(options, endpoint, body);
  const recaps = await pool(
    recapCalls.map((c) => async () => {
      const [asWas, noHelp] = await Promise.all([call('recap', c.asWas)(), c.noHelp && call('recap', c.noHelp)()]);
      return judgeRecap(c.case, asWas, noHelp);
    }),
    CONCURRENCY,
  );
  const annotations = await pool(
    annotateCalls.map((c) => async () => judgeAnnotate(c.case, await call('annotate', c.body)())),
    CONCURRENCY,
  );

  const metrics = metricsOf(recaps, annotations);
  const checked = bars(recaps, annotations, metrics, baseline);
  const passed = checked.every((bar) => bar.passed);
  const report = { startedAt: startedAt.toISOString(), quick, passed, estimatedCost, models: MODEL_FOR, metrics, baseline, bars: checked, recaps, annotations };

  await mkdir(options.reportsDir, { recursive: true });
  const reportPath = join(options.reportsDir, `${startedAt.toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const bar of checked) options.log(`${bar.passed ? 'PASS' : 'FAIL'}  ${bar.name}: ${bar.detail}`);
  options.log(`${passed ? 'Passed' : 'Failed'}. Report: ${reportPath}`);
  return { ran: true as const, passed, reportPath, report };
}
