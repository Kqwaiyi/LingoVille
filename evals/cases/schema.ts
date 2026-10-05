import { z } from 'zod';
import { READING_LANGUAGES, RecapRequestSchema, SegmentSchema } from '../../src/ai/index.ts';
import { LANGUAGE_CODES, PROFICIENCY_STEPS } from '../../src/sim/index.ts';

// The eval cases, by kind. Each case file under `cases/<kind>/<lang>.ts` parses its cases with these.

/** A canned conversation and its Help log, with the step a fair coach would put the learner at. */
export const RecapCaseSchema = z.object({
  id: z.string().min(1),
  request: RecapRequestSchema,
  expectedStep: z.enum(PROFICIENCY_STEPS),
});
export type RecapCase = z.infer<typeof RecapCaseSchema>;

/** An NPC line in zh or ja, with its readings as a human checked them. */
export const AnnotateCaseSchema = z
  .object({
    id: z.string().min(1),
    targetLanguage: z.enum(READING_LANGUAGES),
    nativeLanguage: z.enum(LANGUAGE_CODES),
    line: z.string().min(1),
    gold: z.array(SegmentSchema).min(1),
  })
  .refine((c) => c.gold.map((segment) => segment.base).join('') === c.line, {
    message: 'the gold segments must join to the line',
  });
export type AnnotateCase = z.infer<typeof AnnotateCaseSchema>;

export const recapCases = (cases: z.input<typeof RecapCaseSchema>[]) => z.array(RecapCaseSchema).parse(cases);
export const annotateCases = (cases: z.input<typeof AnnotateCaseSchema>[]) => z.array(AnnotateCaseSchema).parse(cases);
