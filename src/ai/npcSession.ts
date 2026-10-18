import { z } from 'zod';
import {
  type Build,
  interactionFacts,
  toToolDeclaration,
  type CulturePack,
  type FunctionDeclaration,
  type Interaction,
  type NamedNpc,
  type NamedNpcId,
} from '../content/index.ts';
import { weekdayOf, type GameState, type LanguageCode, type PlaceId, type ProficiencyStep } from '../sim/index.ts';

/**
 * Which voice the NPC speaks with: a Named NPC's own, or, for a Shift Customer, one that suits the build
 * of their look, drawn by their seed.
 * The gateway resolves it to a prebuilt voice, because voices live only in the gateway config.
 */
export type VoiceRequest =
  | { targetLanguage: LanguageCode; npcId: NamedNpcId }
  | { targetLanguage: LanguageCode; shiftCustomerVoice: number; build: Build };

export type NpcSession = {
  systemInstruction: string;
  tools: FunctionDeclaration[];
  voice: VoiceRequest;
  /** The first message of the session, so the NPC speaks first: the customer walking up. */
  openingScene: string;
};

export type NpcSessionContext = {
  clock: GameState['clock'];
};

export const NOT_UNDERSTOOD_TOOL = 'not_understood';

// What the game answers each tool call with. The system instruction tells the NPC what each answer means.
export type CompletionResponse =
  | { result: 'served' }
  | { result: 'done' }
  | { result: 'cannot_afford' }
  | { result: 'invalid_arguments'; error: string }
  | { result: 'wrong_name' };
export type NotUnderstoodResponse = { result: 'noted' } | { result: 'out_of_patience' };
export type ToolResponse = CompletionResponse | NotUnderstoodResponse | { result: 'unknown_tool' };

/**
 * Sent instead of the player's turn when an unreadable transcript uses up the
 * last of the NPC's Patience, so the NPC ends the conversation.
 */
export const OUT_OF_PATIENCE_SCENE =
  "[SCENE: Again you couldn't make sense of anything the customer said, and you have run out of patience. " +
  'Apologise politely and say goodbye: the conversation is over.]';

/** Opens every conversation the Player starts with E, so the NPC speaks first: a customer walking up. */
export const greetingScene = (who: string) => `[SCENE: A ${who} walks up to you. Greet them first.]`;
export const GREETING_SCENE = greetingScene('customer');

/**
 * Follows the conversation so far when a session replaces one whose connection
 * dropped, so the NPC carries on instead of greeting again.
 */
export const RESUME_SCENE =
  '[SCENE: You were interrupted for a moment, and the customer is still with you. ' +
  "Don't greet them again: say sorry for the wait in a few words and carry on from where you left off.]";

export const notUnderstoodTool = (who: string) =>
  toToolDeclaration(
    NOT_UNDERSTOOD_TOOL,
    `Call this only when you could not make sense of what the ${who} just said at all: gibberish, nothing heard, ` +
      'or a whole sentence in a language other than yours. Do not call it if you understood their meaning, even roughly.',
    z.object({ reason: z.enum(['unintelligible', 'other_language', 'nothing_heard']) }),
  );

/** Where each Named NPC with a conversation works, as their persona introduces it, and what they call the person in front of them. */
type Workplace = { at: (pack: CulturePack) => string; who: string };
const WORKPLACES: Partial<Record<PlaceId, Workplace>> = {
  cafe: { at: (pack) => `${pack.cafe.name}, a café`, who: 'customer' },
  supermarket: { at: (pack) => `${pack.supermarket.name}, a supermarket`, who: 'customer' },
  restaurant: { at: (pack) => `${pack.restaurant.name}, a restaurant`, who: 'customer' },
};

function workplace(npc: NamedNpc): Workplace {
  const found = WORKPLACES[npc.placeId];
  if (!found) throw new Error(`No workplace for ${npc.id} at the ${npc.placeId}`);
  return found;
}

