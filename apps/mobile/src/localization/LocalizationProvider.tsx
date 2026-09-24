import { PropsWithChildren, useState } from 'react';
import { getLocales } from 'expo-localization';
import { I18nextProvider } from 'react-i18next';
import { createTranslation } from './createTranslation';
import { Locale, resolveLocale } from './locale';

export function LocalizationProvider({ children, initialLocale }: PropsWithChildren<{ initialLocale?: Locale }>) {
  const [instance] = useState(() => createTranslation(initialLocale ?? resolveLocale(getLocales()[0]?.languageTag)));
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}

export { useTranslation } from 'react-i18next';
