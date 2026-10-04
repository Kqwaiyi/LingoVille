import { z } from 'zod';
import { CULTURE_PACKS, toGeminiSchema } from '../content/index.ts';
import { block, LanguageSchema, type GenerateContentBody } from './common.ts';

/** What `/api/annotate` takes: one NPC line, as soon as the NPC finishes saying it. */
export const AnnotateRequestSchema = z.object({
  targetLanguage: LanguageSchema,
  nativeLanguage: LanguageSchema,
  line: z.string().trim().min(1).max(1000),
});
export type AnnotateRequest = z.infer<typeof AnnotateRequestSchema>;

/** What `/api/annotate` answers, so Translate is instant. Readings for zh and ja arrive in ticket 10. */
export const AnnotationSchema = z.object({
  translation: z.string().min(1).describe('The line, translated into the Native Language.'),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

/**
 * The Gemini `generateContent` body that annotates an NPC line: its Native
 * Language translation, for every Target Language. Pure: the same request always gives the same body.
 */
export function buildAnnotateRequest(request: AnnotateRequest): GenerateContentBody {
  const target = CULTURE_PACKS[request.targetLanguage].languageName;
  const native = CULTURE_PACKS[request.nativeLanguage].languageName;
  const systemInstruction = block('WHAT TO DO', [
    `The text is one line said by a member of staff in a small town, in ${target}, to a learner who speaks ${native}.`,
    `- translation: what the line means, in natural ${native}. Keep its tone (polite or casual), its numbers and its prices, ` +
      'and translate the meaning rather than word by word.',
    `Write only in ${native}. Never add notes or explanations.`,
  ]);
  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: request.line }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: toGeminiSchema(AnnotationSchema) },
  };
}
