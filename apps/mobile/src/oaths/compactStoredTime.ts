import type { Locale } from '../localization/locale';

// Display committed wall time without reinterpreting it in the device timezone.
export function compactStoredTime(local: string, locale: Locale): string {
  const date = new Date(`${local}Z`);
  const day = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'pl-PL', {
    timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'pl-PL', {
    timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hourCycle: locale === 'en' ? 'h12' : 'h23',
  }).format(date).replace(/\s/g, '').toLowerCase();
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
