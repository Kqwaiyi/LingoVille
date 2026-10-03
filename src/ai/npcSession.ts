import { PLACE_HOURS, type CulturePack, type Interaction, type NamedNpc, type NamedNpcId } from '../content/index.ts';
import { weekdayOf, type GameState, type LanguageCode, type ProficiencyStep } from '../sim/index.ts';

/** A Live API function declaration (OpenAPI-subset parameters). */
export type FunctionDeclaration = {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, { type: 'STRING'; enum?: string[]; description?: string }>;
    required: string[];
  };
};

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

const NOT_UNDERSTOOD: FunctionDeclaration = {
  name: 'not_understood',
  description:
    'Call this only when you could not make sense of what the customer just said at all: gibberish, nothing heard, ' +
    'or a whole sentence in a language other than yours. Do not call it if you understood their meaning, even roughly.',
  parameters: {
    type: 'OBJECT',
    properties: { reason: { type: 'STRING', enum: ['unintelligible', 'other_language', 'nothing_heard'] } },
    required: ['reason'],
  },
};

// Block 4: how the NPC speaks at each Proficiency Step.
const STEP_ADAPTATION: Record<ProficiencyStep, string> = {
  A1:
    'The customer is a beginner (CEFR A1). Use very short sentences and only the most common words. Speak slowly and clearly. ' +
    'Offer choices up front (for example "hot or iced?"). The first time they seem lost, say the same thing once more, more simply.',
  A2:
    'The customer is an elementary learner (CEFR A2). Use short, simple sentences and everyday words. Speak slowly and clearly. ' +
    'Offer choices up front when it helps. The first time they seem lost, say the same thing once more, more simply.',
  B1: 'The customer is an intermediate learner (CEFR B1). Speak plainly at a moderate pace, with everyday vocabulary and one or two sentences per turn.',
  B2: 'The customer is an upper-intermediate learner (CEFR B2). Speak at natural speed with everyday vocabulary. Let them volunteer the details rather than offering choices.',
  C1: 'The customer is an advanced learner (CEFR C1). Speak at natural speed, with the idioms and set phrases normal in your job. Let them volunteer the details.',
  C2: 'The customer speaks at near-native level (CEFR C2). Speak exactly as you would to a local, at natural speed. Let them volunteer the details.',
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
    'Keep each turn short (one or two sentences), like a real, friendly person at work.',
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
    '- Never mention tools, functions, patience or that this is a game.',
  ]);
}

function stepBlock(step: ProficiencyStep) {
  return block('HOW TO SPEAK', [STEP_ADAPTATION[step]]);
}

function factsBlock(interaction: Interaction, pack: CulturePack) {
  const hours = PLACE_HOURS[interaction.placeId];
  const hoursFact = hours ? `${pack.cafe.name} is open ${formatTime(hours.opensAt)}–${formatTime(hours.closesAt)}.` : null;
  return block('FACTS', [
    'Answer side questions using only these facts. If asked something not covered, say you don\'t know.',
    ...[hoursFact, ...pack.cafe.facts].filter((fact) => fact !== null).map((fact) => `- ${fact}`),
  ]);
}

function goalBlock(interaction: Interaction) {
  return block('YOUR GOAL', [
    interaction.goal,
    'Before you act on it, read back what you understood and wait for the customer to confirm. If they correct you, read it back again.',
    'Once it is done, thank them and say goodbye.',
  ]);
}

function situationBlock(context: NpcSessionContext) {
  const { day, minuteOfDay } = context.clock;
  return block('THE SITUATION', [
    `It is ${formatTime(minuteOfDay)} on a ${capitalise(weekdayOf(day))} ${dayPart(minuteOfDay)}.`,
    'When you receive a "[SCENE: ...]" message, a customer has just walked up to you: greet them first.',
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
    tools: [NOT_UNDERSTOOD],
    voice: { targetLanguage: culturePack.id, npcId: npc.id },
  };
}
