import type { FamiliarityTier } from './familiarity.ts';
import { FAMILIARITY, PATIENCE, PROFICIENCY_STEP_TABLE, type ProficiencyStep } from './tuning.ts';

/**
 * An NPC's hidden Patience in one Goal Interaction: how many more turns it will
 * tolerate not understanding the Player. It lives with the conversation, not
 * in the save, and is never shown as a number.
 */
export type Patience = {
  left: number;
  starting: number;
  /** The Player's latest turn already cost Patience, so it can't cost it twice. */
  spentThisTurn: boolean;
  /** Player turns the NPC couldn't make sense of at all, counted even once Patience has run out. Proficiency evidence. */
  turnsNotUnderstood: number;
};

/** A placeholder for the NPC's face, the only way Patience shows. Real faces come in ticket 30. */
export type NpcExpression = 'relaxed' | 'puzzled' | 'strained';

/** Patience at the start of a conversation: from the step table, and one more with a friend. */
export function startPatience(step: ProficiencyStep, tier: FamiliarityTier = 'stranger'): Patience {
  const starting = PROFICIENCY_STEP_TABLE[step].startingPatience + (tier === 'friend' ? FAMILIARITY.friendPatienceBonus : 0);
  return { left: starting, starting, spentThisTurn: false, turnsNotUnderstood: 0 };
}

/** The Player takes a new turn, which may cost Patience once. */
export function newPlayerTurn(patience: Patience): Patience {
  return patience.spentThisTurn ? { ...patience, spentThisTurn: false } : patience;
}

/**
 * The NPC couldn't make sense of the Player's latest turn at all. Costs one
 * Patience, at most once per turn, never below zero. Clarifying re-asks never call this.
 */
export function losePatience(patience: Patience): Patience {
  if (patience.spentThisTurn) return patience;
  return {
    ...patience,
    left: Math.max(0, patience.left - 1),
    spentThisTurn: true,
    turnsNotUnderstood: patience.turnsNotUnderstood + 1,
  };
}

/** At zero the NPC ends the conversation politely, and the interaction fails. */
export function isOutOfPatience(patience: Patience): boolean {
  return patience.left === 0;
}

export function npcExpression(patience: Patience): NpcExpression {
  if (patience.left >= patience.starting) return 'relaxed';
  return patience.left > PATIENCE.strainedAtOrBelow ? 'puzzled' : 'strained';
}

/**
 * The backstop for Patience: a player turn with no letters or digits at all
 * (empty, or only punctuation) can't be made sense of, whatever the NPC says.
 */
export function isUnreadableTranscript(text: string): boolean {
  return !/[\p{L}\p{N}]/u.test(text);
}
