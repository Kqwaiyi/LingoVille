import { z } from 'zod';
import {
  CULTURE_PACKS,
  DIETARY_NOTE_IDS,
  drinkModifiersSchema,
  formatLocalAmount,
  ITEM_IDS,
  localPlaceName,
  NAMED_NPCS,
  toGeminiSchema,
  type CulturePack,
  type NamedNpcId,
} from '../content/index.ts';
import { JOB_IDS } from '../sim/index.ts';
import {
  block,
  mealSaid,
  orderSaid,
  InteractionIdSchema,
  interactionById,
  interactionPartner,
  LanguageSchema,
  StepSchema,
  transcriptLines,
  TranscriptLineSchema,
  type GenerateContentBody,
  type TranscriptLine,
} from './common.ts';

const NPC_IDS = Object.keys(NAMED_NPCS) as [NamedNpcId, ...NamedNpcId[]];

/** One line of a conversation as the Recap reads it. */
const RecapLineSchema = TranscriptLineSchema;

/** Help the Player used, placed after the transcript line it followed: `afterLine` is how many lines there were. */
const HelpLogEntrySchema = z.object({
  afterLine: z.int().min(0),
  kind: z.enum(['hint', 'phrasebook', 'translate']),
  text: z.string(),
});

const RecapConversationSchema = z.object({
  interactionId: InteractionIdSchema,
  outcome: z.enum(['success', 'failure']),
  transcript: z.array(RecapLineSchema),
  helpLog: z.array(HelpLogEntrySchema),
});

/** A line of a Shift Customer's order, or of what they were handed: a café drink made to order says how it was made. */
const ShiftOrderLineSchema = z.object({
  itemId: z.enum(ITEM_IDS),
  quantity: z.int().min(1),
  modifiers: drinkModifiersSchema.optional(),
});

/** What a customer at the supermarket till wanted besides their shopping rung up, in local money. */
const CheckoutSchema = z.object({
  bag: z.boolean(),
  pointsCard: z.boolean(),
  fromBehindTheCounter: z.enum(ITEM_IDS).nullable(),
  cashHanded: z.number().positive().nullable(),
  changeDue: z.number().min(0).nullable(),
});

/** What the learner did at the till: the bag and points card, and the change counted out, in local money. */
const TillWorkSchema = z.object({ bag: z.boolean(), pointsCard: z.boolean(), change: z.number().min(0) });

const dietaryNote = z.enum(DIETARY_NOTE_IDS).nullable();
/** One diner at a restaurant table: what they wanted, and any dietary need. */
const DinerSchema = z.object({ dish: z.enum(ITEM_IDS), drink: z.enum(ITEM_IDS), note: dietaryNote });
/** One diner as the learner wrote them on the order pad, which may be missing their dish or drink. */
const PadDinerSchema = z.object({ dish: z.enum(ITEM_IDS).nullable(), drink: z.enum(ITEM_IDS).nullable(), note: dietaryNote });

/**
 * One Shift Customer as the Recap reads them: what they ordered, how the game's exact check found the learner served
 * them (`served` is what was handed over, empty if nothing), and what was said. At the till, `order` is everything to
 * ring up, `checkout` what else they wanted, and `atTheTill` what the learner did about it. At a restaurant table,
 * `table` is what each diner wanted and `atTheTable` the order pad the learner wrote.
 */
const ShiftRecapCustomerSchema = z.object({
  order: z.array(ShiftOrderLineSchema).min(1).readonly(),
  /** What they first asked for, before changing their mind halfway. */
  changedFrom: z.array(ShiftOrderLineSchema).min(1).readonly().optional(),
  checkout: CheckoutSchema.optional(),
  result: z.enum(['served', 'wrongOrder', 'walkedOut']),
  served: z.array(ShiftOrderLineSchema).readonly(),
  atTheTill: TillWorkSchema.optional(),
  table: z.array(DinerSchema).min(1).readonly().optional(),
  atTheTable: z.array(PadDinerSchema).readonly().optional(),
  transcript: z.array(RecapLineSchema),
  helpLog: z.array(HelpLogEntrySchema),
});

const shared = {
  culturePackId: LanguageSchema,
  step: StepSchema,
  nativeLanguage: LanguageSchema,
};

/** A friend offered, in this conversation, to switch to the casual register (Sie→du, keigo→タメ口): the Recap notes it. */
const registerOffered = z.literal(true).optional();

