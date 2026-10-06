import { z } from 'zod';
import { GROCERIES_SOLD, INTERACTIONS } from '../../src/content/index.ts';
import { interactionById } from '../npcConversation.ts';
import { READING_LANGUAGES, RecapRequestSchema, SegmentSchema } from '../../src/ai/index.ts';
import { LANGUAGE_CODES, PROFICIENCY_STEPS } from '../../src/sim/index.ts';

// The eval cases, by kind. Each case file under `cases/<kind>/<lang>.ts` parses its cases with these.

/**
 * How a player turn should land. `clean` is plain learner speech. `noisy` is intelligible but garbled (as the voice
 * prototype heard it), so the NPC must understand or repair it at no cost in Patience. `gibberish` must cost Patience.
 */
export const TURN_TAGS = ['clean', 'noisy', 'gibberish'] as const;
export type TurnTag = (typeof TURN_TAGS)[number];

const effectOf = (id: string) => interactionById(id).effect.kind;
const INTERACTION_IDS = Object.values(INTERACTIONS).map((interaction) => interaction.id) as [string, ...string[]];

/** One scripted player turn: typed (or heard) text through `sendText`, or one of the dev's recordings sent as voice. */
export const PlayerTurnSchema = z
  .object({
    tag: z.enum(TURN_TAGS),
    text: z.string().min(1).optional(),
    /** A file listed in `recordings/manifest.json`. A case whose recording is missing is skipped. */
    recording: z.string().min(1).optional(),
    /** This turn confirms the NPC's read-back: the completion may come only after a turn like this. */
    confirms: z.boolean().optional(),
  })
  .refine((turn) => (turn.text === undefined) !== (turn.recording === undefined), { message: 'a turn is either text or a recording' });
export type PlayerTurn = z.infer<typeof PlayerTurnSchema>;

/** How the conversation should end: completed with these arguments (only the keys given are checked), the NPC out of Patience, or still open. */
export const ExpectedNpcOutcomeSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('completed'), args: z.record(z.string(), z.unknown()) }),
  z.object({ outcome: z.literal('outOfPatience') }),
  z.object({ outcome: z.literal('open') }),
]);

/** A scripted conversation with a real NPC session in one Goal Interaction. */
export const NpcCaseSchema = z
  .object({
    id: z.string().min(1),
    interactionId: z.enum(INTERACTION_IDS),
    targetLanguage: z.enum(LANGUAGE_CODES),
    step: z.enum(PROFICIENCY_STEPS),
    /** For hiring: the Character's name, which the applicant's name is checked against. */
    characterName: z.string().min(1).optional(),
    /** At the till: the shopping on the counter. */
    basket: z.array(z.object({ itemId: z.enum(GROCERIES_SOLD), quantity: z.int().min(1) })).optional(),
    turns: z.array(PlayerTurnSchema).min(1),
    expected: ExpectedNpcOutcomeSchema,
  })
  .refine((c) => effectOf(c.interactionId) !== 'hire' || c.characterName !== undefined, { message: "a hiring case needs the Character's name" })
  .refine((c) => effectOf(c.interactionId) !== 'purchase' || (c.basket?.length ?? 0) > 0, { message: 'a case at the till needs shopping on the counter' });
export type NpcCase = z.infer<typeof NpcCaseSchema>;

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

export const npcCases = (cases: z.input<typeof NpcCaseSchema>[]) => z.array(NpcCaseSchema).parse(cases);
export const recapCases = (cases: z.input<typeof RecapCaseSchema>[]) => z.array(RecapCaseSchema).parse(cases);
export const annotateCases = (cases: z.input<typeof AnnotateCaseSchema>[]) => z.array(AnnotateCaseSchema).parse(cases);
