import { z } from 'zod';
import {
  basketFacts,
  interactionFacts,
  localPlaceName,
  toToolDeclaration,
  type CulturePack,
  type FunctionDeclaration,
  type Interaction,
  type NamedNpc,
  type NamedNpcId,
} from '../content/index.ts';
import {
  familiarityTier,
  isFamiliarAtLeast,
  usualOffered,
  weekdayOf,
  type ApproachId,
  type Basket,
  type GameState,
  type LanguageCode,
  type NpcMemory,
  type PlaceId,
  type ProficiencyStep,
  type RentStatement,
} from '../sim/index.ts';

/**
 * Which voice the NPC speaks with: a Named NPC's, or a Shift Customer's drawn by its seed. The gateway resolves it to a prebuilt voice,
 * because voices live only in the gateway config.
 */
export type VoiceRequest = { targetLanguage: LanguageCode; npcId: NamedNpcId } | { targetLanguage: LanguageCode; shiftCustomerVoice: number };

export type NpcSession = {
  systemInstruction: string;
  tools: FunctionDeclaration[];
  voice: VoiceRequest;
  /** The first message of the session, so the NPC speaks first: the customer walking up, or why the NPC approaches. */
  openingScene: string;
};

export type NpcSessionContext = {
  clock: GameState['clock'];
  /** The NPC starts this conversation by approaching the Character, rather than the Player pressing E. */
  approach?: ApproachId;
  /** At the till: the shopping the Character has put on the counter. */
  basket?: Basket;
  /** For the landlord: what the Character owes in rent. */
  rent?: RentStatement;
  /** For the restaurant's server: what the Character has eaten and not paid for. */
  bill?: Basket;
  /** For the restaurant's server: what the Character owes, in Shifts, from a bill they walked out on. */
  restaurantDebt?: number;
  /** What the NPC remembers of the Character, and the Character's name for when they know it. With none, they are strangers. */
  relationship?: Relationship;
  /** A friend adds a little something "on the house" to this order: flavour only, the game drew it. */
  onTheHouse?: true;
  /** A friend offers, this once, to switch to the casual register (Sie→du, keigo→タメ口). The game decides when. */
  offersCasualRegister?: true;
};

export type Relationship = { memory: NpcMemory; characterName: string };

/** What the context of a Small Talk session holds: no goal, so no basket, rent, bill or approach, and always what the NPC remembers. */
export type SmallTalkContext = Pick<NpcSessionContext, 'clock' | 'offersCasualRegister'> & {
  relationship: Relationship;
  /** A park regular saw the Character come into the park and waved them over, so they speak first. */
  wavedOver?: true;
};

export const NOT_UNDERSTOOD_TOOL = 'not_understood';
export const LEARN_NAME_TOOL = 'learn_name';
export const REVEAL_FAVOURITE_TOOL = 'reveal_favourite';

// What the game answers each tool call with. The system instruction tells the NPC what each answer means.
export type CompletionResponse =
  | { result: 'served' }
  | { result: 'done' }
  | { result: 'cannot_afford' }
  | { result: 'invalid_arguments'; error: string }
  | { result: 'wrong_name' };
export type NotUnderstoodResponse = { result: 'noted' } | { result: 'out_of_patience' };
/** `wrong_name`: the name heard isn't the Character's, so the NPC misheard it. */
export type LearnNameResponse = { result: 'learned' } | { result: 'wrong_name' };
export type RevealFavouriteResponse = { result: 'remembered' };
export type ToolResponse = CompletionResponse | NotUnderstoodResponse | LearnNameResponse | RevealFavouriteResponse | { result: 'unknown_tool' };

/**
 * Sent instead of the player's turn when an unreadable transcript uses up the
 * last of the NPC's Patience, so the NPC ends the conversation.
 */
export const OUT_OF_PATIENCE_SCENE =
  "[SCENE: Again you couldn't make sense of anything the customer said, and you have run out of patience. " +
  'Apologise politely and say goodbye: the conversation is over.]';

/** Opens every conversation the Player starts with E, so the NPC speaks first: a customer, or the landlord's tenant, walking up. */
export const greetingScene = (who: string) => `[SCENE: A ${who} walks up to you. Greet them first.]`;
export const GREETING_SCENE = greetingScene('customer');

