import { faintedBetween } from './faint.ts';
import type { GameState } from './state.ts';

/**
 * The times an NPC starts a conversation with the Character by themselves,
 * without the Player pressing E. Later: the landlord in the hallway, the
 * doctor calling the Character's name, park regulars waving them over.
 */
export const APPROACH_IDS = ['nurseOnWaking'] as const;
export type ApproachId = (typeof APPROACH_IDS)[number];

/** Whether this change to the game brings an NPC up to the Character, and which. */
export function approachDue(before: GameState, after: GameState): ApproachId | null {
  if (faintedBetween(before, after)) return 'nurseOnWaking';
  return null;
}
