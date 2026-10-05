import type { PlaceId } from '../sim/index.ts';

// Named NPC personas. Each Culture Pack localises the name (see culturePacks.ts).
// The full persona schema, with a favourite gift, arrives with ticket 23.

export type NamedNpcId = 'barista' | 'nurse';

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
  nurse: {
    id: 'nurse',
    role: 'nurse',
    placeId: 'clinic',
    age: 46,
    temperament: 'calm, kind and practical, used to patients waking up confused',
    quirks: 'checks the time on the watch pinned to the uniform and gently tells people off for skipping meals',
  },
};