/** Opens a conversation the NPC starts, saying why they speak to the Character first. */
const APPROACH_SCENES: Record<ApproachId, string> = {
  nurseOnWaking: '[SCENE: The patient in the bed beside you has just woken up. Speak to them first.]',
  landlordRentDue: '[SCENE: Your tenant is walking past you in the hallway. Their rent is due and unpaid: stop them and speak to them first.]',
  landlordDiscountStepDown: '[SCENE: Your tenant is walking past you in the hallway. Stop them and speak to them first: you have news about their rent.]',
};

/**
 * Sent when the customer puts something back while at the till, so the cashier
 * rings up what is on the counter now instead of the shopping in FACTS.
 */
export function basketChangedScene(basket: Basket, packId: LanguageCode): string {
  return [
    '[SCENE: The customer has put something back on the shelf. This replaces the shopping in FACTS.',
    ...basketFacts(basket, packId),
    "Read back the new total, and wait for them to confirm before you take payment. Don't greet them again.]",
  ].join('\n');
}

/** How a gift went: whether it counted (only one a week does), and whether it was the NPC's favourite. */
export type GiftOutcome = { counted: boolean; favourite: boolean };

const GIFT_HANDED = 'hands you a gift: ';
const FAVOURITE_GIFT = 'It is the gift you would love most: be delighted, and say so.';
const GIFT_TOO_SOON = "They gave you a gift only a few days ago, so tell them kindly that they really shouldn't have.";

/**
 * Sent when the Character hands the NPC a gift from the inventory, by the pack's local name, in any conversation. Their
 * favourite delights them. A gift that didn't count, coming only days after the last one, gets "you shouldn't have".
 */
export function giftScene(npc: NamedNpc, gift: string, { counted, favourite }: GiftOutcome): string {
  const { who } = workplace(npc);
  return [
    `[SCENE: The ${who} ${GIFT_HANDED}${gift}.`,
    ...(favourite ? [FAVOURITE_GIFT] : []),
    ...(counted ? [] : [GIFT_TOO_SOON]),
    'Thank them for it in a sentence or two, then carry on where you left off.]',
  ].join(' ');
}

/** How the gift went, from a scene `giftScene` wrote, or null if the text isn't one. */
export function readGiftScene(text: string): GiftOutcome | null {
  if (!text.startsWith('[SCENE: ') || !text.includes(GIFT_HANDED)) return null;
  return { counted: !text.includes(GIFT_TOO_SOON), favourite: text.includes(FAVOURITE_GIFT) };
}

/** Sent when Small Talk has gone on long enough, or the NPC has become busy, so they wrap it up. */
export const WRAP_UP_SCENE =
  '[SCENE: You need to get on with your day now. Wrap up the chat warmly in a sentence or two, and say goodbye.]';

/**
 * Follows the conversation so far when a session replaces one whose connection
 * dropped, so the NPC carries on instead of greeting again.
 */
export const RESUME_SCENE =
  '[SCENE: You were interrupted for a moment, and the customer is still with you. ' +
  "Don't greet them again: say sorry for the wait in a few words and carry on from where you left off.]";

/** What `learn_name` takes. The game checks a call's arguments against it too. */
export const LearnNameArgsSchema = z.object({ name: z.string().describe('Their name, as they said it.') });

export const learnNameTool = (who: string) =>
  toToolDeclaration(LEARN_NAME_TOOL, `Call this when the ${who} tells you their name, with the name as they said it.`, LearnNameArgsSchema);

/** What `reveal_favourite` takes: only the gift as the NPC put it, since the game already knows their favourite. */
const RevealFavouriteArgsSchema = z.object({ gift: z.string().describe('The gift you told them you would love most, as you said it.') });

export const revealFavouriteTool = (who: string) =>
  toToolDeclaration(REVEAL_FAVOURITE_TOOL, `Call this when you tell the ${who} which gift you would love most.`, RevealFavouriteArgsSchema);

export const notUnderstoodTool = (who: string) =>
  toToolDeclaration(
    NOT_UNDERSTOOD_TOOL,
    `Call this only when you could not make sense of what the ${who} just said at all: gibberish, nothing heard, ` +
      'or a whole sentence in a language other than yours. Do not call it if you understood their meaning, even roughly.',
    z.object({ reason: z.enum(['unintelligible', 'other_language', 'nothing_heard']) }),
  );

/**
 * Where each Named NPC is found, as their persona introduces it, and what they call the person in front of them.
 * `as` is how they are there, if not as "the <role> at", and `offDuty` that they aren't working there.
 */
