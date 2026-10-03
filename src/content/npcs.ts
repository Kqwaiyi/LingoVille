import type { PlaceId } from '../sim/index.ts';

// Named NPC personas. Each Culture Pack localises the name (see culturePacks.ts).
// The full persona schema, with a favourite gift, arrives with ticket 23.

export type NamedNpcId = 'barista';

export type NamedNpc = {
  id: NamedNpcId;
  /** The job they do, in English, as the UI and the prompt name it. */
  role: string;
  placeId: PlaceId;
  age: number;
  temperament: string;
  quirks: string;
};

export const NAMED_NPCS: Record<NamedNpcId, NamedNpc> = {
  barista: {
    id: 'barista',
    role: 'barista',
    placeId: 'cafe',
    age: 27,
    temperament: 'warm and quick, a little chatty when the café is quiet',
    quirks: 'hums while making drinks and is proud of the house blend',
  },
};
