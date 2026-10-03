import type { PlaceId } from '../sim/index.ts';
import type { NamedNpcId } from './npcs.ts';

/** How hard a Goal Interaction is: Beginner, Intermediate or Advanced. */
export type Band = 'B' | 'I' | 'A';

// Goal Interactions as plain data. Ticket 04 replaces this with the Zod-typed
// `defineInteraction`, which adds the completion function and the effect on success.
export type Interaction = {
  id: string;
  placeId: PlaceId;
  npcId: NamedNpcId;
  /** The one goal, in plain English, as the NPC is told it. */
  goal: string;
  band: Band;
};

export const INTERACTIONS = {
  orderDrink: {
    id: 'order-drink',
    placeId: 'cafe',
    npcId: 'barista',
    goal: "Take the customer's drink order.",
    band: 'B',
  },
} satisfies Record<string, Interaction>;