type Workplace = { at: (pack: CulturePack) => string; who: string; as?: string; offDuty?: true };
const WORKPLACES: Record<PlaceId, Workplace | null> = {
  cafe: { at: (pack) => `${pack.cafe.name}, a café`, who: 'customer' },
  supermarket: { at: (pack) => `${pack.supermarket.name}, a supermarket`, who: 'customer' },
  'convenience-store': { at: (pack) => `${pack.convenienceStore.name}, a convenience store`, who: 'customer' },
  restaurant: { at: (pack) => `${pack.restaurant.name}, a restaurant`, who: 'customer' },
  clinic: { at: (pack) => `${pack.hospital.name}, the town hospital,`, who: 'patient' },
  home: { at: (pack) => `${pack.apartments.name}, the apartment block where you live and let flats,`, who: 'tenant' },
  park: { at: (pack) => `${localPlaceName('park', pack.id)}, the town park,`, who: 'person', as: 'one of the regulars at', offDuty: true },
  bookshop: { at: (pack) => `${localPlaceName('bookshop', pack.id)}, a bookshop`, who: 'customer' },
  bathhouse: { at: (pack) => `${localPlaceName('bathhouse', pack.id)}, the town bathhouse and gym,`, who: 'customer' },
  'town-office': { at: (pack) => `${localPlaceName('town-office', pack.id)}, the town office,`, who: 'resident' },
  'tram-stop': null,
};

/** The nurse works on the ward where people who faint are looked after; the rest of the hospital's staff don't. */
const NPC_WORKPLACES: Partial<Record<NamedNpcId, Workplace>> = {
  nurse: { at: (pack) => `${pack.hospital.name}, the town hospital, on the ward where people who faint are looked after,`, who: 'patient' },
};

function workplace(npc: NamedNpc): Workplace {
  const found = NPC_WORKPLACES[npc.id] ?? WORKPLACES[npc.placeId];
  if (!found) throw new Error(`No workplace for ${npc.id} at the ${npc.placeId}`);
  return found;
}

// Block 4: how the NPC speaks at each Proficiency Step (the first line follows "The customer" or "The patient"): vocabulary and grammar,
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
  const { name, favouriteGift } = pack.personas[npc.id];
  const place = workplace(npc);
  return block('WHO YOU ARE', [
    `You are ${name}, ${place.as ?? `the ${npc.role} at`} ${place.at(pack)} in a small town in ${pack.setting}, where everyone speaks ${pack.languageName}.`,
    `You are ${npc.age}: ${npc.temperament}. Quirks: ${npc.quirks}.`,
    `The gift you would love most is ${favouriteGift}. Don't bring it up yourself, but if the ${place.who} asks what you would like ` +
      `or what you like as a gift, tell them, and call ${REVEAL_FAVOURITE_TOOL}.`,
    place.offDuty ? 'Talk like a real, friendly person.' : 'Talk like a real, friendly person at work.',
  ]);
}

/** How the NPC learns the Character's name, while they don't know it. */
const learnNameLine = (who: string) =>
  `If the ${who} tells you their name, call ${LEARN_NAME_TOOL} with it as they said it. ` +
  'If it answers "wrong_name", you misheard: apologise and ask them to say it again.';

const KNOWN_NAME_UNUSED = "They have told you their name, but you don't know them well enough to use it yet.";

/** What the NPC remembers of the Character from NPC Memory: how well they know them, by what name, and what they talked about last. */
function rememberedLines(
  { memory, characterName }: Relationship,
  who: string,
  { casualRegister }: CulturePack,
  offersCasualRegister: boolean,
  unknownName = learnNameLine(who),
): string[] {
  const tier = familiarityTier(memory);
  const lines =
    tier === 'friend'
      ? [
          `This ${who} is a friend: you have talked many times, and you are always glad to see them.`,
          memory.registerOffered
            ? `Speak to them warmly, as to a friend. ${casualRegister.inUse} If they would still rather keep it formal, follow their lead.`
            : 'Speak to them warmly, as to a friend, but still politely.',
        ]
      : tier === 'acquaintance'
        ? [`You know this ${who} a little: they have come by a good few times.`, 'Speak to them in a friendly way, as to a familiar face.']
        : [`This ${who} is a stranger: you don't really know them yet.`, `Speak to them politely, as you would to any ${who}.`];
  if (memory.knowsName && tier !== 'stranger') lines.push(`Greet them by name: ${characterName}.`);
  else lines.push(memory.knowsName ? KNOWN_NAME_UNUSED : unknownName);
  if (memory.lastTopic && isFamiliarAtLeast(memory, 'acquaintance')) {
    lines.push(`Last time you talked about ${memory.lastTopic}. Follow up on it once, naturally, early on.`);
  }
  if (memory.favouriteKnown) lines.push('You have already told them which gift you would love most.');
  if (offersCasualRegister) {
    lines.push(
      `Early in the conversation, once, ${casualRegister.offer}. It's a small milestone between you, so make it warm; ` +
        "if they would rather keep things formal, that's fine.",
    );
  }
  return lines;
}

