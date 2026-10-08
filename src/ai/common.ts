import { z } from 'zod';
import { INTERACTIONS, localPlaceName, NAMED_NPCS, PASSER_BY, type CulturePack, type Interaction, type ToolSchema } from '../content/index.ts';
import { LANGUAGE_CODES, PROFICIENCY_STEPS, type PadDiner, type ShiftOrder } from '../sim/index.ts';

// What the prompted endpoints (Recap, hint, annotate) share.

export const LanguageSchema = z.enum(LANGUAGE_CODES);
export const StepSchema = z.enum(PROFICIENCY_STEPS);

const INTERACTION_IDS = Object.values(INTERACTIONS).map((interaction) => interaction.id) as [string, ...string[]];
export const InteractionIdSchema = z.enum(INTERACTION_IDS);

export function interactionById(id: string): Interaction {
  return Object.values(INTERACTIONS).find((interaction) => interaction.id === id)!;
}

/**
 * Who the learner talks to in a Goal Interaction, by role, and where: "the cashier at スーパーまるやま", or a passer-by
 * at a tram stop. `learnerIs` is how the learner is there: a customer, or someone waiting for the tram.
 */
export function interactionPartner(interaction: Interaction, pack: CulturePack): { role: string; place: string; learnerIs: string } {
  if (interaction.npcId === PASSER_BY) return { role: 'passer-by', place: 'a tram stop', learnerIs: 'at a tram stop' };
  const place = localPlaceName(interaction.placeId, pack.id);
  return { role: NAMED_NPCS[interaction.npcId].role, place, learnerIs: `a customer at ${place}` };
}

/** The items as they're named in this pack, with how a drink made to order is made: "1 × 紅茶 (Lサイズ, アイス, レモン)". */
export function orderSaid(order: ShiftOrder, pack: CulturePack) {
  return order
    .map(({ itemId, quantity, modifiers }) => {
      const options = modifiers ? [modifiers.size, modifiers.temperature, ...modifiers.extras] : [];
      const made = options.map((option) => pack.drinkOptions[option].name).join(', ');
      return `${quantity} × ${pack.goods[itemId].name}${made ? ` (${made})` : ''}`;
    })
    .join(', ');
}

/** One diner's dish and drink, as the pack names them: "ポークソテー and コーラ", or "no drink" for one left off the order pad. */
export function mealSaid({ dish, drink }: PadDiner, pack: CulturePack) {
  return `${dish ? pack.goods[dish].name : 'no dish'} and ${drink ? pack.goods[drink].name : 'no drink'}`;
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
