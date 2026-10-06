import type { CulturePack } from '../content/index.ts';
import { weekdayOf, type GameState, type ProficiencyStep, type ShiftCustomer, type ShiftOrder } from '../sim/index.ts';
import { block, orderSaid } from './common.ts';
import { capitalise, dayPart, formatTime, languageRulesBlock, notUnderstoodTool, type NpcSession } from './npcSession.ts';

/** What a Shift Customer's session is built from besides the customer: the time of day. */
export type ShiftCustomerContext = { clock: GameState['clock'] };

/** Who a Shift Customer is talking to: the Player, behind the café counter. */
const WHO = 'barista';

/**
 * How a Shift Customer speaks at each Proficiency Step (the first line follows "The barista"): vocabulary
 * and grammar, how much they say per turn, their speed, and (at A1–A2) one simpler rephrase the first time
 * the barista seems lost. Unlike staff, they never offer choices: working out the order is the Player's job.
 */
const STEP_ADAPTATION: Record<ProficiencyStep, string[]> = {
  A1: [
    'is a beginner (CEFR A1). Use only the most common words and the simplest grammar.',
    'Say one very short sentence per turn.',
    'Speak slowly and clearly.',
    'The first time they seem lost, say the same thing once more, more simply. After that, just say it again.',
  ],
  A2: [
    'is an elementary learner (CEFR A2). Use everyday words and simple grammar.',
    'Say one or two short sentences per turn.',
    'Speak slowly and clearly.',
    'The first time they seem lost, say the same thing once more, more simply. After that, just say it again.',
  ],
  B1: [
    'is an intermediate learner (CEFR B1). Use everyday vocabulary and plain grammar.',
    'Say one or two sentences per turn.',
    'Speak plainly, a little slower than natural speed.',
  ],
  B2: [
    'is an upper-intermediate learner (CEFR B2). Order as a local customer normally would.',
    'Say as much per turn as you naturally would at a café counter.',
    'Speak at natural speed.',
  ],
  C1: [
    'is an advanced learner (CEFR C1). Use the idioms and set phrases locals use when ordering.',
    'Say as much per turn as you naturally would at a café counter.',
    'Speak at natural speed.',
  ],
  C2: [
    'speaks at near-native level (CEFR C2). Speak exactly as you would to a local, with no simplification.',
    'Say as much per turn as you naturally would at a café counter.',
    'Speak at natural speed.',
  ],
};

const ORDER_LINE = /^- You want exactly this, and nothing else: (.+)\.$/m;
const CHANGED_ORDER_LINE = /^- Then you change your mind\. .* you want this instead: (.+)\. From then on/m;

/** The hidden order a Shift Customer's instruction carries (the first, for one who changes their mind), as its items are named there, or null. */
export function readShiftOrder(systemInstruction: string): string | null {
  return ORDER_LINE.exec(systemInstruction)?.[1] ?? null;
}

/** What a Shift Customer who changes their mind wants instead, as their instruction names it, or null for one who doesn't. */
export function readChangedOrder(systemInstruction: string): string | null {
  return CHANGED_ORDER_LINE.exec(systemInstruction)?.[1] ?? null;
}

const STARTED_ON_IT = 'has started on your order.';

/** Tells a Shift Customer who changes their mind that the Player has started on their order: now is when they change it. */
export function shiftCustomerChangeScene(): string {
  return `[SCENE: The ${WHO} ${STARTED_ON_IT} Change your mind now, as YOUR ORDER says.]`;
}

/** Whether this text is the scene `shiftCustomerChangeScene` writes. */
export function readChangeScene(text: string): boolean {
  return text.includes(STARTED_ON_IT);
}

const RIGHT_ORDER = 'That is what you ordered.';
const WRONG_ORDER = 'That is not what you ordered.';

/**
 * Tells the Shift Customer what the barista has handed them, and whether it is what they ordered: the game
 * has already checked it exactly, so the customer only reacts, and leaves.
 */
