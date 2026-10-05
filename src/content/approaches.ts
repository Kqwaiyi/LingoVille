import type { ApproachId } from '../sim/index.ts';
import type { Interaction } from './defineInteraction.ts';
import { INTERACTIONS } from './interactions.ts';
import type { NamedNpcId } from './npcs.ts';

/** The conversation an NPC opens when they approach the Character. */
const APPROACH_INTERACTIONS: Record<ApproachId, Interaction> = {
  nurseOnWaking: INTERACTIONS.wakeInWard,
};

export function approachInteraction(approachId: ApproachId): Interaction {
  return APPROACH_INTERACTIONS[approachId];
}

const OPENED_BY_NPCS = new Set(Object.values(APPROACH_INTERACTIONS));

/** The conversation E starts with this Named NPC, or null if they only ever start one themselves. */
export function interactionStartedWithE(npcId: NamedNpcId): Interaction | null {
  return Object.values(INTERACTIONS).find((i) => i.npcId === npcId && !OPENED_BY_NPCS.has(i)) ?? null;
}
