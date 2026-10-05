import { z } from 'zod';
import {
  interactionFacts,
  toToolDeclaration,
  type CulturePack,
  type FunctionDeclaration,
  type Interaction,
  type NamedNpc,
  type NamedNpcId,
} from '../content/index.ts';
import { weekdayOf, type GameState, type LanguageCode, type ProficiencyStep } from '../sim/index.ts';

/**
 * Which voice the NPC speaks with. The gateway resolves it to a prebuilt voice,
 * because voices live only in the gateway config.
 */
export type VoiceRequest = { targetLanguage: LanguageCode; npcId: NamedNpcId };

export type NpcSession = {
  systemInstruction: string;
  tools: FunctionDeclaration[];
  voice: VoiceRequest;
};

export type NpcSessionContext = {
  clock: GameState['clock'];
};

export const NOT_UNDERSTOOD_TOOL = 'not_understood';

// What the game answers each tool call with. The system instruction tells the NPC what each answer means.
export type CompletionResponse = { result: 'served' } | { result: 'cannot_afford' } | { result: 'invalid_arguments'; error: string };
export type NotUnderstoodResponse = { result: 'noted' } | { result: 'out_of_patience' };
export type ToolResponse = CompletionResponse | NotUnderstoodResponse | { result: 'unknown_tool' };

/**
 * Sent instead of the player's turn when an unreadable transcript uses up the
 * last of the NPC's Patience, so the NPC ends the conversation.
 */
export const OUT_OF_PATIENCE_SCENE =
  "[SCENE: Again you couldn't make sense of anything the customer said, and you have run out of patience. " +
  'Apologise politely and say goodbye: the conversation is over.]';

/** Opens every conversation, so the NPC speaks first. */
export const GREETING_SCENE = '[SCENE: A customer walks up to you. Greet them first.]';

/**
 * Follows the conversation so far when a session replaces one whose connection
 * dropped, so the NPC carries on instead of greeting again.
 */
export const RESUME_SCENE =
  '[SCENE: You were interrupted for a moment, and the customer is still with you. ' +
  "Don't greet them again: say sorry for the wait in a few words and carry on from where you left off.]";

const NOT_UNDERSTOOD = toToolDeclaration(
  NOT_UNDERSTOOD_TOOL,
  'Call this only when you could not make sense of what the customer just said at all: gibberish, nothing heard, ' +
    'or a whole sentence in a language other than yours. Do not call it if you understood their meaning, even roughly.',
  z.object({ reason: z.enum(['unintelligible', 'other_language', 'nothing_heard']) }),
);

// Block 4: how the NPC speaks at each Proficiency Step: vocabulary and grammar,
// how much it says per turn, its speed, whether it offers choices up front, and
// (at A1–A2) one simpler rephrase the first time the customer seems lost.
const STEP_ADAPTATION: Record<ProficiencyStep, string[]> = {
  A1: [
    'The customer is a beginner (CEFR A1). Use only the most common words and the simplest grammar.',
    'Say one very short sentence per turn.',
    'Speak slowly and clearly.',
    'Offer choices up front (for example "hot or iced?"), so they can answer with a word.',
    'The first time they seem lost, say the same thing once more, more simply. After that, just ask again.',
  ],
  A2: [
    'The customer is an elementary learner (CEFR A2). Use everyday words and simple grammar.',
    'Say one or two short sentences per turn.',
    'Speak slowly and clearly.',
    'Offer choices up front when it helps.',
    'The first time they seem lost, say the same thing once more, more simply. After that, just ask again.',
  ],
  B1: [
    'The customer is an intermediate learner (CEFR B1). Use everyday vocabulary and plain grammar.',
    'Say one or two sentences per turn.',
    'Speak plainly, a little slower than natural speed.',
    'Ask open questions, and offer choices only if they hesitate.',
  ],
  B2: [
    'The customer is an upper-intermediate learner (CEFR B2). Use the vocabulary normal in your job.',
    'Say as much per turn as you naturally would at work.',
    'Speak at natural speed.',
    'Let them volunteer the details rather than offering choices.',
  ],
  C1: [
    'The customer is an advanced learner (CEFR C1). Use the idioms and set phrases normal in your job.',
    'Say as much per turn as you naturally would at work.',
    'Speak at natural speed.',
    'Let them volunteer the details; expect them to.',
  ],
  C2: [
    'The customer speaks at near-native level (CEFR C2). Speak exactly as you would to a local, with no simplification.',
    'Say as much per turn as you naturally would at work.',
    'Speak at natural speed.',
    'Let them volunteer the details; expect them to.',
  ],
};

