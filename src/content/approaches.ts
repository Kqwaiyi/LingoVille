import { STEP_BANDS, type JobId, type ProficiencyStep } from '../sim/index.ts';
import type { Band, Interaction } from './defineInteraction.ts';
import { INTERACTIONS } from './interactions.ts';
import type { NamedNpcId } from './npcs.ts';

/** What the Character brings to the conversation: the Jobs they already have, and their current Proficiency Step. */
export type Bringing = {
  jobsHired?: readonly JobId[];
  step?: ProficiencyStep;
};

/** The barista's order E starts in each band. */
const CAFE_ORDERS: Record<Band, Interaction> = {
  B: INTERACTIONS.orderDrink,
  I: INTERACTIONS.orderWithOptions,
  A: INTERACTIONS.orderAvoidingAllergen,
};

/**
 * The conversation E starts with this Named NPC, or null if they have none yet.
 * The barista takes an order by the band: a drink (Beginner), a drink made to order and something to eat (Intermediate),
 * or an order avoiding an allergen (Advanced).
 */
export function interactionStartedWithE(npcId: NamedNpcId, { step = 'A1' }: Bringing = {}): Interaction | null {
  if (npcId === 'barista') return CAFE_ORDERS[STEP_BANDS[step]];
  return Object.values(INTERACTIONS).find((i) => i.npcId === npcId && i.effect.kind !== 'hire') ?? null;
}

/**
 * The second conversation F starts with this Named NPC, or null when E is the only one.
 * Staff who are hiring take an application on F until the Character has that Job.
 */
export function interactionStartedWithF(npcId: NamedNpcId, { jobsHired = [] }: Bringing = {}): Interaction | null {
  for (const interaction of Object.values(INTERACTIONS)) {
    const { effect } = interaction;
    if (interaction.npcId === npcId && effect.kind === 'hire') return jobsHired.includes(effect.jobId) ? null : interaction;
  }
  return null;
}
