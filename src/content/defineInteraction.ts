import { z } from 'zod';
import { JOB_IDS, type Basket, type ComfortKind, type JobId, type LanguageCode, type PlaceId } from '../sim/index.ts';
import { CULTURE_PACKS, type Glosses } from './culturePacks.ts';
import { menuPrice } from './currency.ts';
import { BATH_OPTIONS, DIETARY_NOTES, dishContents, dishFits, ITEM_IDS, ITEMS, type DietaryNoteId, type ItemId, type Restores } from './items.ts';
import { NAMED_NPCS, type NamedNpcId } from './npcs.ts';
import { PLACE_HOURS } from './places.ts';
import { toToolDeclaration, type FunctionDeclaration } from './toolDeclaration.ts';

/** How hard a Goal Interaction is: Beginner, Intermediate or Advanced. */
export type Band = 'B' | 'I' | 'A';

/** Which Culture Pack facts the NPC is told, so it can answer side questions. */
export const FACT_SOURCES = [
  'openingHours',
  'menu',
  'dietary',
  'stock',
  'shelves',
  'basket',
  'bill',
  'placeFacts',
  'customs',
  'ward',
  'bathhouse',
  'rent',
  'newcomerDiscount',
] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

/** The arguments a `serveOrder` effect reads from its completion function. */
type ServeOrderArgs = { items: { item: ItemId; quantity: number }[] };
/** The arguments a `purchase` effect's completion carries: the Character's choices at the till. */
type PurchaseArgs = { bag: boolean; card: boolean };
/** The arguments a `pointTo` effect reads: the item the NPC shows the way to. */
type PointToArgs = { item: ItemId };
/** The arguments a `payRent` effect reads: what the tenant hands over, in local money. */
type PayRentArgs = { amount: number };
/** The arguments an `extendRent` effect reads: how many more days the landlord gives. */
type ExtendRentArgs = { days: number };
/** The arguments a `hire` effect reads: the applicant's name as the NPC heard it, which the sim checks. */
type HireArgs = { name: string };
/** The arguments a `seatGuest` effect's completion carries: how many, and where they'd like to sit. */
type SeatGuestArgs = { party: number; seating: string };
/** The arguments an `orderMeal` effect reads: the order, and for a recommendation, the dietary need it must keep to. */
type OrderMealArgs = ServeOrderArgs & { restriction?: DietaryNoteId };
/** The arguments a `settleBill` effect's completion carries: how the guest pays. */
type SettleBillArgs = { method: string };
/** The arguments an `admit` effect's completion carries: what the bather asked for at the desk (flavour only). */
type AdmitArgs = { options: (typeof BATH_OPTIONS)[number][] };
/** The arguments a `registerMember` effect's completion carries: joining or renewing (flavour only: the sim knows which). */
type RegisterMemberArgs = { kind: 'join' | 'renew' };

/**
 * The effect on success, each only allowed on a completion whose arguments it can read.
 * `serveOrder` serves the confirmed items from the menu and charges for them: used up on the spot, or for a gift, kept.
 * `purchase` charges for what the Character brought to the till, which goes into the inventory.
 * `pointTo` marks where an item is. `payRent` pays the landlord, and `extendRent`
 * gives the Character more time to pay. `hire` gives the Character its Job, once the sim
 * has checked the name. At the restaurant, `seatGuest` gives the Character a table, `orderMeal` serves a meal there and
 * puts it on the bill (keeping to a stated dietary need), and `settleBill` charges the bill. At the bathhouse, `admit`
 * charges a bath, and `registerMember` charges gym membership and gives `ECONOMY.gymMembershipDays` at the gym. `none` is flavour only.
 */
export type EffectKind =
  | 'none'
  | 'serveOrder'
  | 'purchase'
  | 'pointTo'
  | 'payRent'
  | 'extendRent'
  | 'hire'
  | 'seatGuest'
  | 'orderMeal'
  | 'settleBill'
  | 'admit'
  | 'registerMember';
