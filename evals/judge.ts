import { z } from 'zod';
import type { GenerateContentBody, Recap, RecapRequest } from '../src/ai/index.ts';
import { CULTURE_PACKS, toGeminiSchema } from '../src/content/index.ts';
import type { ProficiencyStep } from '../src/sim/index.ts';
import type { NpcCase } from './cases/schema.ts';
import { interactionById, needsReadBack, type NpcEvent } from './npcConversation.ts';

// The judge (`MODELS.evalJudge`, a stronger model than the ones it judges) and its fixed rubric. It rates what a script can't: whether NPC speech suits the
// Proficiency Step, whether a completion matched the read-back the player confirmed, and whether Recap corrections are right.
// Change the rubric only on purpose: the baseline's rates were judged with it.

/** What speech suits each step, written for the judge, separately from the NPC prompt it is checking. */
const STEP_RUBRIC: Record<ProficiencyStep, string> = {
  A1: 'a beginner: only the most common words and the simplest grammar, one very short sentence per turn, choices offered so they can answer with a word',
  A2: 'an elementary learner: everyday words and simple grammar, one or two short sentences per turn, choices offered when it helps',
  B1: 'an intermediate learner: everyday vocabulary and plain grammar, one or two sentences per turn, open questions',
  B2: 'an upper-intermediate learner: the vocabulary normal in the job, as much per turn as is natural at work',
  C1: 'an advanced learner: natural speech with the idioms and set phrases of the job, no simplification needed',
  C2: 'a near-native speaker: speech exactly as to a local, with no simplification at all',
};

const RUBRIC = [
  'You are a strict, fair examiner of a language-learning game. Judge only what you are asked, from the transcript given.',
  '- Step-appropriate speech: a line suits the step if a learner at that level could follow it and it is no harder than the rubric allows. ' +
    'At B2 and above, a line also fails if it is simplified far below the level. Greetings and set phrases of the job always suit any step. ' +
    'A short apology for not understanding suits any step.',
  '- Read-back: before a completion call, the NPC must have said back the details the call carries (the items and quantities, the amount, ' +
    'the name, the days, the item, the choices) and the player must have agreed. Agreeing to a different read-back does not count.',
  '- Arguments: the completion arguments must match that confirmed read-back exactly. Ids stand for the items as FACTS name them.',
  '- If the NPC never called the completion, answer true for the read-back and the arguments.',
  'Give each verdict a "why" of one short sentence in English.',
].join('\n');

export const NpcVerdictSchema = z.object({
  lines: z
    .array(z.object({ line: z.int().describe('The NPC line number.'), stepAppropriate: z.boolean(), why: z.string() }))
    .describe('One verdict per numbered NPC line.'),
  readBackConfirmed: z.boolean().describe('Every completion call came after a read-back the player confirmed.'),
  argumentsMatchReadBack: z.boolean().describe("Every completion call's arguments match the read-back the player confirmed."),
  why: z.string().describe('Why, for the read-back and the arguments.'),
});
export type NpcVerdict = z.infer<typeof NpcVerdictSchema>;

export const CorrectionsVerdictSchema = z.object({
  corrections: z.array(z.object({ correction: z.int().describe('The correction number.'), correct: z.boolean(), why: z.string() })),
});
export type CorrectionsVerdict = z.infer<typeof CorrectionsVerdictSchema>;

function request(prompt: string, schema: z.ZodType): GenerateContentBody {
  return {
    systemInstruction: { parts: [{ text: RUBRIC }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema) },
  };
}

/** The transcript with numbered lines, and the NPC's tool calls between them. Returns the NPC lines' numbers too. */
function numberedTranscript(transcript: NpcEvent[]) {
  const npcLines: { line: number; text: string }[] = [];
  let n = 0;
  const lines = transcript.map((event) => {
    if (event.speaker === 'tool') return `   [NPC called ${event.name}(${JSON.stringify(event.args)}); the game answered ${event.response.result}]`;
    n += 1;
    if (event.speaker === 'npc') {
      npcLines.push({ line: n, text: event.text });
      return `${n}. NPC: ${event.text}`;
    }
    return `${n}. PLAYER: ${event.heardAs ?? event.text}`;
  });
  return { lines, npcLines };
}

/** Asks the judge about one played NPC case. Also returns the NPC line numbers it must give a verdict on. */
export function npcJudgeRequest(c: NpcCase, transcript: NpcEvent[]) {
  const interaction = interactionById(c.interactionId);
  const { lines, npcLines } = numberedTranscript(transcript);
  const prompt = [
    `LANGUAGE: ${CULTURE_PACKS[c.targetLanguage].languageName}`,
    `STEP: CEFR ${c.step}. The learner is ${STEP_RUBRIC[c.step]}.`,
    `THE NPC'S GOAL: ${interaction.goal}`,
    `THE COMPLETION: ${interaction.completion.name}. ${interaction.completion.description}`,
    ...(needsReadBack(interaction) ? [] : ['This completion needs no read-back: answer true for the read-back and the arguments.']),
    '',
    'TRANSCRIPT',
    ...lines,
  ].join('\n');
  return { body: request(prompt, NpcVerdictSchema), npcLines };
}

function recapTranscript(request: RecapRequest) {
  switch (request.kind) {
    case 'goal':
      return request.conversation.transcript;
    case 'smallTalk':
      return request.transcript;
    case 'shift':
      return request.customers.flatMap((customer) => customer.transcript);
  }
}

/** Asks the judge whether each of a Recap's corrections is right. */
export function correctionsJudgeRequest(recapRequest: RecapRequest, corrections: Recap['corrections']) {
  const prompt = [
    `LANGUAGE: ${CULTURE_PACKS[recapRequest.culturePackId].languageName}`,
    `STEP: CEFR ${recapRequest.step}`,
    'A coach wrote these corrections of what the learner said. A correction is correct if "said" is something the learner said ' +
      '(as heard), "natural" is correct and more natural for a learner at this step, and "why" is true. ' +
      'A correction of a mishearing the learner did not make is still correct if "natural" and "why" are right.',
    '',
    'TRANSCRIPT',
    ...recapTranscript(recapRequest).map((line, i) => `${i + 1}. ${line.speaker === 'npc' ? 'NPC' : 'LEARNER'}: ${line.text}`),
    '',
    ...corrections.map((c, i) => `CORRECTION ${i + 1}: said "${c.said}" → natural "${c.natural}". Why: ${c.why}`),
  ].join('\n');
  return request(prompt, CorrectionsVerdictSchema);
}
