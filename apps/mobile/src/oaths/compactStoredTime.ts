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
  const instant = new Date(`${local}Z`);
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'pl-PL', { timeZone: 'UTC', ...options }).format(instant);
  const weekday = part({ weekday: 'short' }).replace(/\.$/, '');
  const time = local.slice(11, 16);
  if (!withDate) return `${weekday} ${time}`;
  const day = instant.getUTCDate(), month = part({ month: 'short' }).replace(/\.$/, '');
  return locale === 'en' ? `${weekday}, ${month} ${day}, ${time}` : `${weekday} ${day} ${month} ${time}`;
}

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