type EffectFor<Args> =
  | { kind: 'none' }
  | (Args extends ServeOrderArgs ? { kind: 'serveOrder' } : never)
  | (Args extends PurchaseArgs ? { kind: 'purchase' } : never)
  | (Args extends PointToArgs ? { kind: 'pointTo' } : never)
  | (Args extends PayRentArgs ? { kind: 'payRent' } : never)
  | (Args extends ExtendRentArgs ? { kind: 'extendRent' } : never)
  | (Args extends HireArgs ? { kind: 'hire'; jobId: JobId } : never)
  | (Args extends SeatGuestArgs ? { kind: 'seatGuest' } : never)
  | (Args extends OrderMealArgs ? { kind: 'orderMeal' } : never)
  | (Args extends SettleBillArgs ? { kind: 'settleBill' } : never)
  | (Args extends AdmitArgs ? { kind: 'admit' } : never)
  | (Args extends RegisterMemberArgs ? { kind: 'registerMember' } : never);

export type InteractionDefinition<Args extends z.ZodObject> = {
  /** kebab-case, stable: saves and the Journal refer to it. */
  id: string;
  placeId: PlaceId;
  npcId: NamedNpcId;
  /** The one goal, in plain English, as the NPC is told it. */
  goal: string;
  facts: FactSource[];
  /** The items the NPC sells or knows about (its menu or shelves), by id. Every Culture Pack must sell them all. */
  items: readonly ItemId[];
  /** The function the NPC calls once the goal is done and confirmed. */
  completion: { name: string; description: string; args: Args };
  band: Band;
  effect: EffectFor<z.infer<Args>>;
};

/** An item as served: its local name, and its glosses in the other Native Languages. */
export type ServedItem = { itemId: ItemId; name: string; glosses: Glosses; quantity: number };

/**
 * One line of a confirmed order or purchase, with what each one costs and gives back, whether it goes off (groceries),
 * whether it's a gift (kept to give), and what kind of Comfort Purchase it is, if any. The sim adds them up.
 */
export type OrderLine = ServedItem & { priceInShifts: number; restores: Restores; goesOff: boolean; gift: boolean; comfort: ComfortKind | null };

export type ParsedArgs = { success: true; data: Record<string, unknown> } | { success: false; error: string };

/** What a completion does to the rent: money paid to the landlord, in Shifts, or more time. The sim checks it against what is owed. */
export type RentChange = { kind: 'pay'; amountInShifts: number } | { kind: 'extend'; days: number };

/** A Job asked for, under the name the NPC heard. The sim checks the name against the Character's. */
export type JobApplication = { jobId: JobId; name: string };

/**
 * What a completion comes to in this pack: the lines to pay for, for `pointTo` the item shown,
 * for the landlord, the change to the rent, and for hiring, the application. Settling the bill pays nothing here: the
 * sim knows the bill, at the prices it was ordered at, and any restaurant debt.
 */
export type ResolvedCompletion =
  | { success: true; lines: OrderLine[]; pointedTo?: ServedItem; rent?: RentChange; application?: JobApplication }
  | { success: false; error: string };

export type Interaction = Omit<InteractionDefinition<z.ZodObject>, 'effect'> & {
  /** A `hire` effect gives the Job `jobId`. */
  effect: { kind: Exclude<EffectKind, 'hire'> } | { kind: 'hire'; jobId: JobId };
  /** The Live tool declaration, generated from `completion.args`. */
  toolDeclaration: FunctionDeclaration;
  /** Validates the NPC's completion arguments against `completion.args`. */
  parseArgs: (raw: unknown) => ParsedArgs;
  /**
   * Validates the arguments and looks up what they come to in this Culture Pack:
   * the order, and for a `purchase`, the `basket` the Character brought to the till.
   */
  resolveCompletion: (raw: unknown, packId: LanguageCode, basket?: Basket) => ResolvedCompletion;
};

const definitionSchema = z.object({
  id: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
  placeId: z.custom<PlaceId>((value) => typeof value === 'string' && value in PLACE_HOURS, 'unknown place'),
  npcId: z.custom<NamedNpcId>((value) => typeof value === 'string' && value in NAMED_NPCS, 'unknown NPC'),
  goal: z.string().min(1),
  facts: z.array(z.enum(FACT_SOURCES)).min(1),
  items: z.array(z.enum(ITEM_IDS)),
  completion: z.object({
    // Live function names: snake_case.
    name: z.string().regex(/^[a-z]+(_[a-z]+)*$/),
    description: z.string().min(1),
    args: z.custom<z.ZodObject>((value) => value instanceof z.ZodObject, 'completion arguments must be a Zod object'),
  }),
  band: z.enum(['B', 'I', 'A']),
  effect: z.discriminatedUnion('kind', [
    z.object({
      kind: z.enum(['none', 'serveOrder', 'purchase', 'pointTo', 'payRent', 'extendRent', 'seatGuest', 'orderMeal', 'settleBill', 'admit', 'registerMember']),
    }),
    z.object({ kind: z.literal('hire'), jobId: z.enum(JOB_IDS) }),
  ]),
});

