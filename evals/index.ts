// Entry point of the eval harness (`npm run eval`). Never imported by app or gateway code.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { CASES } from './cases/index.ts';
import { runEval } from './runEval.ts';

const root = join(import.meta.dirname, '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('npm run eval calls the real models: set GEMINI_API_KEY in .env (see .env.example).');
  process.exit(1);
}

async function confirm(question: string) {
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    return /^y(es)?$/i.test((await prompt.question(`${question} [y/N] `)).trim());
  } finally {
    prompt.close();
  }
}

const outcome = await runEval({
  args: process.argv.slice(2),
  apiKey,
  fetch: globalThis.fetch,
  confirm,
  now: () => new Date(),
  cases: CASES,
  reportsDir: join(import.meta.dirname, 'reports'),
  baselinePath: join(import.meta.dirname, 'baseline.json'),
  log: (line) => console.log(line),
});

process.exitCode = outcome.ran && !outcome.passed ? 1 : 0;
