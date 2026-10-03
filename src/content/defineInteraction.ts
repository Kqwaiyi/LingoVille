import { z } from 'zod';
import type { LanguageCode, PlaceId } from '../sim/index.ts';
import { CAFE_ITEMS, type CafeItemId, type Restores } from './cafe.ts';
import { CULTURE_PACKS } from './culturePacks.ts';
import { NAMED_NPCS, type NamedNpcId } from './npcs.ts';
import { PLACE_HOURS } from './places.ts';
import { toToolDeclaration, type FunctionDeclaration } from './toolDeclaration.ts';

/** How hard a Goal Interaction is: Beginner, Intermediate or Advanced. */
export type Band = 'B' | 'I' | 'A';

/** Which Culture Pack facts the NPC is told, so it can answer side questions. */
export const FACT_SOURCES = ['openingHours', 'menu', 'placeFacts'] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

/** The arguments a `serveOrder` effect reads from its completion function. */
type ServeOrderArgs = { items: { item: CafeItemId; quantity: number }[] };

/**
 * The effect on success. `serveOrder` serves the confirmed items from the menu
 * and charges for them, so it's only allowed on a completion whose arguments
 * name menu items. `none` is flavour only.
 */
type EffectFor<Args> = { kind: 'none' } | (Args extends ServeOrderArgs ? { kind: 'serveOrder' } : never);

export type InteractionDefinition<Args extends z.ZodObject> = {
  /** kebab-case, stable: saves and the Journal refer to it. */
  id: string;
  placeId: PlaceId;
  npcId: NamedNpcId;
  /** The one goal, in plain English, as the NPC is told it. */
  goal: string;
  facts: FactSource[];
  /** The function the NPC calls once the goal is done and confirmed. */
  completion: { name: string; description: string; args: Args };
  band: Band;
  effect: EffectFor<z.infer<Args>>;
};

export type ServedItem = { name: string; gloss: string; quantity: number };

/** One line of a confirmed order, with what each one costs and gives back. The sim adds them up. */
export type OrderLine = ServedItem & { priceInShifts: number; restores: Restores };

export type ParsedArgs = { success: true; data: Record<string, unknown> } | { success: false; error: string };

export type Interaction = Omit<InteractionDefinition<z.ZodObject>, 'effect'> & {
  effect: { kind: 'none' | 'serveOrder' };
  /** The Live tool declaration, generated from `completion.args`. */
  toolDeclaration: FunctionDeclaration;
  /** Validates the NPC's completion arguments against `completion.args`. */
  parseArgs: (raw: unknown) => ParsedArgs;
  /** Validates the arguments and looks up what they order in this Culture Pack (nothing, for a `none` effect). */
  resolveCompletion: (
    raw: unknown,
    packId: LanguageCode,
  ) => { success: true; lines: OrderLine[] } | { success: false; error: string };
};

const definitionSchema = z.object({
  id: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
  placeId: z.custom<PlaceId>((value) => typeof value === 'string' && value in PLACE_HOURS, 'unknown place'),
  npcId: z.custom<NamedNpcId>((value) => typeof value === 'string' && value in NAMED_NPCS, 'unknown NPC'),
  goal: z.string().min(1),
  facts: z.array(z.enum(FACT_SOURCES)).min(1),
  completion: z.object({
    // Live function names: snake_case.
    name: z.string().regex(/^[a-z]+(_[a-z]+)*$/),
    description: z.string().min(1),
    args: z.custom<z.ZodObject>((value) => value instanceof z.ZodObject, 'completion arguments must be a Zod object'),
  }),
  band: z.enum(['B', 'I', 'A']),
  effect: z.discriminatedUnion('kind', [z.object({ kind: z.literal('none') }), z.object({ kind: z.literal('serveOrder') })]),
});

function serveOrder({ items }: ServeOrderArgs, packId: LanguageCode): OrderLine[] {
  const menu = CULTURE_PACKS[packId].cafe.menu;
  return items.map(({ item, quantity }) => {
    const { gloss, priceInShifts, restores } = CAFE_ITEMS[item];
    return { name: menu[item], gloss, quantity, priceInShifts, restores };
  });
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
      // The definition's type only allows serveOrder on arguments shaped like ServeOrderArgs.
      const lines = definition.effect.kind === 'serveOrder' ? serveOrder(args.data as ServeOrderArgs, packId) : [];
      return { success: true, lines };
    },
  };
}
