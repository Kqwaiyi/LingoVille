import type { PlaceId } from '../sim/index.ts';

const HOUR = 60;

/** Opening hours in minutes since midnight, or null for always open. A Culture Pack can override them (ticket 11). */
export type OpeningHours = { opensAt: number; closesAt: number } | null;

export const PLACE_HOURS: Record<PlaceId, OpeningHours> = {
  home: null,
  cafe: { opensAt: 7 * HOUR, closesAt: 19 * HOUR },
};
