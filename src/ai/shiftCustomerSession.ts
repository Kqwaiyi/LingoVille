import { formatLocalAmount, type CulturePack } from '../content/index.ts';
import { weekdayOf, type Checkout, type GameState, type ProficiencyStep, type ShiftCustomer, type ShiftOrder, type TillWork } from '../sim/index.ts';
import { block, orderSaid } from './common.ts';
import { capitalise, dayPart, formatTime, languageRulesBlock, notUnderstoodTool, type NpcSession } from './npcSession.ts';

/** What a Shift Customer's session is built from besides the customer: the time of day. */
export type ShiftCustomerContext = { clock: GameState['clock'] };

/** Where a Shift Customer is served, and by whom: the Player, behind the café counter or at the supermarket till. */
type Counter = {
  /** Who the Player is to the customer. */
  who: string;
  /** Where the customer stands: "a café counter". */
  at: string;
  /** What the customer does there, as a sentence starts: "Order". */
  doing: string;
  /** The same, as an -ing: "ordering". */
  doingIt: string;
  /** What the customer walks up to. */
  walkUpTo: string;
  /** The shop, as the customer knows it. */
  shop: (pack: CulturePack) => string;
};

const CAFE: Counter = {
  who: 'barista',
  at: 'a café counter',
  doing: 'Order',
  doingIt: 'ordering',
  walkUpTo: 'the counter',
  shop: (pack) => `${pack.cafe.name}, a café`,
};

const TILL: Counter = {
  who: 'cashier',
  at: 'a supermarket till',
  doing: 'Pay',
  doingIt: 'paying at the till',
  walkUpTo: 'the till',
  shop: (pack) => `${pack.supermarket.name}, a supermarket`,
};

/** A customer with a checkout is at the supermarket till; any other, at the café counter. */
const counterFor = (customer: ShiftCustomer): Counter => (customer.checkout ? TILL : CAFE);

/**
 * How a Shift Customer speaks at each Proficiency Step (the first line follows "The barista"): vocabulary
 * and grammar, how much they say per turn, their speed, and (at A1–A2) one simpler rephrase the first time
 * the staff member seems lost. Unlike staff, they never offer choices: working out what they want is the Player's job.
 */
const stepAdaptation = ({ at, doing, doingIt }: Counter): Record<ProficiencyStep, string[]> => ({
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
    `is an upper-intermediate learner (CEFR B2). ${doing} as a local customer normally would.`,
    `Say as much per turn as you naturally would at ${at}.`,
    'Speak at natural speed.',
  ],
  C1: [
    `is an advanced learner (CEFR C1). Use the idioms and set phrases locals use when ${doingIt}.`,
    `Say as much per turn as you naturally would at ${at}.`,
    'Speak at natural speed.',
  ],
  C2: [
    'speaks at near-native level (CEFR C2). Speak exactly as you would to a local, with no simplification.',
    `Say as much per turn as you naturally would at ${at}.`,
    'Speak at natural speed.',
  ],
});

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

const SHOPPING_LINE = /^- You have put this shopping on the counter, and the cashier can see it: (.+)\.$/m;
const WANTS_BAG = '- You want a bag for it.';
const NO_BAG = "- You don't want a bag: you have your own.";
const HAS_CARD = '- You have a points card, and want it scanned.';
const BEHIND_LINE = /^- You also want this from behind the counter, which the cashier can't see until you ask: (.+)\.$/m;
const CASH_LINE = /^- You pay in cash: when it comes to paying, hand over exactly (.+) and say how much you are giving\.$/m;

/** A customer at the till, as their instruction says it: what they want, by its local names, or null for a café customer. */
export type CheckoutSaid = { shopping: string; bag: boolean; pointsCard: boolean; fromBehindTheCounter: string | null; cashHanded: string | null };

/** What a customer at the till wants, read from their instruction, or null if they're not at the till. */
export function readCheckout(systemInstruction: string): CheckoutSaid | null {
  const shopping = SHOPPING_LINE.exec(systemInstruction)?.[1];
  if (!shopping) return null;
  return {
    shopping,
    bag: systemInstruction.includes(WANTS_BAG),
    pointsCard: systemInstruction.includes(HAS_CARD),
    fromBehindTheCounter: BEHIND_LINE.exec(systemInstruction)?.[1]?.replace(/^1 × /, '') ?? null,
    cashHanded: CASH_LINE.exec(systemInstruction)?.[1] ?? null,
  };
}

