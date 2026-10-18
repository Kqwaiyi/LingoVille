import { z } from 'zod';
import { CULTURE_PACKS, interactionFacts, JOB_PLACES, localPlaceName, toGeminiSchema } from '../content/index.ts';
import { JOB_IDS, type JobId } from '../sim/index.ts';
import {
  block,
  InteractionIdSchema,
  interactionById,
  interactionPartner,
  LanguageSchema,
  StepSchema,
  transcriptLines,
  TranscriptLineSchema,
  type GenerateContentBody,
} from './common.ts';

const shared = {
  culturePackId: LanguageSchema,
  step: StepSchema,
  nativeLanguage: LanguageSchema,
  transcript: z.array(TranscriptLineSchema),
};

/**
 * What `/api/hint` takes: the moment in a conversation the Player opened Help at. In a Goal Interaction, the
 * interaction; at a Shift, the Job the Player is working, with a Shift Customer at the counter.
 */
export const HintRequestSchema = z.union([
  z.object({ ...shared, interactionId: InteractionIdSchema }),
  z.object({ ...shared, jobId: z.enum(JOB_IDS) }),
]);
export type HintRequest = z.infer<typeof HintRequestSchema>;

/** What `/api/hint` answers: 2–3 full model sentences, each with its Native Language translation. */
export const HintsSchema = z.object({
  hints: z
    .array(
      z.object({
        text: z.string().min(1).describe('A full sentence the learner could say next, in the Target Language.'),
        translation: z.string().min(1).describe('The sentence, translated into the Native Language.'),
      }),
    )
    .min(2)
    .max(3),
});
export type Hints = z.infer<typeof HintsSchema>;
export type Hint = Hints['hints'][number];

/**
 * The Gemini `generateContent` body for Help's hints: 2–3 full sentences the
 * Player could say next, built from the goal, the facts, the step and the
 * transcript so far. Nothing is authored per interaction, and the hints are as
 * full at every step. At a Shift they are the staff member's own lines, and never
 * help with understanding the customer. Pure: the same request always gives the same body.
 */
export function buildHintRequest(request: HintRequest): GenerateContentBody {
  const systemInstruction = 'jobId' in request ? shiftInstruction(request) : goalInstruction(request);

  const conversation =
    request.transcript.length === 0
      ? ['Nothing has been said yet.']
      : ['The conversation so far:', ...transcriptLines(request.transcript)];

  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: block('THE CONVERSATION', conversation) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: toGeminiSchema(HintsSchema) },
  };
}

/** Who the learner is, and the languages the hints are written in. */
function learner(request: HintRequest) {
  const pack = CULTURE_PACKS[request.culturePackId];
  const native = CULTURE_PACKS[request.nativeLanguage].languageName;
  const target = pack.languageName;
  return {
    pack,
    native,
    target,
    intro:
      `You help a learner who speaks ${native} and is learning ${target} by living in a small town in ${pack.setting}. ` +
      `Their level is about CEFR ${request.step}.`,
    languages: `Write the sentences only in ${target}, and the translations only in ${native}.`,
  };
}

/** Hints in a Goal Interaction: what the learner, the customer, could say next toward the goal. */
function goalInstruction(request: Extract<HintRequest, { interactionId: string }>) {
  const { pack, native, target, intro, languages } = learner(request);
  const interaction = interactionById(request.interactionId);
  const { role, learnerIs } = interactionPartner(interaction, pack);

  return [
    block('WHO YOU ARE', [
      intro,
      `They are ${learnerIs}, talking to the ${role}, and they have asked for help with what to say next.`,
    ]),
    block('THE SITUATION', [
      `The ${role}'s goal: ${interaction.goal}`,
      `What the ${role} knows:`,
      ...interactionFacts(interaction, request.culturePackId).map((fact) => `- ${fact}`),
    ]),
    block('WHAT TO WRITE', [
      `- hints: 2 or 3 different things the learner could say next, each a full sentence in ${target} that moves the conversation on ` +
        "from where it is now. Write them as the learner, the customer, would say them: never the staff member's lines.",
      `- Keep each sentence natural, polite and short enough to say aloud at their level. Use only what the situation offers.`,
      `- translation: each sentence in natural ${native}.`,
      languages,
    ]),
  ].join('\n\n');
}

/** Who a staff member serves at each Job. */
const SERVING: Record<JobId, string> = { barista: 'a customer at the counter', cashier: 'a customer at the counter', server: 'a table' };

/** What a staff member's hints can do at each Job, after greeting the customer. */
const GOOD_SHIFT_HINTS: Record<JobId, string> = {
  barista: 'ask what they would like, ask them to say it again or more slowly, ask which size, or hot or iced, or say that the order is coming.',
  cashier:
    'ask whether they need a bag or have a points card, ask them to say it again or more slowly, ask how they would like to pay, ' +
    'tell them the total, or hand over their change.',
  server: 'ask what they would like to eat and drink, ask them to say it again or more slowly, ask about allergies or dietary needs, or say that the order is coming.',
};

/**
 * Hints at a Shift: the learner's own lines as the staff member. Working out the customer's order by ear is the
 * point of the Shift, so the hints never say, repeat back, guess or translate it.
 */
function shiftInstruction(request: Extract<HintRequest, { jobId: string }>) {
  const { pack, native, target, intro, languages } = learner(request);
  const { jobId } = request;

  return [
    block('WHO YOU ARE', [
      intro,
      `They are working a Shift as the ${jobId} at ${localPlaceName(JOB_PLACES[jobId], pack.id)}, serving ${SERVING[jobId]}, ` +
        'and they have asked for help with what to say next.',
    ]),
    block('THE SITUATION', [
      "The customer has an order the learner has to work out by listening. That is the learner's job, so never do it for them.",
    ]),
    block('WHAT TO WRITE', [
      `- hints: 2 or 3 different things the learner could say next, each a full sentence in ${target} that moves the conversation on ` +
        `from where it is now. Write them as the learner, the ${jobId}, would say them: never the customer's lines.`,
      `- Good hints greet the customer, ${GOOD_SHIFT_HINTS[jobId]}`,
      '- Never say, repeat back, guess or translate what the customer wants, beyond words the learner has already said themselves.',
      `- Keep each sentence natural, polite and short enough to say aloud at their level.`,
      `- translation: each sentence in natural ${native}.`,
      languages,
    ]),
  ].join('\n\n');
}
