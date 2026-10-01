import type { Locale } from '../localization/locale';

// Display committed wall time without reinterpreting it in the device timezone.
export function compactStoredTime(local: string, locale: Locale): string {
  const date = new Date(`${local}Z`);
  const day = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'pl-PL', {
    timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
  }).format(date);
  // Owner decisions, 2026-10-01: both languages use 24-hour time with a two-digit hour, like the cards.
  const time = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'pl-PL', {
    timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
  return `${day}${locale === 'en' ? ' at ' : ', '}${time}`;
}

/** Weekday and 24-hour time of a stored wall time, with the date when asked: "pt 2 paź 18:00" or "Fri, Oct 2, 18:00". */
export function shortStoredTime(local: string, locale: Locale, withDate: boolean): string {
  const time = local.slice(11, 16);
  if (!withDate) return `${weekday(local, locale)} ${time}`;
  return `${shortStoredDay(local, locale)}${locale === 'en' ? ',' : ''} ${time}`;
}

/** Weekday and date of a stored wall time without the hour: "pt 2 paź" or "Fri, Oct 2". */
export function shortStoredDay(local: string, locale: Locale): string {
  const instant = new Date(`${local}Z`);
  const day = instant.getUTCDate(), month = part(local, locale, { month: 'short' }).replace(/\.$/, '');
  return locale === 'en' ? `${weekday(local, locale)}, ${month} ${day}` : `${weekday(local, locale)} ${day} ${month}`;
}
const part = (local: string, locale: Locale, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'pl-PL', { timeZone: 'UTC', ...options }).format(new Date(`${local}Z`));
const weekday = (local: string, locale: Locale) => part(local, locale, { weekday: 'short' }).replace(/\.$/, '');

/** The wall time of an instant in a stored zone. Missing device zone data falls back to UTC rather than hiding it. */
export function wallTimeIn(instant: string, zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
    const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === name)!.value;
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
  } catch {
    return new Date(instant).toISOString().slice(0, 19);
  }
}

/**
 * The one formatter for the path lines ({{time}} and {{date}}, MVP-22-T09): the short day with its time, "czw 29 paź 02:30".
 * In the hour that repeats when summer time ends the stored offset follows, so the two 02:30 differ: "niedz 25 paź 02:30 (UTC+02:00)".
 */
export function pathTimeText(time: { local: string; timezone: string; offset: string }, locale: Locale): string {
  const text = shortStoredTime(time.local, locale, true);
  return repeatedWallTime(time) ? `${text} (UTC${time.offset})` : text;
}
const HOUR = 3600000;
/** True when another instant shows the same wall time in the zone, which only the offset tells apart. */
function repeatedWallTime({ local, timezone, offset }: { local: string; timezone: string; offset: string }): boolean {
  const instant = Date.parse(`${local}${offset}`), wall = Date.parse(`${local}Z`);
  if (Number.isNaN(instant)) return false;
  const offsetAt = (at: number) => Date.parse(`${wallTimeIn(new Date(at).toISOString(), timezone)}Z`) - at;
  return [offsetAt(instant - 6 * HOUR), offsetAt(instant + 6 * HOUR)].some(other => wall - other !== instant && wallTimeIn(new Date(wall - other).toISOString(), timezone) === local);
}