const STARTED_ON_IT = 'has started on your order.';

/** Tells a Shift Customer who changes their mind that the Player has started on their order: now is when they change it. */
export function shiftCustomerChangeScene(): string {
  return `[SCENE: The ${CAFE.who} ${STARTED_ON_IT} Change your mind now, as YOUR ORDER says.]`;
}

/** Whether this text is the scene `shiftCustomerChangeScene` writes. */
export function readChangeScene(text: string): boolean {
  return text.includes(STARTED_ON_IT);
}

const RIGHT_ORDER = 'That is what you ordered.';
const WRONG_ORDER = 'That is not what you ordered.';
const ALL_RIGHT = 'That is all just as you wanted.';
const NOT_ALL_RIGHT = 'That is not all as you wanted.';

/**
 * Tells the Shift Customer what the staff member has handed them, and whether it is what they wanted: the game
 * has already checked it exactly, so the customer only reacts, and leaves. At the till (`atTheTill` given), it's
 * what the cashier rang up, the bag and points card, and the change.
 */
export function shiftCustomerServedScene(served: ShiftOrder, correct: boolean, pack: CulturePack, atTheTill?: TillWork): string {
  const handed = served.length > 0 ? orderSaid(served, pack) : 'nothing at all';
  if (atTheTill) {
    const { bag, pointsCard, change } = atTheTill;
    const done = [
      `The ${TILL.who} rings up: ${handed}`,
      bag ? 'puts your shopping in a bag' : 'gives you no bag',
      pointsCard ? 'scans your points card' : 'scans no points card',
      change > 0 ? `and hands you ${formatLocalAmount(change, pack.id)} in change` : 'and gives you no change',
    ].join(', ');
    return correct
      ? `[SCENE: ${done}. ${ALL_RIGHT} Thank them briefly and say goodbye.]`
      : `[SCENE: ${done}. ${NOT_ALL_RIGHT} Tell them politely in a few words what is wrong, then say goodbye and leave.]`;
  }
  return correct
    ? `[SCENE: The ${CAFE.who} hands you: ${handed}. ${RIGHT_ORDER} Thank them briefly and say goodbye.]`
    : `[SCENE: The ${CAFE.who} hands you: ${handed}. ${WRONG_ORDER} Tell them politely in a few words, then say goodbye and leave.]`;
}

/** Whether a served scene `shiftCustomerServedScene` wrote says it was what the customer wanted, or null if the text isn't one. */
export function readServedScene(text: string): boolean | null {
  if (text.includes(RIGHT_ORDER) || text.includes(ALL_RIGHT)) return true;
  if (text.includes(WRONG_ORDER) || text.includes(NOT_ALL_RIGHT)) return false;
  return null;
}

/** A café customer's hidden order: the drink, perhaps a change of mind, and how to say it. */
function orderBlock(customer: ShiftCustomer, pack: CulturePack) {
  const { who } = CAFE;
  return block('YOUR ORDER', [
    `- You want exactly this, and nothing else: ${orderSaid(customer.changedFrom ?? customer.order, pack)}.`,
    ...(customer.changedFrom
      ? [
          `- Then you change your mind. When a "[SCENE: ...]" message says the ${who} ${STARTED_ON_IT.slice(0, -1)}, tell them in your own words that you've changed your mind and you want this instead: ${orderSaid(customer.order, pack)}. From then on you want exactly that, and nothing else.`,
        ]
      : []),
    `- The ${who} cannot see your order: they have to work it out from what you say. Greet them and order it in your own words, as a local would.`,
    ...(customer.order.some((line) => line.modifiers)
      ? [`- Say every part of it: the size, hot or iced, and what goes in it. You may say them in any order, as a local would.`]
      : []),
    `- If the ${who} asks you to repeat it, or asks what you would like, say it again. That is normal and costs nothing.`,
    customer.changedFrom
      ? `- If they ask anything else, answer briefly and naturally. Change your order only as above: never add to it, and never talk about the price.`
      : `- If they ask anything else, answer briefly and naturally. Never change your order, never add to it, and never talk about the price.`,
    `- Don't say goodbye until a "[SCENE: ...]" message says what the ${who} has handed you. Then do what it says.`,
  ]);
}