/**
 * "The usual?": what the Character always orders in this interaction, which the NPC offers, and takes a yes to as
 * the confirmation. None unless the NPC knows them well enough and this is where they order it.
 */
function usualLines(interaction: Interaction, memory: NpcMemory, pack: CulturePack): string[] {
  const usual = usualOffered(memory, interaction);
  const completion = usual === null ? null : interaction.resolveCompletion(usual, pack.id);
  if (!completion?.success) return [];
  const order = completion.lines.map(({ itemId, name, quantity }) => `${quantity} × ${name} (menu id "${itemId}")`).join(', ');
  const { name } = interaction.completion;
  return [
    `They always order the same here, their usual: ${order}.`,
    `When you greet them, ask whether they'll have "the usual", in your own words. If they say yes, that is their confirmation: ` +
      `tell them the price, and call ${name} with exactly their usual. If they want something else, take their order as you would any other.`,
  ];
}

/** A friend's little something "on the house" with the order. It is a gift, so the order and its price stay as they are. */
const onTheHouseLine = (interaction: Interaction) =>
  'Today, because they are a friend, add a little something on the house when you hand over their order (a biscuit with a coffee, say, ' +
  `or whatever suits what they ordered), and mention it once, warmly. It is a gift from you: it changes nothing about the order you call ` +
  `${interaction.completion.name} with, or its price.`;

