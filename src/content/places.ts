import { CLOCK, PLACE_IDS, type OpeningHours, type PlaceId, type Weekday } from '../sim/index.ts';

const HOUR = 60;

/** Things inside a place that keep their own hours: the landlord at home, and the clinic's Fainting ward. */
export const SERVICE_IDS = ['landlord', 'fainting-ward'] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

/** Everything that has opening hours: the 11 places and the services inside them. */
export const HOURS_IDS = [...PLACE_IDS, ...SERVICE_IDS] as const;
export type HoursId = PlaceId | ServiceId;

/** Hours from `opensAt` to `closesAt` o'clock. Past 24 runs into the next morning (25 is 1:00). */
export function hours(opensAt: number, closesAt: number, closedOn: Weekday[] = []): OpeningHours {
  return { opensAt: opensAt * HOUR, closesAt: closesAt * HOUR, closedOn };
}

/** The town's default hours. A Culture Pack can override them. Null means always open. */
export const PLACE_HOURS: Record<PlaceId, OpeningHours> = {
  home: null,
  cafe: hours(7, 19),
  supermarket: hours(9, 21),
  'convenience-store': null,
  restaurant: hours(11, 22, ['monday']),
  clinic: hours(9, 17, ['sunday']),
  park: null,
  // The trams run 6:00–1:00.
  'tram-stop': hours(6, 25),
  bookshop: hours(10, 20),
  bathhouse: hours(10, 24),
  'town-office': hours(9, 17, ['saturday', 'sunday']),
};

/** Places with no door, so their hours never keep anyone out. At a tram stop, the hours are the trams'. */
export const OPEN_AIR_PLACES: readonly PlaceId[] = ['park', 'tram-stop'];

export const SERVICE_HOURS: Record<ServiceId, OpeningHours> = {
  landlord: hours(8, 20),
  'fainting-ward': null,
};

/** 07:00, from minutes since midnight. Hours that run past midnight wrap: 25:00 is 01:00, but closing at midnight stays 24:00. */
export function formatTime(minuteOfDay: number) {
  const minute = minuteOfDay > CLOCK.minutesPerDay ? minuteOfDay - CLOCK.minutesPerDay : minuteOfDay;
  return `${String(Math.floor(minute / HOUR)).padStart(2, '0')}:${String(minute % HOUR).padStart(2, '0')}`;
}
