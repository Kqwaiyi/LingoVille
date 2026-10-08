import { describe, expect, it } from 'vitest';
import { isOpen, LANGUAGE_CODES, PLACE_IDS, WEEKDAYS } from '../sim/index.ts';
import { formatTime, HOURS_IDS, PLACE_HOURS, placeHours, SERVICE_HOURS, type HoursId } from './index.ts';

const HOUR = 60;
// Day 1 is a Monday.
const dayOf = (weekday: (typeof WEEKDAYS)[number]) => WEEKDAYS.indexOf(weekday) + 1;
/** Open at any time that day: hours on the hour, from 00:00 to 23:00. */
const openSometimeOn = (id: HoursId, packId: (typeof LANGUAGE_CODES)[number], day: number) =>
  Array.from({ length: 24 }, (_, hour) => hour).some((hour) =>
    isOpen(placeHours(id, packId), { day, minuteOfDay: hour * HOUR }),
  );

describe('opening hours', () => {
  it('gives every place and service default hours', () => {
    expect(Object.keys(PLACE_HOURS).sort()).toEqual([...PLACE_IDS].sort());
    expect(Object.keys({ ...PLACE_HOURS, ...SERVICE_HOURS }).sort()).toEqual([...HOURS_IDS].sort());
  });

  it('lets a Culture Pack override the defaults', () => {
    expect(placeHours('cafe', 'zh')).toEqual(PLACE_HOURS.cafe);
    expect(placeHours('cafe', 'de')).not.toEqual(PLACE_HOURS.cafe);
  });

  it.each(LANGUAGE_CODES)('closes the restaurant on Mondays in the %s pack', (packId) => {
    expect(openSometimeOn('restaurant', packId, dayOf('monday'))).toBe(false);
    expect(openSometimeOn('restaurant', packId, dayOf('tuesday'))).toBe(true);
  });

  it('closes everything in the de pack on Sunday except the bathhouse, the Fainting ward, the convenience store and the trams', () => {
    const openOnSunday = HOURS_IDS.filter((id) => openSometimeOn(id, 'de', dayOf('sunday')));
    // Home and the park aren't businesses: they never close.
    expect(openOnSunday.sort()).toEqual(['bathhouse', 'convenience-store', 'fainting-ward', 'home', 'park', 'tram-stop']);
  });

  it('keeps the shops open on Sunday in the other packs', () => {
    for (const packId of ['ja', 'zh', 'en'] as const) {
      expect(openSometimeOn('supermarket', packId, dayOf('sunday')), packId).toBe(true);
    }
  });

  it.each(LANGUAGE_CODES)('opens the town office and post office 9:00–17:00 on weekdays only in the %s pack', (packId) => {
    const office = placeHours('town-office', packId);
    expect(office).toMatchObject({ opensAt: 9 * HOUR, closesAt: 17 * HOUR });
    expect(WEEKDAYS.filter((weekday) => openSometimeOn('town-office', packId, dayOf(weekday)))).toEqual(
      WEEKDAYS.filter((weekday) => weekday !== 'saturday' && weekday !== 'sunday'),
    );
  });

  it('runs the trams until 1:00 the next morning', () => {
    expect(isOpen(placeHours('tram-stop', 'ja'), { day: 2, minuteOfDay: 0.5 * HOUR })).toBe(true);
    expect(isOpen(placeHours('tram-stop', 'ja'), { day: 2, minuteOfDay: 1 * HOUR })).toBe(false);
  });
});

describe('formatTime', () => {
  it('writes minutes since midnight as a 24-hour time, wrapping hours that run past midnight', () => {
    expect(formatTime(7 * HOUR)).toBe('07:00');
    expect(formatTime(24 * HOUR)).toBe('24:00');
    expect(formatTime(25 * HOUR)).toBe('01:00');
  });
});
