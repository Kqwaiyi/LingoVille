import type { GenerateContentBody } from '../src/ai/index.ts';
import { MODELS } from '../server/config.ts';

// Rough per-call costs, so a run can say what it will spend before it spends it.
// Prices are US dollars per million tokens, per endpoint: check them when a model in `server/config.ts` changes.
const PRICES: Record<'recap' | 'annotate', { input: number; output: number }> = {
  recap: { input: 0.3, output: 2.5 },
  annotate: { input: 0.1, output: 0.4 },
};

// What a call is expected to answer, in tokens: a Recap is a few short lists, an annotation one line.
const OUTPUT_TOKENS: Record<keyof typeof PRICES, number> = { recap: 700, annotate: 250 };

// A token is about 4 Latin characters, or 1–2 CJK ones; 3 keeps the estimate on the high side for both.
const CHARS_PER_TOKEN = 3;

export type Endpoint = keyof typeof PRICES;
export const MODEL_FOR: Record<Endpoint, string> = { recap: MODELS.recap, annotate: MODELS.annotate };

/** The estimated cost, in US dollars, of one call to an endpoint with this body. */
export function callCost(endpoint: Endpoint, body: GenerateContentBody): number {
  const input = JSON.stringify(body).length / CHARS_PER_TOKEN;
  const price = PRICES[endpoint];
  return (input * price.input + OUTPUT_TOKENS[endpoint] * price.output) / 1_000_000;
}