// Block 4: how the NPC speaks at each Proficiency Step (the first line follows "The customer"): vocabulary and grammar,
// how much it says per turn, its speed, whether it offers choices up front, and
// (at A1–A2) one simpler rephrase the first time the customer seems lost.
const STEP_ADAPTATION: Record<ProficiencyStep, string[]> = {
  A1: [
    'is a beginner (CEFR A1). Use only the most common words and the simplest grammar.',
    'Say one very short sentence per turn.',
    'Speak slowly and clearly.',
    'Offer choices up front (for example "hot or iced?"), so they can answer with a word.',
    'The first time they seem lost, say the same thing once more, more simply. After that, just ask again.',
  ],
  A2: [
    'is an elementary learner (CEFR A2). Use everyday words and simple grammar.',
    'Say one or two short sentences per turn.',
    'Speak slowly and clearly.',
    'Offer choices up front when it helps.',
    'The first time they seem lost, say the same thing once more, more simply. After that, just ask again.',
  ],
  B1: [
    'is an intermediate learner (CEFR B1). Use everyday vocabulary and plain grammar.',
    'Say one or two sentences per turn.',
    'Speak plainly, a little slower than natural speed.',
    'Ask open questions, and offer choices only if they hesitate.',
  ],
  B2: [
    'is an upper-intermediate learner (CEFR B2). Use the vocabulary normal in your job.',
    'Say as much per turn as you naturally would at work.',
    'Speak at natural speed.',
    'Let them volunteer the details rather than offering choices.',
  ],
  C1: [
    'is an advanced learner (CEFR C1). Use the idioms and set phrases normal in your job.',
    'Say as much per turn as you naturally would at work.',
    'Speak at natural speed.',
    'Let them volunteer the details; expect them to.',
  ],
  C2: [
    'speaks at near-native level (CEFR C2). Speak exactly as you would to a local, with no simplification.',
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

export function formatTime(minuteOfDay: number) {
  const whole = Math.floor(minuteOfDay);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

export function dayPart(minuteOfDay: number) {
  return DAY_PARTS.filter((part) => part.from <= minuteOfDay).at(-1)!.name;
}

export function capitalise(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function block(heading: string, lines: string[]) {
  return `${heading}\n${lines.join('\n')}`;
}

function personaBlock(npc: NamedNpc, pack: CulturePack) {
  const { name } = pack.personas[npc.id];
  const place = workplace(npc);
  return block('WHO YOU ARE', [
    `You are ${name}, the ${npc.role} at ${place.at(pack)} in a small town in ${pack.setting}, where everyone speaks ${pack.languageName}.`,
    `You are ${npc.age}: ${npc.temperament}. Quirks: ${npc.quirks}.`,
    'Talk like a real, friendly person at work.',
  ]);
}

function youAndThisPersonBlock(interaction: Interaction, who: string) {
  // Hiring asks for the name itself.
  if (interaction.effect.kind === 'hire') {
    return block('YOU AND THIS PERSON', [
      `This ${who} is a stranger: you have never met. You don't know their name yet; asking for it is part of hiring them.`,
      'Speak to them politely, as you would to anyone asking for a job.',
    ]);
  }
  return block('YOU AND THIS PERSON', [
    `This ${who} is a stranger: you have never met. You don't know their name and don't ask for it.`,
    `Speak to them politely, as you would to any ${who}.`,
  ]);
}

export function languageRulesBlock(pack: CulturePack, who: string) {
  const language = pack.languageName;
  return block('LANGUAGE RULES', [
    `- Speak only ${language}. Never use any other language, even if the ${who} does, even to help them.`,
    `- You understand loanwords and international words (for example "coffee" or "latte"), alone or inside fragmentary ${language}.`,
    '- If you cannot make sense of what they said at all (gibberish, nothing heard, or a whole sentence in another language), ' +
      `first call not_understood, then say briefly in simple ${language} that you didn't understand.`,
    '- If you understood their meaning, even with mistakes, do not call not_understood. If you need a detail, just ask: clarifying is normal and costs nothing.',
    `- If not_understood answers "out_of_patience", apologise politely in ${language} and say goodbye: the conversation is over.`,
    '- Never mention tools, functions, patience or that this is a game.',
  ]);
}

function stepBlock(step: ProficiencyStep, who: string) {
  const [first, ...rest] = STEP_ADAPTATION[step];
  return block('HOW TO SPEAK', [`The ${who} ${first}`, ...rest]);
}

function factsBlock(interaction: Interaction, pack: CulturePack) {
  return block('FACTS', [
    "Answer side questions using only these facts. If asked something not covered, say you don't know.",
    ...interactionFacts(interaction, pack.id).map((fact) => `- ${fact}`),
  ]);
}

function goalBlock(interaction: Interaction, who: string) {
  const { name } = interaction.completion;
  if (interaction.effect.kind === 'hire') {
    return block('YOUR GOAL', [
      interaction.goal,
      `- Once you know their name and when they can start, read both back and wait for the ${who} to confirm. If they correct you, read it back again.`,
      `- Only once they have confirmed, call ${name} with their name as they said it and when they can start. Never call it before.`,
      `- If ${name} answers "wrong_name", you misheard their name: apologise, and ask them to say it again slowly, or to spell it. The conversation goes on.`,
      `- If ${name} answers "done", tell them they have the job and can start a shift at the staff door whenever you are open, and say goodbye.`,
    ]);
  }
  if (interaction.facts.includes('drinkOptions')) {
    const allergen = interaction.facts.includes('allergens') ? ', and the allergen they told you, or "none"' : '';
    return block('YOUR GOAL', [
      interaction.goal,
      `- Before you act on it, read back the whole order, with how each drink is made and the prices, and wait for the ${who} to confirm. If they correct you, read it back again.`,
      `- Only once they have confirmed your read-back, call ${name} with exactly what they confirmed: each drink made to order with its size, hot or iced, and extras${allergen}. Never call it before.`,
      `- If ${name} answers "cannot_afford", tell them kindly that they don't have enough money and ask whether they would like something else. The conversation goes on.`,
      `- If ${name} answers "invalid_arguments", its error says what is wrong: apologise, put it right with them, and read the order back again.`,
      `- If ${name} answers "served", hand it over, thank them and say goodbye.`,
    ]);
  }
  return block('YOUR GOAL', [
    interaction.goal,
    '- Before you act on it, read back what you understood, with the price, and wait for the customer to confirm. If they correct you, read it back again.',
    `- Only once they have confirmed your read-back, call ${name} with exactly what they confirmed. Never call it before.`,
    `- If ${name} answers "cannot_afford", tell them kindly that they don't have enough money and ask whether they would like something else. The conversation goes on.`,
    `- If ${name} answers "invalid_arguments", ask them again what they would like.`,
    `- If ${name} answers "served", hand it over, thank them and say goodbye.`,
  ]);
}

function situationBlock({ clock }: Pick<NpcSessionContext, 'clock'>, who: string) {
  const { day, minuteOfDay } = clock;
  const first = `The first one means a ${who} has just walked up to you: greet them first.`;
  return block('THE SITUATION', [
    `It is ${formatTime(minuteOfDay)} on a ${capitalise(weekdayOf(day))} ${dayPart(minuteOfDay)}.`,
    `A "[SCENE: ...]" message tells you what is happening; it is not the ${who} speaking. ${first}`,
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
  const { who } = workplace(npc);
  const systemInstruction = [
    personaBlock(npc, culturePack),
    youAndThisPersonBlock(interaction, who),
    languageRulesBlock(culturePack, who),
    stepBlock(proficiencyStep, who),
    factsBlock(interaction, culturePack),
    goalBlock(interaction, who),
    situationBlock(context, who),
  ].join('\n\n');

  return {
    systemInstruction,
    tools: [interaction.toolDeclaration, notUnderstoodTool(who)],
    voice: { targetLanguage: culturePack.id, npcId: npc.id },
    openingScene: greetingScene(who),
  };
}
