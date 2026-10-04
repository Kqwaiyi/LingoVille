import { z } from 'zod';
import { CULTURE_PACKS, toGeminiSchema } from '../content/index.ts';
import type { LanguageCode } from '../sim/index.ts';
import { block, LanguageSchema, type GenerateContentBody } from './common.ts';
import { hasReadingAids, SegmentSchema, type ReadingLanguage } from './readings.ts';

/** What `/api/annotate` takes: one NPC line, as soon as the NPC finishes saying it. */
export const AnnotateRequestSchema = z.object({
  targetLanguage: LanguageSchema,
  nativeLanguage: LanguageSchema,
  line: z.string().trim().min(1).max(1000),
});
export type AnnotateRequest = z.infer<typeof AnnotateRequestSchema>;

const translation = z.string().min(1).describe('The line, translated into the Native Language.');

/** What `/api/annotate` answers for en and de: a translation, so Translate is instant. */
const TranslationSchema = z.object({ translation });

/**
 * For zh and ja it also answers the line as segments with readings. They are
 * checked by `checkReadings` before they replace the library readings.
 */
const ReadingAnnotationSchema = z.object({
  translation,
  segments: z.array(SegmentSchema).min(1).describe('The whole line, split into words, each with its reading.'),
});

/**
 * What the gateway accepts from the model and answers: the readings may be
 * missing, and the translation is still worth having without them.
 */
export const AnnotationSchema = TranslationSchema.extend({ segments: ReadingAnnotationSchema.shape.segments.optional() });
export type Annotation = z.infer<typeof AnnotationSchema>;

/** What the model is asked to answer for a line in this Target Language. */
export function annotationSchemaFor(targetLanguage: LanguageCode): z.ZodType<Annotation> {
  return hasReadingAids(targetLanguage) ? ReadingAnnotationSchema : TranslationSchema;
}

const SEGMENTS_RULE =
  '- segments: the whole line split into words, in order. Joined together, the "base" texts must be exactly the line, ' +
  'including punctuation, spaces and numbers.';

const READING_RULES: Record<ReadingLanguage, string[]> = {
  zh: [
    SEGMENTS_RULE,
    '- reading: the pinyin of the word with tone marks (zhǎng, not zhang3), one syllable per hanzi, separated by spaces. ' +
      'Use the reading the word has in this sentence (长得 zhǎng de, 还钱 huán qián), and a neutral tone where it is said with one. ' +
      'Punctuation, numbers and Latin letters get an empty reading.',
  ],
  ja: [
    SEGMENTS_RULE,
    '- reading: for a word with kanji, the whole word in hiragana, read as it is in this sentence ' +
      '(一日中 いちにちじゅう, この方 このかた). Words with no kanji, punctuation and numbers get an empty reading.',
  ],
};

/**
 * The Gemini `generateContent` body that annotates an NPC line: its Native
 * Language translation for every Target Language, and for zh and ja the line
 * as segments with readings. Pure: the same request always gives the same body.
 */
export function buildAnnotateRequest(request: AnnotateRequest): GenerateContentBody {
  const target = CULTURE_PACKS[request.targetLanguage].languageName;
  const native = CULTURE_PACKS[request.nativeLanguage].languageName;
  const readings = hasReadingAids(request.targetLanguage) ? READING_RULES[request.targetLanguage] : [];
  const systemInstruction = block('WHAT TO DO', [
    `The text is one line said by a member of staff in a small town, in ${target}, to a learner who speaks ${native}.`,
    `- translation: what the line means, in natural ${native}. Keep its tone (polite or casual), its numbers and its prices, ` +
      'and translate the meaning rather than word by word.',
    ...readings,
    `Write the translation only in ${native}. Never add notes or explanations.`,
  ]);
  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: request.line }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(annotationSchemaFor(request.targetLanguage)),
    },
  };
}
