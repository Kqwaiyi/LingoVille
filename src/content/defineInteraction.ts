import { z } from 'zod';
import type { LanguageCode, PlaceId } from '../sim/index.ts';
import { cafeAllergensIn, CULTURE_PACKS, type Glosses } from './culturePacks.ts';
import { menuPrice } from './currency.ts';
import { ITEM_IDS, type Allergen, type DrinkExtra, type ItemId } from './items.ts';
import { NAMED_NPCS, type NamedNpcId } from './npcs.ts';
import { PLACE_HOURS } from './places.ts';
import { toToolDeclaration, type FunctionDeclaration } from './toolDeclaration.ts';

/** How hard a Goal Interaction is: Beginner, Intermediate or Advanced. */
export type Band = 'B' | 'I' | 'A';

/** Which Culture Pack facts the NPC is told, so it can answer side questions. */
export const FACT_SOURCES = [
  'openingHours',
  'menu',
  'drinkOptions',
  'allergens',
  'placeFacts',
  'customs',
] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

/**
 * The arguments a `serveOrder` effect reads from its completion function: the order, with the extras in each café drink
 * made to order, and at the café, an allergen nothing in it may have in it.
 */
type ServeOrderArgs = { items: { item: ItemId; quantity: number; extras?: readonly DrinkExtra[] }[]; allergen?: Allergen | 'none' };

/**
 * The effect on success, each only allowed on a completion whose arguments it can read.
 * `serveOrder` serves the confirmed items from the menu and charges for them.
 */
export type EffectKind = 'serveOrder';
type EffectFor<Args> = Args extends ServeOrderArgs ? { kind: 'serveOrder' } : never;

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

/** One line of a confirmed order, with what each one costs. The sim adds them up. */
export type OrderLine = ServedItem & { priceInShifts: number };

export type ParsedArgs = { success: true; data: Record<string, unknown> } | { success: false; error: string };

/** What a completion comes to in this pack: the lines to pay for. */
export type ResolvedCompletion =
  | {
      success: true;
      lines: OrderLine[];
    }
  | { success: false; error: string };

export type Interaction = Omit<InteractionDefinition<z.ZodObject>, 'effect'> & {
  effect: { kind: EffectKind };
  /** The Live tool declaration, generated from `completion.args`. */
  toolDeclaration: FunctionDeclaration;
  /** Validates the NPC's completion arguments against `completion.args`. */
  parseArgs: (raw: unknown) => ParsedArgs;
  /** Validates the arguments and looks up what they come to in this Culture Pack: the order. */
  resolveCompletion: (raw: unknown, packId: LanguageCode) => ResolvedCompletion;
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
    z.object({ kind: z.literal('serveOrder') }),
  ]),
});

function servedItem(itemId: ItemId, quantity: number, packId: LanguageCode): ServedItem {
  const { name, glosses } = CULTURE_PACKS[packId].goods[itemId];
  return { itemId, name, glosses, quantity };
}

function orderLines(items: { itemId: ItemId; quantity: number }[], packId: LanguageCode): OrderLine[] {
  return items.map(({ itemId, quantity }) => ({
    ...servedItem(itemId, quantity, packId),
    priceInShifts: menuPrice(itemId, packId),
  }));
}

/** Why this café order has the allergen in it, for the NPC, or null if nothing in it does. */
function allergenProblem(items: ServeOrderArgs['items'], allergen: Allergen, packId: LanguageCode): string | null {
  const has = items.find(({ item, extras = [] }) => cafeAllergensIn(item, extras, packId).includes(allergen));
  if (!has) return null;
  const added = !cafeAllergensIn(has.item, [], packId).includes(allergen);
  return (
    `${CULTURE_PACKS[packId].goods[has.item].name} (menu id "${has.item}")${added ? ' with what is added to it' : ''} has ${allergen} in it, ` +
    `and the customer is allergic to ${allergen}. Suggest something without it.`
  );
}

/** The definition's type only allows each effect on arguments shaped for it. */
function resolveEffect(effect: Interaction['effect'], args: Record<string, unknown>, packId: LanguageCode): ResolvedCompletion {
  switch (effect.kind) {
    case 'serveOrder': {
      const { items, allergen } = args as ServeOrderArgs;
      const problem = allergen && allergen !== 'none' ? allergenProblem(items, allergen, packId) : null;
      if (problem) return { success: false, error: problem };
      return { success: true, lines: orderLines(items.map(({ item, quantity }) => ({ itemId: item, quantity })), packId) };
    }
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
    resolveCompletion: (raw, packId) => {
      const args = parseArgs(raw);
      if (!args.success) return args;
      return resolveEffect(definition.effect, args.data, packId);
    },
  };
}
