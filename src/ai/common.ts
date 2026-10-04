import { z } from 'zod';
import { INTERACTIONS, type Interaction, type ToolSchema } from '../content/index.ts';
import { LANGUAGE_CODES, PROFICIENCY_STEPS } from '../sim/index.ts';

// What the prompted endpoints (Recap, hint, annotate) share.

export const LanguageSchema = z.enum(LANGUAGE_CODES);
export const StepSchema = z.enum(PROFICIENCY_STEPS);

const INTERACTION_IDS = Object.values(INTERACTIONS).map((interaction) => interaction.id) as [string, ...string[]];
export const InteractionIdSchema = z.enum(INTERACTION_IDS);

export function interactionById(id: string): Interaction {
  return Object.values(INTERACTIONS).find((interaction) => interaction.id === id)!;
}

/** One line of a conversation as a prompt reads it. A player line is what the NPC heard, unless it was typed. */
export const TranscriptLineSchema = z.object({
  speaker: z.enum(['npc', 'player']),
  text: z.string(),
  typed: z.boolean().optional(),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

/** A Gemini `generateContent` body with a `responseSchema`. */
export type GenerateContentBody = {
  systemInstruction: { parts: { text: string }[] };
  contents: { role: 'user'; parts: { text: string }[] }[];
  generationConfig: { responseMimeType: 'application/json'; responseSchema: ToolSchema };
};

export function block(heading: string, lines: string[]) {
  return `${heading}\n${lines.join('\n')}`;
}

/** The transcript, numbered from 1, with each player line marked as heard (and maybe misheard) or typed. */
export function transcriptLines(transcript: TranscriptLine[]) {
  const speaker = (line: TranscriptLine) => {
    if (line.speaker === 'npc') return 'NPC';
    return line.typed ? 'PLAYER (typed)' : 'PLAYER (heard as, may be misheard)';
  };
  return transcript.map((line, i) => `${i + 1}. ${speaker(line)}: ${line.text}`);
}
