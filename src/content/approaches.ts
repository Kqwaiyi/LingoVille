import { STEP_BANDS, type ProficiencyStep } from '../sim/index.ts';
import type { Band, Interaction } from './defineInteraction.ts';
import { INTERACTIONS } from './interactions.ts';
import type { NamedNpcId } from './npcs.ts';

/** What the Character brings to the conversation: their current Proficiency Step. */
export type Bringing = {
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
  return Object.values(INTERACTIONS).find((i) => i.npcId === npcId) ?? null;
}
