import { resolveLocale, type Locale } from './locale';

export type PluralCategory = 'one' | 'few' | 'many' | 'other';

/** CLDR cardinal category for Polish and English counts. Fractions keep "other", as in CLDR. */
export function pluralCategory(locale: Locale, count: number): PluralCategory {
  if (!Number.isInteger(count)) return 'other';
  const n = Math.abs(count);
  if (locale === 'en') return n === 1 ? 'one' : 'other';
  if (n === 1) return 'one';
  const ten = n % 10;
  const hundred = n % 100;
  return ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14) ? 'few' : 'many';
}

const categories: Record<Locale, PluralCategory[]> = { pl: ['one', 'few', 'many', 'other'], en: ['one', 'other'] };

/**
 * The part of Intl.PluralRules that i18next uses: the constructor, select and resolvedOptions.
 * Hermes on iOS ships without Intl.PluralRules. i18next then gives every count except 1 the "other" form.
 * Only the shipped languages and cardinal counts are covered. Ordinals always answer "other".
 */
export class PluralRulesShim {
  private readonly locale: Locale;
  private readonly ordinal: boolean;
  constructor(locale: string | readonly string[] = 'en', options: { type?: 'cardinal' | 'ordinal' } = {}) {
    this.locale = resolveLocale(typeof locale === 'string' ? locale : locale[0]);
    this.ordinal = options.type === 'ordinal';
  }
  select(count: number): PluralCategory { return this.ordinal ? 'other' : pluralCategory(this.locale, Number(count)); }
  resolvedOptions(): { locale: Locale; pluralCategories: PluralCategory[] } {
    return { locale: this.locale, pluralCategories: this.ordinal ? ['other'] : [...categories[this.locale]] };
  }
  static supportedLocalesOf(locales: string | readonly string[]): string[] { return (typeof locales === 'string' ? [locales] : [...locales]).filter(tag => /^(pl|en)(-|$)/i.test(tag)); }
}

/** Installs the shim only where the runtime has no Intl.PluralRules. A native implementation is never replaced. */
export function ensurePluralRules(): void {
  if (typeof Intl !== 'object' || typeof Intl.PluralRules === 'function') return;
  Object.defineProperty(Intl, 'PluralRules', { value: PluralRulesShim, configurable: true, writable: true });
}