function servedItem(itemId: ItemId, quantity: number, packId: LanguageCode): ServedItem {
  const { name, glosses } = CULTURE_PACKS[packId].goods[itemId];
  return { itemId, name, glosses, quantity };
}

function orderLines(items: Basket, packId: LanguageCode): OrderLine[] {
  return items.map(({ itemId, quantity }) => ({
    ...servedItem(itemId, quantity, packId),
    priceInShifts: menuPrice(itemId, packId),
    restores: ITEMS[itemId].restores,
    goesOff: ITEMS[itemId].meals !== undefined,
    gift: ITEMS[itemId].gift === true,
    comfort: ITEMS[itemId].comfort ?? null,
  }));
}

/** Why this order breaks the dietary need, for the NPC, or null if every dish in it keeps to it. */
function dietaryProblem(items: ServeOrderArgs['items'], restriction: DietaryNoteId, packId: LanguageCode): string | null {
  const broken = items.find(({ item }) => !dishFits(item, restriction));
  if (!broken) return null;
  const has = dishContents(broken.item);
  return (
    `${CULTURE_PACKS[packId].goods[broken.item].name} (menu id "${broken.item}") has ${has} in it, ` +
    `and the customer ${DIETARY_NOTES[restriction].means}. Recommend a dish that keeps to their dietary need.`
  );
}

/** The definition's type only allows each effect on arguments shaped for it. */
function resolveEffect(effect: Interaction['effect'], args: Record<string, unknown>, packId: LanguageCode, basket: Basket): ResolvedCompletion {
  switch (effect.kind) {
    case 'none':
      return { success: true, lines: [] };
    case 'serveOrder': {
      const { items } = args as ServeOrderArgs;
      return { success: true, lines: orderLines(items.map(({ item, quantity }) => ({ itemId: item, quantity })), packId) };
    }
    case 'purchase':
      if (basket.length === 0) return { success: false, error: 'The customer has brought nothing to the till.' };
      return { success: true, lines: orderLines(basket, packId) };
    case 'pointTo':
      return { success: true, lines: [], pointedTo: servedItem((args as PointToArgs).item, 1, packId) };
    case 'payRent': {
      const amountInShifts = (args as PayRentArgs).amount / CULTURE_PACKS[packId].currency.perShift;
      return { success: true, lines: [], rent: { kind: 'pay', amountInShifts } };
    }
    case 'extendRent':
      return { success: true, lines: [], rent: { kind: 'extend', days: (args as ExtendRentArgs).days } };
    case 'hire':
      return { success: true, lines: [], application: { jobId: effect.jobId, name: (args as HireArgs).name } };
    case 'seatGuest':
      return { success: true, lines: [] };
    case 'orderMeal': {
      const { items, restriction } = args as OrderMealArgs;
      const problem = restriction ? dietaryProblem(items, restriction, packId) : null;
      if (problem) return { success: false, error: problem };
      return { success: true, lines: orderLines(items.map(({ item, quantity }) => ({ itemId: item, quantity })), packId) };
    }
    case 'settleBill':
      return { success: true, lines: [] };
    case 'admit':
      return { success: true, lines: orderLines([{ itemId: 'bath-entry', quantity: 1 }], packId) };
    case 'registerMember':
      return { success: true, lines: orderLines([{ itemId: 'gym-membership', quantity: 1 }], packId) };
  }
}

/**
 * Authors a Goal Interaction. The definition is checked when it loads, and its
 * completion schema produces both the tool declaration and the argument validator.
 */
export function defineInteraction<Args extends z.ZodObject>(definition: InteractionDefinition<Args>): Interaction {
  definitionSchema.parse(definition);
  const { completion } = definition;

  const parseArgs = (raw: unknown): ParsedArgs => {
    const result = completion.args.safeParse(raw);
    return result.success
      ? { success: true, data: result.data as Record<string, unknown> }
      : { success: false, error: z.prettifyError(result.error) };
  };

  return {
    ...definition,
    toolDeclaration: toToolDeclaration(completion.name, completion.description, completion.args),
    parseArgs,
    resolveCompletion: (raw, packId, basket = []) => {
      const args = parseArgs(raw);
      if (!args.success) return args;
      return resolveEffect(definition.effect, args.data, packId, basket);
    },
  };
}
