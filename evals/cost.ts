import type { GenerateContentBody } from '../src/ai/index.ts';
import { MODELS } from '../server/config.ts';

// Rough per-call costs, so a run can say what it will spend before it spends it.
// Prices are US dollars per million tokens, per endpoint: check them when a model in `server/config.ts` changes.
const PRICES: Record<'recap' | 'annotate' | 'judge', { input: number; output: number }> = {
  recap: { input: 0.3, output: 2.5 },
  annotate: { input: 0.1, output: 0.4 },
  // The judge thinks before it answers, and thinking is billed as output.
  judge: { input: 1.25, output: 10 },
};

// What a call is expected to answer, in tokens: a Recap is a few short lists, an annotation one line.
const OUTPUT_TOKENS: Record<keyof typeof PRICES, number> = { recap: 700, annotate: 250, judge: 2_000 };

// A token is about 4 Latin characters, or 1–2 CJK ones; 3 keeps the estimate on the high side for both.
const CHARS_PER_TOKEN = 3;

export type Endpoint = keyof typeof PRICES;
export const MODEL_FOR: Record<Endpoint, string> = { recap: MODELS.recap, annotate: MODELS.annotate, judge: MODELS.evalJudge };

/** The estimated cost, in US dollars, of one call to an endpoint with this body. */
export function callCost(endpoint: Endpoint, body: GenerateContentBody): number {
  const input = JSON.stringify(body).length / CHARS_PER_TOKEN;
  const price = PRICES[endpoint];
  return (input * price.input + OUTPUT_TOKENS[endpoint] * price.output) / 1_000_000;
}

// Gemini Live: text in, the NPC's audio out. Each NPC turn re-reads the session so far.
const LIVE_PRICES = { input: 0.5, output: 12 };
/** Tokens per turn: what the player says (as text), and what the NPC says (as audio, about 25 tokens a second). */
const LIVE_TOKENS = { playerTurn: 60, npcTurn: 120 };

/** The estimated cost, in US dollars, of one scripted NPC conversation: a greeting, a reply to each player turn and a goodbye. */
export function liveSessionCost(systemInstruction: string, playerTurns: number): number {
  const npcTurns = playerTurns + 2;
  const perTurn = LIVE_TOKENS.playerTurn + LIVE_TOKENS.npcTurn;
  let input = 0;
  for (let turn = 0; turn < npcTurns; turn++) input += systemInstruction.length / CHARS_PER_TOKEN + turn * perTurn;
  return (input * LIVE_PRICES.input + npcTurns * LIVE_TOKENS.npcTurn * LIVE_PRICES.output) / 1_000_000;
}