/**
 * A customer at the till: the shopping the cashier can see, and what they can't unless they listen: the bag, the
 * points card, anything from behind the counter and the cash handed over. Never the total or the change.
 */
function checkoutBlock(customer: ShiftCustomer, checkout: Checkout, pack: CulturePack) {
  const { who } = TILL;
  const { bag, pointsCard, fromBehindTheCounter, cashHanded } = checkout;
  const shopping = customer.order.filter(({ itemId }) => itemId !== fromBehindTheCounter);
  const unseen = ['whether you want a bag', 'whether you have a points card', ...(fromBehindTheCounter ? ['what you want from behind the counter'] : [])];
  return block('YOUR SHOPPING', [
    `- You have put this shopping on the counter, and the ${who} can see it: ${orderSaid(shopping, pack)}.`,
    bag ? WANTS_BAG : NO_BAG,
    pointsCard ? HAS_CARD : "- You don't have a points card.",
    ...(fromBehindTheCounter
      ? [`- You also want this from behind the counter, which the ${who} can't see until you ask: ${orderSaid([{ itemId: fromBehindTheCounter, quantity: 1 }], pack)}.`]
      : []),
    cashHanded !== null
      ? `- You pay in cash: when it comes to paying, hand over exactly ${formatLocalAmount(cashHanded, pack.id)} and say how much you are giving.`
      : '- You pay by card. Just say so if asked: there is nothing more to it.',
    `- The ${who} cannot know ${unseen.join(', ').replace(/, ([^,]+)$/, ' or $1')} unless you say. Greet them and tell them in your own words, as a local would: when they ask, or, if they don't, near the start.`,
    `- If the ${who} asks you to repeat something, say it again. That is normal and costs nothing.`,
    '- If they ask anything else, answer briefly and naturally. Never change what you want, never add to it, and never talk about prices, the total or your change.',
    `- Don't say goodbye until a "[SCENE: ...]" message says what the ${who} has done. Then do what it says.`,
  ]);
}

/**
 * Everything a Live session needs to play one Shift Customer: an anonymous local with no memory, who walks up to the
 * café counter or the supermarket till, speaks first and holds a hidden order the Player must work out by listening.
 * Pure: the same inputs always give the same session.
 */
export function buildShiftCustomerSession(
  customer: ShiftCustomer,
  pack: CulturePack,
  step: ProficiencyStep,
  context: ShiftCustomerContext,
): NpcSession {
  const { day, minuteOfDay } = context.clock;
  const counter = counterFor(customer);
  const { who } = counter;
  const [first, ...rest] = stepAdaptation(counter)[step];
  const systemInstruction = [
    block('WHO YOU ARE', [
      `You are a customer at ${counter.shop(pack)} in a small town in ${pack.setting}, where everyone speaks ${pack.languageName}.`,
      'You are an ordinary local on your way somewhere: friendly, and not in a great hurry.',
    ]),
    block('YOU AND THIS PERSON', [
      `The ${who} serving you is a stranger: you have never met. You don't know their name and don't ask for it.`,
      `Speak to them as you would to any ${who}.`,
    ]),
    languageRulesBlock(pack, who),
    block('HOW TO SPEAK', [`The ${who} ${first}`, ...rest]),
    customer.checkout ? checkoutBlock(customer, customer.checkout, pack) : orderBlock(customer, pack),
    block('THE SITUATION', [
      `It is ${formatTime(minuteOfDay)} on a ${capitalise(weekdayOf(day))} ${dayPart(minuteOfDay)}.`,
      `A "[SCENE: ...]" message tells you what is happening; it is not the ${who} speaking. The first one means you have just walked up to ${counter.walkUpTo}: you speak first.`,
    ]),
  ].join('\n\n');

  return {
    systemInstruction,
    tools: [notUnderstoodTool(who)],
    voice: { targetLanguage: pack.id, shiftCustomerVoice: customer.voiceSeed },
    openingScene: customer.checkout
      ? `[SCENE: You walk up to the till with your shopping. The ${who} is ready to serve you. Greet them.]`
      : `[SCENE: You walk up to the counter. The ${who} is ready to serve you. Greet them and order.]`,
  };
}
