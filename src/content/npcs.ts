import type { PlaceId } from '../sim/index.ts';

// Named NPC personas. Each Culture Pack localises the name (see culturePacks.ts).
// The full persona schema, with a favourite gift, arrives with ticket 23.

export type NamedNpcId = 'barista' | 'nurse' | 'cashier' | 'convenience-clerk' | 'landlord' | 'server';

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
  cashier: {
    id: 'cashier',
    role: 'cashier',
    placeId: 'supermarket',
    age: 34,
    temperament: 'brisk and cheerful, good at keeping the queue moving without rushing anyone',
    quirks: 'knows exactly which aisle everything is in and is a little proud of it',
  },
  'convenience-clerk': {
    id: 'convenience-clerk',
    role: 'clerk',
    placeId: 'convenience-store',
    age: 21,
    temperament: 'easy-going and polite, a student working shifts around lectures',
    quirks: 'always offers to heat things up and remembers which snacks are fresh out of the fryer',
  },
  landlord: {
    id: 'landlord',
    role: 'landlord',
    placeId: 'home',
    age: 63,
    temperament: 'fussy but fair, firm about rent and kind about everything else',
    quirks: 'potters about the hallway in a cardigan, watering the plants and keeping an eye on who comes and goes',
  },
  server: {
    id: 'server',
    role: 'server',
    placeId: 'restaurant',
    age: 31,
    temperament: 'attentive and unflappable, good at keeping a full dining room happy',
    quirks: 'writes every order on a little pad and always asks about allergies',
  },
};
