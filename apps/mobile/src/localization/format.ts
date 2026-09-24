import { Locale } from './locale';

export function formatDeadline(instant: Date, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone, year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
  }).format(instant);
}
