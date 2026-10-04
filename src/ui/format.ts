const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60_000],
  ['month', 30 * 24 * 60 * 60_000],
  ['week', 7 * 24 * 60 * 60_000],
  ['day', 24 * 60 * 60_000],
  ['hour', 60 * 60_000],
  ['minute', 60_000],
];

/** "5 minutes ago", "yesterday": how long ago a real time was, in this language. Null if the time can't be read. */
export function formatTimeAgo(iso: string, language: string, now = Date.now()) {
  const ago = now - Date.parse(iso);
  if (Number.isNaN(ago)) return null;
  const [unit, ms] = UNITS.find(([, size]) => ago >= size) ?? ['minute', 60_000];
  return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-Math.floor(ago / ms), unit);
}

/** "07:05" from minutes since midnight. */
export function formatClock(minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