/** What `/api/recap` takes. The gateway validates requests with it, and builds the prompt from them. */
export const RecapRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('goal'), ...shared, conversation: RecapConversationSchema, registerOffered }),
  z.object({
    kind: z.literal('smallTalk'),
    ...shared,
    npcId: z.enum(NPC_IDS),
    registerOffered,
    transcript: z.array(RecapLineSchema),
    helpLog: z.array(HelpLogEntrySchema),
  }),
  z.object({ kind: z.literal('shift'), ...shared, jobId: z.enum(JOB_IDS), customers: z.array(ShiftRecapCustomerSchema).min(1) }),
]);

export type RecapLine = TranscriptLine;
export type HelpLogEntry = z.infer<typeof HelpLogEntrySchema>;
export type RecapConversation = z.infer<typeof RecapConversationSchema>;
export type ShiftRecapCustomer = z.infer<typeof ShiftRecapCustomerSchema>;
export type RecapRequest = z.infer<typeof RecapRequestSchema>;

/** How much each kind of Recap may hold. Small Talk gets a lighter one, so a casual chat isn't turned into a lesson. */
const LIMITS: Record<RecapRequest['kind'], { corrections: number; newWords: number }> = {
  goal: { corrections: 3, newWords: 5 },
  smallTalk: { corrections: 1, newWords: 3 },
  shift: { corrections: 3, newWords: 6 },
};

function recapSchema(limits: { corrections: number; newWords: number }) {
  return z.object({
    outcome: z.string().describe('One line on how it went, in the Native Language.'),
    corrections: z
      .array(
        z.object({
          said: z.string().describe('What the learner said, as heard, in the Target Language.'),
          natural: z.string().describe('A more natural way to say it, in the Target Language.'),
          why: z.string().describe('One line on why, in the Native Language.'),
        }),
      )
      .max(limits.corrections),
    newWords: z
      .array(
        z.object({
          base: z.string().describe('The word or phrase, in the Target Language.'),
          reading: z.string().describe('Pinyin with tone marks for Chinese, hiragana for Japanese, otherwise empty.'),
          gloss: z.string().describe('Its meaning, in the Native Language.'),
        }),
      )
      .max(limits.newWords),
    cefrEstimate: StepSchema.describe("The CEFR level this conversation's evidence suggests."),
    lastTopic: z.string().optional().describe('What the conversation was about, in a few words of English.'),
  });
}

/** What `/api/recap` answers for a Goal Interaction. Every kind of Recap has this shape. */
export const RecapSchema = recapSchema(LIMITS.goal);
export type Recap = z.infer<typeof RecapSchema>;

/** The schema a Recap of this kind must match, sized for its kind. The gateway checks Gemini's answer against it. */
export function recapSchemaFor(kind: RecapRequest['kind']) {
  return recapSchema(LIMITS[kind]);
}

/** A Gemini `generateContent` body with a `responseSchema`. */
export type RecapRequestBody = GenerateContentBody;

const OUTCOMES = { success: 'succeeded', failure: 'failed' } as const;

const HELP_KINDS: Record<HelpLogEntry['kind'], string> = {
  hint: 'hint shown',
  phrasebook: 'phrasebook entry shown',
  translate: 'translated NPC line',
};

function helpLines(helpLog: HelpLogEntry[]) {
  if (helpLog.length === 0) return ['Help used: none.'];
  return ['Help used:', ...helpLog.map(({ afterLine, kind, text }) => `- after line ${afterLine}: ${HELP_KINDS[kind]}: ${text}`)];
}

function conversationBlock(heading: string, conversation: RecapConversation, pack: CulturePack) {
  const interaction = interactionById(conversation.interactionId);
  const { role, place } = interactionPartner(interaction, pack);
  return block(heading, [
    `With the ${role} at ${place}. The ${role}'s goal: ${interaction.goal} Outcome: ${OUTCOMES[conversation.outcome]}.`,
    ...transcriptLines(conversation.transcript),
    ...helpLines(conversation.helpLog),
  ]);
}

/** "a, b and c". */
const listed = (parts: string[]) => parts.join(', ').replace(/, ([^,]+)$/, ' and $1');