function youAndThisPersonBlock(
  interaction: Interaction,
  who: string,
  { relationship, onTheHouse, offersCasualRegister }: Pick<NpcSessionContext, 'relationship' | 'onTheHouse' | 'offersCasualRegister'>,
  pack: CulturePack,
) {
  // Someone the NPC has got to know is met as such, whatever the conversation.
  // Hiring asks for the name itself, so there's no learn_name to call.
  const hiring = interaction.effect.kind === 'hire';
  if (relationship && familiarityTier(relationship.memory) !== 'stranger') {
    const unknownName = hiring ? "You don't know their name yet; asking for it is part of hiring them." : learnNameLine(who);
    return block('YOU AND THIS PERSON', [
      ...rememberedLines(relationship, who, pack, offersCasualRegister === true, unknownName),
      ...usualLines(interaction, relationship.memory, pack),
      ...(onTheHouse ? [onTheHouseLine(interaction)] : []),
    ]);
  }
  if (hiring) {
    return block('YOU AND THIS PERSON', [
      `This ${who} is a stranger: you have never met. You don't know their name yet; asking for it is part of hiring them.`,
      'Speak to them politely, as you would to anyone asking for a job.',
    ]);
  }
  if (who === 'tenant') {
    return block('YOU AND THIS PERSON', [
      "This tenant moved into one of your flats not long ago, newly arrived in town. You know them by sight but not well, and you don't use their name.",
      'Speak to them politely, as you would to any tenant.',
    ]);
  }
  return block('YOU AND THIS PERSON', [
    `This ${who} is a stranger: you have never met. You don't know their name and don't ask for it.`,
    `Speak to them politely, as you would to any ${who}.`,
    relationship?.memory.knowsName ? KNOWN_NAME_UNUSED : learnNameLine(who),
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

function factsBlock(interaction: Interaction, pack: CulturePack, context: NpcSessionContext) {
  return block('FACTS', [
    "Answer side questions using only these facts. If asked something not covered, say you don't know.",
    ...interactionFacts(interaction, pack.id, context).map((fact) => `- ${fact}`),
  ]);
}

function goalBlock(interaction: Interaction, who: string) {
  const { name } = interaction.completion;
  if (interaction.effect.kind === 'none') {
    return block('YOUR GOAL', [
      interaction.goal,
      `- Only once the ${who} has told you what you need, call ${name} with what they told you. Never call it before.`,
      `- If ${name} answers "invalid_arguments", ask them again.`,
      `- If ${name} answers "done", say goodbye kindly.`,
    ]);
  }
  if (interaction.effect.kind === 'pointTo') {
    return block('YOUR GOAL', [
      interaction.goal,
      `- Once you think you know what they want, check with them which item they mean, and wait for them to confirm.`,
      `- Only once they have confirmed, call ${name} with that item. Never call it before.`,
      `- If they ask for something not in FACTS, tell them kindly you don't sell it.`,
      `- If ${name} answers "invalid_arguments", ask them again what they are looking for.`,
      `- If ${name} answers "done", tell them simply where it is, and say goodbye.`,
    ]);
  }
  if (interaction.effect.kind === 'payRent') {
    return block('YOUR GOAL', [
      interaction.goal,
      `- Before you take any money, read back the amount the ${who} is paying, and wait for them to confirm. If they correct you, read it back again.`,
      `- Only once they have confirmed, call ${name} with that amount as the plain number. Never call it before.`,
      `- If ${name} answers "cannot_afford", tell them kindly they don't have that much with them, and ask whether they want to pay part of it. The conversation goes on.`,
      `- If ${name} answers "invalid_arguments", tell them that is more than they owe, and say what they do owe.`,
      `- If ${name} answers "done", thank them and say goodbye.`,
    ]);
  }
  if (interaction.effect.kind === 'extendRent') {
    return block('YOUR GOAL', [
      interaction.goal,
      `- Once you have agreed a number of days, read it back with the day the rent will then be needed by, and wait for the ${who} to confirm.`,
      `- Only once they have confirmed, call ${name} with that number of days. Never call it before.`,
      `- If ${name} answers "done", remind them kindly to pay by then, and say goodbye.`,
    ]);
  }
  if (interaction.effect.kind === 'hire') {
    return block('YOUR GOAL', [
      interaction.goal,
      `- Once you know their name and when they can start, read both back and wait for the ${who} to confirm. If they correct you, read it back again.`,
      `- Only once they have confirmed, call ${name} with their name as they said it and when they can start. Never call it before.`,
      `- If ${name} answers "wrong_name", you misheard their name: apologise, and ask them to say it again slowly, or to spell it. The conversation goes on.`,
      `- If ${name} answers "done", tell them they have the job and can start a shift at the staff door whenever you are open, and say goodbye.`,
    ]);
  }
  if (interaction.effect.kind === 'purchase') {
    return block('YOUR GOAL', [
      interaction.goal,
      `- Before you take payment, read back the total from FACTS, whether they want a bag and whether they have a points card, and wait for the ${who} to confirm. If they correct you, read it back again.`,
      `- Only once they have confirmed your read-back, call ${name} with exactly what they confirmed. Never call it before.`,
      `- If ${name} answers "cannot_afford", tell them kindly that they don't have enough money for all of it, and that they can put something back. The conversation goes on.`,
      `- If ${name} answers "invalid_arguments", ask them again about the bag and the points card.`,
      `- If ${name} answers "served", hand over their shopping, thank them and say goodbye.`,
    ]);
  }
  if (interaction.effect.kind === 'seatGuest') {
    return block('YOUR GOAL', [
      interaction.goal,
      `- Once you know how many they are and where they would like to sit, read both back and wait for the ${who} to confirm. If they correct you, read it back again.`,
      `- Only once they have confirmed, call ${name} with exactly what they confirmed. Never call it before.`,
      `- If ${name} answers "invalid_arguments", ask them again how many they are and where they would like to sit.`,
      `- If ${name} answers "done", show them to their seat, tell them you will be back to take their order, and leave them to settle in.`,
    ]);
  }
  if (interaction.effect.kind === 'orderMeal') {
    return block('YOUR GOAL', [
      interaction.goal,
      `- Before you act on it, read back the order with the prices, and wait for the ${who} to confirm. If they correct you, read it back again.`,
      `- Only once they have confirmed your read-back, call ${name} with exactly what they confirmed. Never call it before.`,
      `- If ${name} answers "cannot_afford", tell them kindly that they would not have enough money to pay the bill for that, and ask whether they would like something else. The conversation goes on.`,
      `- If ${name} answers "invalid_arguments", its error says what is wrong: apologise, put it right with them, and read the order back again.`,
      `- If ${name} answers "served", bring the meal to the table, wish them a good meal, tell them to ask for the bill when they are ready, and leave them to eat.`,
    ]);
  }
  if (interaction.effect.kind === 'settleBill') {
    return block('YOUR GOAL', [
      interaction.goal,
      `- The bill is exactly the total in FACTS. Read back the total and how they are paying, and wait for the ${who} to confirm.`,
      `- Only once they have confirmed, call ${name} with how they are paying. Never call it before.`,
      `- If ${name} answers "cannot_afford", tell them kindly that they don't have enough money to pay it now, and that they can come back and pay it later. The conversation goes on.`,
      `- If ${name} answers "invalid_arguments", ask them again how they would like to pay.`,
      `- If ${name} answers "done", thank them, say you hope to see them again, and say goodbye.`,
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

function situationBlock({ clock }: Pick<NpcSessionContext, 'clock'>, who: string, approached: boolean) {
  const { day, minuteOfDay } = clock;
  const first = approached
    ? 'The first one tells you why you are speaking to them: you speak first.'
    : `The first one means a ${who} has just walked up to you: greet them first.`;
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
    youAndThisPersonBlock(interaction, who, context, culturePack),
    languageRulesBlock(culturePack, who),
    stepBlock(proficiencyStep, who),
    factsBlock(interaction, culturePack, context),
    goalBlock(interaction, who),
    situationBlock(context, who, context.approach !== undefined),
  ].join('\n\n');

  return {
    systemInstruction,
    // Hiring takes the applicant's name in its own completion, so learn_name would only get in the way.
    tools: [
      interaction.toolDeclaration,
      ...(interaction.effect.kind === 'hire' ? [] : [learnNameTool(who)]),
      revealFavouriteTool(who),
      notUnderstoodTool(who),
    ],
    voice: { targetLanguage: culturePack.id, npcId: npc.id },
    openingScene: context.approach ? APPROACH_SCENES[context.approach] : greetingScene(who),
  };
}

/** The places where a stated goal would be met at a counter, so a Small Talk partner there points the way. */
const COUNTER_ROLES = new Set(['barista', 'cashier', 'clerk', 'server', 'receptionist', 'pharmacist', 'shopkeeper', 'attendant']);

function smallTalkGoalBlock(npc: NamedNpc, who: string) {
  const goal = COUNTER_ROLES.has(npc.role)
    ? `- If they ask for something you would do for them at work (ordering, buying, paying, asking for help), say kindly that they can come to the counter for that, and carry on chatting. Don't do it now.`
    : `- If they ask you to do something for them, say kindly that you can't help with that here, and carry on chatting.`;
  return block('YOUR GOAL', [
    `This is Small Talk: a friendly, casual chat with no goal, which cannot go wrong.`,
    `- Chat about everyday things: the weather, the town, your day, what the ${who} has been up to. Ask them questions, answer theirs, and keep it light.`,
    goal,
    "- Don't end the chat yourself: keep chatting until a scene tells you to wrap up.",
  ]);
}

/**
 * Everything a Live session needs to play this Named NPC in Small Talk: no goal, no completion function and
 * no facts, only the NPC, what they remember of the Character, and how to speak. Pure.
 */
export function buildSmallTalkSession(culturePack: CulturePack, proficiencyStep: ProficiencyStep, npc: NamedNpc, context: SmallTalkContext): NpcSession {
  const { who } = workplace(npc);
  const systemInstruction = [
    personaBlock(npc, culturePack),
    block('YOU AND THIS PERSON', rememberedLines(context.relationship, who, culturePack, context.offersCasualRegister === true)),
    languageRulesBlock(culturePack, who),
    stepBlock(proficiencyStep, who),
    smallTalkGoalBlock(npc, who),
    situationBlock(context, who, context.wavedOver === true),
  ].join('\n\n');

  return {
    systemInstruction,
    tools: [learnNameTool(who), revealFavouriteTool(who), notUnderstoodTool(who)],
    voice: { targetLanguage: culturePack.id, npcId: npc.id },
    openingScene: context.wavedOver
      ? `[SCENE: You see a ${who} you might chat with coming into the park, and wave them over. Speak to them first.]`
      : `[SCENE: A ${who} you might chat with comes up to you. Greet them first.]`,
  };
}
