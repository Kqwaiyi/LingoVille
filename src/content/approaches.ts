import type { ApproachId, JobId } from '../sim/index.ts';
import type { Interaction } from './defineInteraction.ts';
import { INTERACTIONS } from './interactions.ts';
import type { NamedNpcId } from './npcs.ts';

/** The conversation an NPC opens when they approach the Character. */
const APPROACH_INTERACTIONS: Record<ApproachId, Interaction> = {
  nurseOnWaking: INTERACTIONS.wakeInWard,
  landlordRentDue: INTERACTIONS.rentReminder,
  landlordDiscountStepDown: INTERACTIONS.newcomerDiscountNews,
};

export function approachInteraction(approachId: ApproachId): Interaction {
  return APPROACH_INTERACTIONS[approachId];
}

const OPENED_BY_NPCS = new Set(Object.values(APPROACH_INTERACTIONS));

/** What the Character brings to the conversation: shopping from the supermarket's shelves, or none, and the Jobs they already have. */
export type Bringing = { shopping: boolean; jobsHired?: readonly JobId[] };

/**
 * The conversation E starts with this Named NPC, or null if they only ever start one themselves.
 * The cashier takes payment for shopping brought to the till, and otherwise helps find something.
 */
export function interactionStartedWithE(npcId: NamedNpcId, { shopping }: Bringing = { shopping: false }): Interaction | null {
  if (npcId === 'cashier') return shopping ? INTERACTIONS.payForGroceries : INTERACTIONS.findAnItem;
  return Object.values(INTERACTIONS).find((i) => i.npcId === npcId && !OPENED_BY_NPCS.has(i) && i.effect.kind !== 'hire') ?? null;
}

/**
 * The second conversation F starts with this Named NPC, or null when E is the only one.
 * With shopping, E at the cashier pays, so F asks where something else is. E at the
 * landlord pays the rent, and F asks for more time. Staff who are hiring take an
 * application on F until the Character has that Job (the cashier, when not paying for shopping).
 */
export function interactionStartedWithF(npcId: NamedNpcId, { shopping, jobsHired = [] }: Bringing = { shopping: false }): Interaction | null {
  if (npcId === 'landlord') return INTERACTIONS.askForMoreTime;
  if (npcId === 'cashier' && shopping) return INTERACTIONS.findAnItem;
  for (const interaction of Object.values(INTERACTIONS)) {
    const { effect } = interaction;
    if (interaction.npcId === npcId && effect.kind === 'hire') return jobsHired.includes(effect.jobId) ? null : interaction;
  }
  return null;
}
