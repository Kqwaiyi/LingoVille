import type { ItemId, NamedNpc, NamedNpcId } from '../content/index.ts';
import { clampMeter } from './meters.ts';
import { namesMatch } from './jobs.ts';
import { memoryOf, metNpc } from './npcMemory.ts';
import { randomInt } from './rng.ts';
import type { GameState, NpcMemory } from './state.ts';
import { FAMILIARITY, MOOD, SMALL_TALK } from './tuning.ts';

export const FAMILIARITY_TIERS = ['stranger', 'acquaintance', 'friend'] as const;
export type FamiliarityTier = (typeof FAMILIARITY_TIERS)[number];

/** How well a Named NPC knows the Character, read from their hidden Familiarity points. */
export function familiarityTier(memory: NpcMemory): FamiliarityTier {
  const { acquaintance, friend } = FAMILIARITY.tierThresholds;
  if (memory.familiarity >= friend) return 'friend';
  return memory.familiarity >= acquaintance ? 'acquaintance' : 'stranger';
}

/** The NPC knows the Character at least as well as `tier`. */
export function isFamiliarAtLeast(memory: NpcMemory, tier: FamiliarityTier): boolean {
  return FAMILIARITY_TIERS.indexOf(familiarityTier(memory)) >= FAMILIARITY_TIERS.indexOf(tier);
}

/**
 * Gives up to `points` Familiarity with this NPC, under the per-NPC daily cap, and says how much of it counted.
 * The cap's counter starts again each day; the points themselves never decay.
 */
function gainFamiliarity(state: GameState, npcId: NamedNpcId, points: number): { state: GameState; share: number } {
  const memory = memoryOf(state, npcId);
  const { day } = state.clock;
  const today = memory.todaysGain.day === day ? memory.todaysGain.amount : 0;
  const gained = Math.max(0, Math.min(points, FAMILIARITY.dailyCapPerNpc - today));
  const remembered: NpcMemory = { ...memory, familiarity: memory.familiarity + gained, todaysGain: { day, amount: today + gained } };
  return { state: { ...state, people: { ...state.people, [npcId]: remembered } }, share: points > 0 ? gained / points : 0 };
}

/**
 * The NPC understood the Player's latest Small Talk turn. Mood rises, more the better the NPC knows the
 * Character, and so does Familiarity. Both count against the same per-NPC daily cap: once it's used up, an
 * exchange still makes for a nice chat, but changes nothing.
 */
export function smallTalkExchange(state: GameState, npcId: NamedNpcId): { state: GameState; moodChange: number } {
  const tier = familiarityTier(memoryOf(state, npcId));
  const gained = gainFamiliarity(state, npcId, FAMILIARITY.smallTalkExchange);
  const { character } = gained.state;
  const mood = clampMeter(character.mood + MOOD.changes.smallTalkExchange[tier] * gained.share);
  return { state: { ...gained.state, character: { ...character, mood } }, moodChange: mood - character.mood };
}

/** A Goal Interaction with this NPC succeeded: a little Familiarity, under the same daily cap. */
export function goalInteractionFamiliarity(state: GameState, npcId: NamedNpcId): GameState {
  return gainFamiliarity(state, npcId, FAMILIARITY.goalInteractionSuccess).state;
}

/**
 * The Character gives a Named NPC a gift from the inventory: one of it leaves the inventory. Only one gift per NPC
 * per week counts, as a one-off Familiarity bump outside the daily cap, bigger for the NPC's favourite. A gift
 * within the week of the last one that counted is still given, but changes nothing else.
 */
export function giveGift(state: GameState, npc: NamedNpc, itemId: ItemId): { state: GameState; counted: boolean; favourite: boolean } {
  const { inventory } = state.possessions;
  const held = inventory.find((item) => item.itemId === itemId);
  if (!held) throw new Error(`The Character has no ${itemId} to give`);
  const given = inventory.flatMap((item) => (item !== held ? [item] : item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : []));
  const handedOver: GameState = { ...state, possessions: { ...state.possessions, inventory: given } };

  const favourite = itemId === npc.favouriteGift;
  const memory = memoryOf(state, npc.id);
  const { day } = state.clock;
  if (memory.lastGiftDay !== null && day - memory.lastGiftDay < FAMILIARITY.giftCooldownDays) return { state: handedOver, counted: false, favourite };
  const bump = favourite ? FAMILIARITY.favouriteGift : FAMILIARITY.gift;
  const remembered: NpcMemory = { ...memory, familiarity: memory.familiarity + bump, lastGiftDay: day };
  return { state: { ...handedOver, people: { ...state.people, [npc.id]: remembered } }, counted: true, favourite };
}

/** The NPC told the Character which gift they would love most (`reveal_favourite`). */
export function revealFavourite(state: GameState, npcId: NamedNpcId): GameState {
  return { ...state, people: { ...state.people, [npcId]: { ...memoryOf(state, npcId), favouriteKnown: true } } };
}

/** Small Talk begins: how many exchanges the NPC chats for before wrapping up, drawn from the save's RNG. */
export function startSmallTalk(state: GameState): { state: GameState; exchanges: number } {
  const { min, max } = SMALL_TALK.exchanges;
  const draw = randomInt(state.rngState, min, max);
  return { state: { ...state, rngState: draw.rngState }, exchanges: draw.value };
}

/** Small Talk has ended, however it ended: the NPC has met the Character once more. */
export function endSmallTalk(state: GameState, npcId: NamedNpcId): GameState {
  return metNpc(state, npcId);
}

/**
 * The NPC heard the Character's name (`learn_name`). It's checked against the name from setup the same way
 * hiring checks it, and only a match is remembered.
 */
export function learnName(state: GameState, npcId: NamedNpcId, heard: string): { state: GameState; learned: boolean } {
  if (!namesMatch(heard, state.identity.characterName)) return { state, learned: false };
  const memory = memoryOf(state, npcId);
  return { state: { ...state, people: { ...state.people, [npcId]: { ...memory, knowsName: true } } }, learned: true };
}

/** What the conversation was about, from its Recap, replaces what the NPC remembered talking about last time. */
export function rememberTopic(state: GameState, npcId: NamedNpcId, topic: string | undefined): GameState {
  const lastTopic = topic?.trim();
  if (!lastTopic) return state;
  return { ...state, people: { ...state.people, [npcId]: { ...memoryOf(state, npcId), lastTopic } } };
}
