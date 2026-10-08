import type { PlaceId } from '../sim/index.ts';
import type { HoursId } from './places.ts';

// Who the Character can find at each place: one staff role per counter, with
// no shift changes, plus the park regulars and people waiting for the tram.
// Only some have conversations yet; the rest stand in for the tickets that
// give them one.

export const ROLE_IDS = [
  'landlord',
  'barista',
  'cashier',
  'clerk',
  'server',
  'receptionist',
  'doctor',
  'nurse',
  'pharmacist',
  'regular',
  'passer-by',
  'shopkeeper',
  'attendant',
] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const TOWN_NPC_IDS = [
  'landlord',
  'barista',
  'cashier',
  'convenience-clerk',
  'server',
  'receptionist',
  'doctor',
  'nurse',
  'pharmacist',
  'park-regular-1',
  'park-regular-2',
  'park-regular-3',
  'passer-by-1',
  'passer-by-2',
  'passer-by-3',
  'shopkeeper',
  'attendant',
  'office-clerk',
] as const;
export type TownNpcId = (typeof TOWN_NPC_IDS)[number];

export type TownNpc = {
  role: RoleId;
  placeId: PlaceId;
  /** Whose hours they keep: their place's, or a service's inside it. They can be talked to only then. */
  hoursId: HoursId;
};

const at = (placeId: PlaceId, role: RoleId, hoursId: HoursId = placeId): TownNpc => ({ role, placeId, hoursId });

export const TOWN_NPCS: Record<TownNpcId, TownNpc> = {
  landlord: at('home', 'landlord', 'landlord'),
  barista: at('cafe', 'barista'),
  cashier: at('supermarket', 'cashier'),
  'convenience-clerk': at('convenience-store', 'clerk'),
  server: at('restaurant', 'server'),
  receptionist: at('clinic', 'receptionist'),
  doctor: at('clinic', 'doctor'),
  nurse: at('clinic', 'nurse'),
  pharmacist: at('clinic', 'pharmacist'),
  'park-regular-1': at('park', 'regular'),
  'park-regular-2': at('park', 'regular'),
  'park-regular-3': at('park', 'regular'),
  // Waiting for a tram, so only while the trams run.
  'passer-by-1': at('tram-stop', 'passer-by'),
  'passer-by-2': at('tram-stop', 'passer-by'),
  'passer-by-3': at('tram-stop', 'passer-by'),
  shopkeeper: at('bookshop', 'shopkeeper'),
  attendant: at('bathhouse', 'attendant'),
  'office-clerk': at('town-office', 'clerk'),
};

/** The tram stops, in order along the line. All of them are the place `tram-stop`; which one the Character is at lies in the world. */
export const TRAM_LINE = ['west-stop', 'central-stop', 'east-stop'] as const;
export type TramStopId = (typeof TRAM_LINE)[number];

/** The stop each passer-by waits at. */
export const PASSER_BY_STOPS = {
  'passer-by-1': 'west-stop',
  'passer-by-2': 'central-stop',
  'passer-by-3': 'east-stop',
} as const satisfies Partial<Record<TownNpcId, TramStopId>>;
export type PasserById = keyof typeof PASSER_BY_STOPS;
/** The passers-by, in a fixed order. */
export const PASSER_BY_IDS = Object.keys(PASSER_BY_STOPS) as PasserById[];

/** Someone at a tram stop: not a Named NPC, with no name, persona or memory of the Character. */
export const isPasserBy = (npcId: TownNpcId): npcId is PasserById => npcId in PASSER_BY_STOPS;

/** The places nearest each stop, west to east: where to get off for each. The world lays the town out to match. */
export const STOP_PLACES: Record<TramStopId, readonly PlaceId[]> = {
  'west-stop': ['town-office', 'bookshop', 'clinic'],
  'central-stop': ['home', 'convenience-store', 'park', 'cafe'],
  'east-stop': ['supermarket', 'bathhouse', 'restaurant'],
};

/** How many stops along the line one stop is from another. */
export function stopsBetween(from: TramStopId, to: TramStopId): number {
  return Math.abs(TRAM_LINE.indexOf(to) - TRAM_LINE.indexOf(from));
}
