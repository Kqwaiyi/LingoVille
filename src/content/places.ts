import type { LanguageCode, PlaceId } from '../sim/index.ts';
import { CULTURE_PACKS } from './culturePacks.ts';

const HOUR = 60;

/** Opening hours in minutes since midnight, or null for always open. */
export type OpeningHours = { opensAt: number; closesAt: number } | null;

/** The town's default hours. A Culture Pack can override them. */
export const PLACE_HOURS: Record<PlaceId, OpeningHours> = {
  home: null,
  cafe: { opensAt: 7 * HOUR, closesAt: 19 * HOUR },
};

/** A place's opening hours in this pack: its override, or the town's default. */
export function placeHours(placeId: PlaceId, packId: LanguageCode): OpeningHours {
  const override = CULTURE_PACKS[packId].hours[placeId];
  return override === undefined ? PLACE_HOURS[placeId] : override;
}

/** 07:00, from minutes since midnight. */
export function formatTime(minuteOfDay: number) {
  return `${String(Math.floor(minuteOfDay / HOUR)).padStart(2, '0')}:${String(minuteOfDay % HOUR).padStart(2, '0')}`;
}
