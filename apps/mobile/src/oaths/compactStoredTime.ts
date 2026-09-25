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
