import type { LanguageCode, OpeningHours } from '../sim/index.ts';
import { CULTURE_PACKS } from './culturePacks.ts';
import { PLACE_HOURS, SERVICE_HOURS, type HoursId } from './places.ts';

const DEFAULT_HOURS: Record<HoursId, OpeningHours> = { ...PLACE_HOURS, ...SERVICE_HOURS };

/** A place's (or service's) opening hours in this pack: its override, or the town's default. */
export function placeHours(id: HoursId, packId: LanguageCode): OpeningHours {
  const override = CULTURE_PACKS[packId].hours[id];
  return override === undefined ? DEFAULT_HOURS[id] : override;
}