/** What a customer at the till wanted, and whether the learner got it all right, did something else, or never served them. */
function tillLine(customer: ShiftRecapCustomer, checkout: NonNullable<ShiftRecapCustomer['checkout']>, staff: string, pack: CulturePack) {
  const { bag, pointsCard, fromBehindTheCounter, cashHanded, changeDue } = checkout;
  const money = (amount: number) => formatLocalAmount(amount, pack.id);
  const shopping = customer.order.filter(({ itemId }) => itemId !== fromBehindTheCounter);
  const wanted = [
    `They brought ${orderSaid(shopping, pack)} to the till`,
    ...(fromBehindTheCounter ? [`asked for ${orderSaid([{ itemId: fromBehindTheCounter, quantity: 1 }], pack)} from behind the counter`] : []),
    bag ? 'wanted a bag' : 'wanted no bag',
    pointsCard ? 'had a points card' : 'had no points card',
    cashHanded !== null ? `and paid ${money(cashHanded)} in cash, so ${money(changeDue ?? 0)} change was due` : 'and paid by card',
  ].join(', ');
  switch (customer.result) {
    case 'served':
      return `${wanted}. The ${staff} got it all right.`;
    case 'wrongOrder': {
      const done = customer.atTheTill ?? { bag: false, pointsCard: false, change: 0 };
      const did = listed([
        `rang up ${customer.served.length > 0 ? orderSaid(customer.served, pack) : 'nothing'}`,
        done.bag ? 'gave a bag' : 'gave no bag',
        done.pointsCard ? 'scanned a points card' : 'scanned no points card',
        done.change > 0 ? `gave ${money(done.change)} change` : 'gave no change',
      ]);
      return `${wanted}. The ${staff} ${did} instead.`;
    }
    case 'walkedOut':
      return `${wanted}. The ${staff} never finished serving them, and they left.`;
  }
}

/** What each diner at a restaurant table wanted, and whether the learner wrote it all down right, wrote something else, or never took it. */
function tableLine(customer: ShiftRecapCustomer, table: NonNullable<ShiftRecapCustomer['table']>, staff: string, pack: CulturePack) {
  const diners = table.map(
    (diner, i) => `diner ${i + 1} wanted ${mealSaid(diner, pack)}${diner.note ? `, and is ${pack.dietaryNotes[diner.note].name}` : ''}`,
  );
  const wanted = `At their table, ${diners.join('; ')}.`;
  switch (customer.result) {
    case 'served':
      return `${wanted} The ${staff} wrote it all down right.`;
    case 'wrongOrder': {
      const pad = customer.atTheTable ?? [];
      const written = pad.map(
        (diner, i) => `diner ${i + 1}: ${mealSaid(diner, pack)}${diner.note ? `, noted ${pack.dietaryNotes[diner.note].name}` : ''}`,
      );
      return `${wanted} The ${staff} wrote down instead: ${written.length > 0 ? written.join('; ') : 'nothing'}.`;
    }
    case 'walkedOut':
      return `${wanted} The ${staff} never took their order, and they left.`;
  }
}

/** What the customer ordered, and whether the learner (the `staff`) served it right, served something else, or never served them. */
function servedLine(customer: ShiftRecapCustomer, staff: string, pack: CulturePack) {
  if (customer.checkout) return tillLine(customer, customer.checkout, staff, pack);
  if (customer.table) return tableLine(customer, customer.table, staff, pack);
  const { order, changedFrom, result, served } = customer;
  const changed = changedFrom ? `They first ordered ${orderSaid(changedFrom, pack)}, then changed their mind halfway. ` : '';
  const ordered = `${changed}They ordered: ${orderSaid(order, pack)}.`;
  switch (result) {
    case 'served':
      return `${ordered} The ${staff} served it right.`;
    case 'wrongOrder':
      return `${ordered} The ${staff} served ${served.length > 0 ? orderSaid(served, pack) : 'nothing'} instead.`;
    case 'walkedOut':
      return `${ordered} The ${staff} never served them, and they left.`;
  }
}

function shiftCustomerBlock(heading: string, customer: ShiftRecapCustomer, staff: string, pack: CulturePack) {
  return block(heading, [servedLine(customer, staff, pack), ...transcriptLines(customer.transcript), ...helpLines(customer.helpLog)]);
}

function coachBlock(request: RecapRequest, pack: CulturePack) {
  const native = CULTURE_PACKS[request.nativeLanguage].languageName;
  const what = {
    goal: 'one conversation',
    smallTalk: 'one Small Talk chat: a casual conversation with no goal, which cannot fail',
    shift: `a whole work Shift, where the learner was the ${request.kind === 'shift' ? request.jobId : 'staff member'} serving several customers`,
  }[request.kind];
  return block('WHO YOU ARE', [
    `You are a warm, encouraging language coach. Your learner speaks ${native} and is learning ${pack.languageName} ` +
      `by living in a small town in ${pack.setting}. Their level is about CEFR ${request.step}.`,
    `Write a short Recap of ${what}, for them to read straight afterwards and keep in their Journal.`,
  ]);
}