export function shiftCustomerServedScene(served: ShiftOrder, correct: boolean, pack: CulturePack): string {
  const handed = served.length > 0 ? orderSaid(served, pack) : 'nothing at all';
  return correct
    ? `[SCENE: The ${WHO} hands you: ${handed}. ${RIGHT_ORDER} Thank them briefly and say goodbye.]`
    : `[SCENE: The ${WHO} hands you: ${handed}. ${WRONG_ORDER} Tell them politely in a few words, then say goodbye and leave.]`;
}

/** Whether a served scene `shiftCustomerServedScene` wrote says it was the customer's order, or null if the text isn't one. */
export function readServedScene(text: string): boolean | null {
  return text.includes(RIGHT_ORDER) ? true : text.includes(WRONG_ORDER) ? false : null;
}

/**
 * Everything a Live session needs to play one Shift Customer: an anonymous local with no memory, who walks
 * up to the café counter, speaks first and holds a hidden order the Player must work out by listening.
 * Pure: the same inputs always give the same session.
 */
export function buildShiftCustomerSession(
  customer: ShiftCustomer,
  pack: CulturePack,
  step: ProficiencyStep,
  context: ShiftCustomerContext,
): NpcSession {
  const { day, minuteOfDay } = context.clock;
  const [first, ...rest] = STEP_ADAPTATION[step];
  const systemInstruction = [
    block('WHO YOU ARE', [
      `You are a customer at ${pack.cafe.name}, a café in a small town in ${pack.setting}, where everyone speaks ${pack.languageName}.`,
      'You are an ordinary local on your way somewhere: friendly, and not in a great hurry.',
    ]),
    block('YOU AND THIS PERSON', [
      `The ${WHO} serving you is a stranger: you have never met. You don't know their name and don't ask for it.`,
      `Speak to them as you would to any ${WHO}.`,
    ]),
    languageRulesBlock(pack, WHO),
    block('HOW TO SPEAK', [`The ${WHO} ${first}`, ...rest]),
    block('YOUR ORDER', [
      `- You want exactly this, and nothing else: ${orderSaid(customer.changedFrom ?? customer.order, pack)}.`,
      ...(customer.changedFrom
        ? [
            `- Then you change your mind. When a "[SCENE: ...]" message says the ${WHO} ${STARTED_ON_IT.slice(0, -1)}, tell them in your own words that you've changed your mind and you want this instead: ${orderSaid(customer.order, pack)}. From then on you want exactly that, and nothing else.`,
          ]
        : []),
      `- The ${WHO} cannot see your order: they have to work it out from what you say. Greet them and order it in your own words, as a local would.`,
      ...(customer.order.some((line) => line.modifiers)
        ? [`- Say every part of it: the size, hot or iced, and what goes in it. You may say them in any order, as a local would.`]
        : []),
      `- If the ${WHO} asks you to repeat it, or asks what you would like, say it again. That is normal and costs nothing.`,
      customer.changedFrom
        ? `- If they ask anything else, answer briefly and naturally. Change your order only as above: never add to it, and never talk about the price.`
        : `- If they ask anything else, answer briefly and naturally. Never change your order, never add to it, and never talk about the price.`,
      `- Don't say goodbye until a "[SCENE: ...]" message says what the ${WHO} has handed you. Then do what it says.`,
    ]),
    block('THE SITUATION', [
      `It is ${formatTime(minuteOfDay)} on a ${capitalise(weekdayOf(day))} ${dayPart(minuteOfDay)}.`,
      `A "[SCENE: ...]" message tells you what is happening; it is not the ${WHO} speaking. The first one means you have just walked up to the counter: you speak first.`,
    ]),
  ].join('\n\n');

  return {
    systemInstruction,
    tools: [notUnderstoodTool(WHO)],
    voice: { targetLanguage: pack.id, shiftCustomerVoice: customer.voiceSeed },
    openingScene: `[SCENE: You walk up to the counter. The ${WHO} is ready to serve you. Greet them and order.]`,
  };
}
