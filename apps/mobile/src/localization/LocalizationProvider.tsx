import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { getLocales } from 'expo-localization';
import { I18nextProvider } from 'react-i18next';
import { createTranslation } from './createTranslation';
import { Locale, resolveLocale } from './locale';

const DefaultLocale = createContext<Locale | null>(null);

export function LocalizationProvider({ children, initialLocale }: PropsWithChildren<{ initialLocale?: Locale }>) {
  const [locale] = useState(() => initialLocale ?? resolveLocale(getLocales()[0]?.languageTag));
  const [instance] = useState(() => createTranslation(locale));
  return <DefaultLocale.Provider value={locale}><I18nextProvider i18n={instance}>{children}</I18nextProvider></DefaultLocale.Provider>;
}

/** The language before a profile sets one, and again after sign-out. The provider's initial locale, else the device language. */
export function useDefaultLocale(): Locale {
  return useContext(DefaultLocale) ?? resolveLocale(getLocales()[0]?.languageTag);
}

export { useTranslation } from 'react-i18next';
