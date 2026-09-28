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
