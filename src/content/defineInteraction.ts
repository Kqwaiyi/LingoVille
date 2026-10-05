import { z } from 'zod';
import type { Basket, LanguageCode, PlaceId } from '../sim/index.ts';
import { CULTURE_PACKS, type Glosses } from './culturePacks.ts';
import { menuPrice } from './currency.ts';
import { ITEM_IDS, ITEMS, type ItemId, type Restores } from './items.ts';
import { NAMED_NPCS, type NamedNpcId } from './npcs.ts';
import { PLACE_HOURS } from './places.ts';
import { toToolDeclaration, type FunctionDeclaration } from './toolDeclaration.ts';

/** How hard a Goal Interaction is: Beginner, Intermediate or Advanced. */
export type Band = 'B' | 'I' | 'A';

/** Which Culture Pack facts the NPC is told, so it can answer side questions. */
export const FACT_SOURCES = ['openingHours', 'menu', 'shelves', 'basket', 'placeFacts', 'customs', 'ward'] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

/** The arguments a `serveOrder` effect reads from its completion function. */
type ServeOrderArgs = { items: { item: ItemId; quantity: number }[] };
/** The arguments a `purchase` effect's completion carries: the Character's choices at the till. */
type PurchaseArgs = { bag: boolean; card: boolean };
/** The arguments a `pointTo` effect reads: the item the NPC shows the way to. */
type PointToArgs = { item: ItemId };

/**
 * The effect on success, each only allowed on a completion whose arguments it can read.
 * `serveOrder` serves the confirmed items from the menu and charges for them.
 * `purchase` charges for what the Character brought to the till, which goes into the inventory.
 * `pointTo` marks where an item is. `none` is flavour only.
 */
export type EffectKind = 'none' | 'serveOrder' | 'purchase' | 'pointTo';
type EffectFor<Args> =
  | { kind: 'none' }
  | (Args extends ServeOrderArgs ? { kind: 'serveOrder' } : never)
  | (Args extends PurchaseArgs ? { kind: 'purchase' } : never)
  | (Args extends PointToArgs ? { kind: 'pointTo' } : never);

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

/** One line of a confirmed order or purchase, with what each one costs and gives back, and whether it goes off (groceries). The sim adds them up. */
export type OrderLine = ServedItem & { priceInShifts: number; restores: Restores; goesOff: boolean };

export type ParsedArgs = { success: true; data: Record<string, unknown> } | { success: false; error: string };

/** What a completion comes to in this pack: the lines to pay for, and for `pointTo`, the item shown. */
export type ResolvedCompletion = { success: true; lines: OrderLine[]; pointedTo?: ServedItem } | { success: false; error: string };

export type Interaction = Omit<InteractionDefinition<z.ZodObject>, 'effect'> & {
  effect: { kind: EffectKind };
  /** The Live tool declaration, generated from `completion.args`. */
  toolDeclaration: FunctionDeclaration;
  /** Validates the NPC's completion arguments against `completion.args`. */
  parseArgs: (raw: unknown) => ParsedArgs;
  /**
   * Validates the arguments and looks up what they come to in this Culture Pack:
   * the order, or for a `purchase`, the `basket` the Character brought to the till.
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
  effect: z.object({ kind: z.enum(['none', 'serveOrder', 'purchase', 'pointTo']) }),
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
  }));
}

/** The definition's type only allows each effect on arguments shaped for it. */
function resolveEffect(kind: EffectKind, args: Record<string, unknown>, packId: LanguageCode, basket: Basket): ResolvedCompletion {
  switch (kind) {
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
      return resolveEffect(definition.effect.kind, args.data, packId, basket);
    },
  };
}