const DAY_PARTS: { from: number; name: string }[] = [
  { from: 0, name: 'night' },
  { from: 5 * 60, name: 'morning' },
  { from: 12 * 60, name: 'afternoon' },
  { from: 17 * 60, name: 'evening' },
  { from: 21 * 60, name: 'night' },
];

function formatTime(minuteOfDay: number) {
  const whole = Math.floor(minuteOfDay);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

function dayPart(minuteOfDay: number) {
  return DAY_PARTS.filter((part) => part.from <= minuteOfDay).at(-1)!.name;
}

function capitalise(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function block(heading: string, lines: string[]) {
  return `${heading}\n${lines.join('\n')}`;
}

function personaBlock(npc: NamedNpc, pack: CulturePack) {
  const { name } = pack.personas[npc.id];
  return block('WHO YOU ARE', [
    `You are ${name}, the ${npc.role} at ${pack.cafe.name}, a café in a small town in ${pack.setting}, where everyone speaks ${pack.languageName}.`,
    `You are ${npc.age}: ${npc.temperament}. Quirks: ${npc.quirks}.`,
    'Talk like a real, friendly person at work.',
  ]);
}

function youAndThisPersonBlock() {
  return block('YOU AND THIS PERSON', [
    "This customer is a stranger: you have never met. You don't know their name and don't ask for it.",
    'Speak to them politely, as you would to any customer.',
  ]);
}

function languageRulesBlock(pack: CulturePack) {
  const language = pack.languageName;
  return block('LANGUAGE RULES', [
    `- Speak only ${language}. Never use any other language, even if the customer does, even to help them.`,
    `- You understand loanwords and international words (for example "coffee" or "latte"), alone or inside fragmentary ${language}.`,
    '- If you cannot make sense of what they said at all (gibberish, nothing heard, or a whole sentence in another language), ' +
      `first call not_understood, then say briefly in simple ${language} that you didn't understand.`,
    '- If you understood their meaning, even with mistakes, do not call not_understood. If you need a detail, just ask: clarifying is normal and costs nothing.',
    `- If not_understood answers "out_of_patience", apologise politely in ${language} and say goodbye: the conversation is over.`,
    '- Never mention tools, functions, patience or that this is a game.',
  ]);
}

function stepBlock(step: ProficiencyStep) {
  return block('HOW TO SPEAK', STEP_ADAPTATION[step]);
}

function factsBlock(interaction: Interaction, pack: CulturePack) {
  return block('FACTS', [
    "Answer side questions using only these facts. If asked something not covered, say you don't know.",
    ...interactionFacts(interaction, pack.id).map((fact) => `- ${fact}`),
  ]);
}

function goalBlock(interaction: Interaction) {
  const { name } = interaction.completion;
  return block('YOUR GOAL', [
    interaction.goal,
    '- Before you act on it, read back what you understood, with the price, and wait for the customer to confirm. If they correct you, read it back again.',
    `- Only once they have confirmed your read-back, call ${name} with exactly what they confirmed. Never call it before.`,
    `- If ${name} answers "cannot_afford", tell them kindly that they don't have enough money and ask whether they would like something else. The conversation goes on.`,
    `- If ${name} answers "invalid_arguments", ask them again what they would like.`,
    `- If ${name} answers "served", hand it over, thank them and say goodbye.`,
  ]);
}

function situationBlock(context: NpcSessionContext) {
  const { day, minuteOfDay } = context.clock;
  return block('THE SITUATION', [
    `It is ${formatTime(minuteOfDay)} on a ${capitalise(weekdayOf(day))} ${dayPart(minuteOfDay)}.`,
    'A "[SCENE: ...]" message tells you what is happening; it is not the customer speaking. ' +
      'The first one means a customer has just walked up to you: greet them first.',
  ]);
}

/**
 * Everything a Live session needs to play this NPC in this Goal Interaction.
 * Pure: the same inputs always give the same session. The Character's money is
 * never an input, because the sim checks affordability.
 */
export function buildNpcSession(
  interaction: Interaction,
  culturePack: CulturePack,
  proficiencyStep: ProficiencyStep,
  npc: NamedNpc,
  context: NpcSessionContext,
): NpcSession {
  const systemInstruction = [
    personaBlock(npc, culturePack),
    youAndThisPersonBlock(),
    languageRulesBlock(culturePack),
    stepBlock(proficiencyStep),
    factsBlock(interaction, culturePack),
    goalBlock(interaction),
    situationBlock(context),
  ].join('\n\n');

  return {
    systemInstruction,
    tools: [interaction.toolDeclaration, NOT_UNDERSTOOD],
    voice: { targetLanguage: culturePack.id, npcId: npc.id },
  };
}