function readingBlock() {
  return block('HOW TO READ THE TRANSCRIPT', [
    '- NPC lines are exactly what the NPC said.',
    '- "PLAYER (heard as, may be misheard)" lines are what speech recognition heard the learner say. They may be wrong.',
    '- "PLAYER (typed)" lines were typed by the learner, exactly as written.',
    '- When a heard line has a word that sounds close to what the learner most likely meant but is wrong in context ' +
      '(for example yī bǎi, "a hundred", where yī bēi, "a cup", was meant), treat it as a pronunciation point: ' +
      'a correction whose "said" is what was heard, whose "natural" is what they meant, and whose "why" says how to say it ' +
      'so it is heard right. Never blame them for a typo-like word they probably said correctly.',
    '- The Help log lists the hints, phrasebook entries and translations the learner used. Using Help is never evidence of ' +
      'a lower level, and the game already gives helped turns less weight, so never lower cefrEstimate because Help was used: ' +
      'give the level the transcript would show if they had used no Help.',
  ]);
}

function writeBlock(request: RecapRequest, pack: CulturePack) {
  const native = CULTURE_PACKS[request.nativeLanguage].languageName;
  const target = pack.languageName;
  const limits = LIMITS[request.kind];
  const lines = [
    `- outcome: one friendly line in ${native} on how it went.`,
    `- corrections: at most ${limits.corrections}, the most useful only. "said" is the learner's words and "natural" a more natural ` +
      `way to say it at their level, both in ${target}. "why" is one short line in ${native}. If nothing needs correcting, give none.`,
    `- newWords: at most ${limits.newWords} words or phrases from the conversation worth keeping, mostly ones the NPC used. ` +
      `"base" in ${target}, "reading" as pinyin with tone marks for Chinese or hiragana for Japanese (otherwise empty), ` +
      `"gloss" in ${native}.`,
    '- cefrEstimate: the CEFR level the learner showed in this conversation.',
    '- lastTopic: what the conversation was about, in a few words of English, if it had a topic worth remembering.',
    `Write every explanation in ${native}, never in ${target}. Write examples only in ${target}.`,
  ];
  if (request.kind === 'smallTalk') {
    lines.push('Keep it light: this was a chat, not a lesson. Correct only what would really help, and celebrate what went well.');
  }
  if (request.kind === 'shift') {
    lines.push('Write one combined Recap for the whole Shift: the outcome line sums up how the customers went.');
  }
  if (request.kind !== 'shift' && request.registerOffered) {
    const { role } = request.kind === 'goal' ? interactionPartner(interactionById(request.conversation.interactionId), pack) : NAMED_NPCS[request.npcId];
    const { formal, casual } = pack.casualRegister;
    lines.push(
      `In this conversation the ${role}, now a friend, offered to switch from ${formal} to ${casual}: a real cultural milestone. ` +
        `Say so warmly in the outcome line, and say in a few words of ${native} what changes from now on.`,
    );
  }
  return block('WHAT TO WRITE', lines);
}

function conversationsText(request: RecapRequest, pack: CulturePack) {
  switch (request.kind) {
    case 'goal':
      return conversationBlock('THE CONVERSATION', request.conversation, pack);
    case 'smallTalk': {
      const { role } = NAMED_NPCS[request.npcId];
      return block('THE CHAT', [
        `Small Talk with the ${role} at ${localPlaceName(NAMED_NPCS[request.npcId].placeId, pack.id)}.`,
        ...transcriptLines(request.transcript),
        ...helpLines(request.helpLog),
      ]);
    }
    case 'shift':
      return request.customers.map((customer, i) => shiftCustomerBlock(`CUSTOMER ${i + 1}`, customer, request.jobId, pack)).join('\n\n');
  }
}

/**
 * The Gemini `generateContent` body for a Recap: an English meta-prompt, the
 * transcript and Help log, and a `responseSchema` sized for the kind of Recap.
 * Pure: the same request always gives the same body.
 */
export function buildRecapRequest(request: RecapRequest): RecapRequestBody {
  const pack = CULTURE_PACKS[request.culturePackId];
  const systemInstruction = [coachBlock(request, pack), readingBlock(), writeBlock(request, pack)].join('\n\n');
  return {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: conversationsText(request, pack) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: toGeminiSchema(recapSchemaFor(request.kind)) },
  };
}
