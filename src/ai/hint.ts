import { z } from 'zod';
import { CULTURE_PACKS, interactionFacts, localPlaceName, NAMED_NPCS, toGeminiSchema } from '../content/index.ts';
import {
  block,
  InteractionIdSchema,
  interactionById,
  LanguageSchema,
  StepSchema,
  transcriptLines,
  TranscriptLineSchema,
  type GenerateContentBody,
} from './common.ts';

/** What `/api/hint` takes: the moment in a conversation the Player opened Help at. */
export const HintRequestSchema = z.object({
  culturePackId: LanguageSchema,
  step: StepSchema,
  nativeLanguage: LanguageSchema,
  interactionId: InteractionIdSchema,
  transcript: z.array(TranscriptLineSchema),
});
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
 * full at every step. Pure: the same request always gives the same body.
 */
export function buildHintRequest(request: HintRequest): GenerateContentBody {
  const pack = CULTURE_PACKS[request.culturePackId];
  const native = CULTURE_PACKS[request.nativeLanguage].languageName;
  const target = pack.languageName;
  const interaction = interactionById(request.interactionId);
  const { role } = NAMED_NPCS[interaction.npcId];

  const systemInstruction = [
    block('WHO YOU ARE', [
      `You help a learner who speaks ${native} and is learning ${target} by living in a small town in ${pack.setting}. ` +
        `Their level is about CEFR ${request.step}.`,
      `They are a customer at ${localPlaceName(interaction.placeId, pack.id)}, talking to the ${role}, and they have asked for help with what to say next.`,
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
      `Write the sentences only in ${target}, and the translations only in ${native}.`,
    ]),
  ].join('\n\n');

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
