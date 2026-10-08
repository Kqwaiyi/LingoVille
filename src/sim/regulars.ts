import type { Interaction, NamedNpcId } from '../content/index.ts';
import { isFamiliarAtLeast } from './familiarity.ts';
import { memoryOf, namedNpcOf } from './npcMemory.ts';
import { nextRandom } from './rng.ts';
import type { GameState, NpcMemory } from './state.ts';
import { FAMILIARITY } from './tuning.ts';

// Being a regular: "the usual?" once the Character orders the same thing again and again, now and then a little
// something "on the house" from a friend, and a friend's one offer to speak casually.

/** The Character's usual: an interaction and its completion arguments. */
type UsualOrder = NonNullable<NpcMemory['usualOrder']>;

/** Orders: what an NPC serves the Character, which can become their usual. */
const ORDER_EFFECTS: readonly Interaction['effect']['kind'][] = ['serveOrder', 'orderMeal'];

/** Whether this Goal Interaction is an order, so the same one made again and again becomes the Character's usual. */
function isOrder(interaction: Interaction): boolean {
  return ORDER_EFFECTS.includes(interaction.effect.kind);
}

/** The arguments with object keys and array items sorted, so the same order said another way compares equal. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  }
  return value;
}

/**
 * The Character ordered from this NPC, with these completion arguments. The same interaction with the same arguments
 * `FAMILIARITY.usualOrderAfterIdenticalOrders` times in a row becomes their usual. The usual is kept through a
 * different order, until another one is made enough times in a row. Anything but an order changes nothing.
 */
export function recordOrder(state: GameState, interaction: Interaction, rawArgs: unknown): GameState {
  const npcId = namedNpcOf(interaction);
  if (!isOrder(interaction) || !npcId) return state;
  const parsed = interaction.parseArgs(rawArgs);
  if (!parsed.success) return state;
  const args = canonical(parsed.data);
  const memory = memoryOf(state, npcId);
  const { lastOrder } = memory;
  const same = lastOrder?.interactionId === interaction.id && JSON.stringify(lastOrder.args) === JSON.stringify(args);
  const inARow = same ? lastOrder.inARow + 1 : 1;
  const remembered: NpcMemory = {
    ...memory,
    lastOrder: { interactionId: interaction.id, args, inARow },
    ...(inARow >= FAMILIARITY.usualOrderAfterIdenticalOrders && { usualOrder: { interactionId: interaction.id, args } }),
  };
  return { ...state, people: { ...state.people, [npcId]: remembered } };
}

/**
 * The order an NPC offers as "the usual?" in this interaction: the Character's usual, if it was ordered in this
 * interaction and the NPC knows them at least as an acquaintance. Otherwise null.
 */
export function usualOffered(memory: NpcMemory, interaction: Interaction): UsualOrder['args'] | null {
  const { usualOrder } = memory;
  if (!usualOrder || usualOrder.interactionId !== interaction.id || !isFamiliarAtLeast(memory, 'acquaintance')) return null;
  return usualOrder.args;
}

/**
 * A Named NPC who is a friend takes the Character's order: now and then, drawn from the save's RNG, they add a little
 * something "on the house". At most once a week from each NPC, counted from when it was given (`onTheHouseGiven`).
 * It's flavour only: the order costs the same.
 */
export function rollOnTheHouse(state: GameState, interaction: Interaction): { state: GameState; onTheHouse: boolean } {
  const npcId = namedNpcOf(interaction);
  if (!isOrder(interaction) || !npcId) return { state, onTheHouse: false };
  const memory = memoryOf(state, npcId);
  const { day } = state.clock;
  const tooSoon = memory.lastOnTheHouseDay !== null && day - memory.lastOnTheHouseDay < FAMILIARITY.onTheHouseCooldownDays;
  if (!isFamiliarAtLeast(memory, 'friend') || tooSoon) return { state, onTheHouse: false };
  const draw = nextRandom(state.rngState);
  return { state: { ...state, rngState: draw.rngState }, onTheHouse: draw.value < FAMILIARITY.onTheHouseChance };
}

/** The order with something on the house was served: the NPC gives nothing more on the house for a week. */
export function onTheHouseGiven(state: GameState, npcId: NamedNpcId): GameState {
  return { ...state, people: { ...state.people, [npcId]: { ...memoryOf(state, npcId), lastOnTheHouseDay: state.clock.day } } };
}

/** A friend who hasn't yet offered to switch to the casual register (Sie→du, keigo→タメ口) will: once. */
export function casualRegisterDue(memory: NpcMemory): boolean {
  return isFamiliarAtLeast(memory, 'friend') && !memory.registerOffered;
}

/** The NPC has offered to switch to the casual register, in a conversation that came to its outcome. They never offer again. */
export function casualRegisterOffered(state: GameState, npcId: NamedNpcId): GameState {
  return { ...state, people: { ...state.people, [npcId]: { ...memoryOf(state, npcId), registerOffered: true } } };
}
