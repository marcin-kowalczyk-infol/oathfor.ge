export type Locale = 'pl' | 'en';

export function resolveLocale(languageTag?: string | null): Locale {
  return languageTag?.toLowerCase().split('-')[0] === 'pl' ? 'pl' : 'en';
}
