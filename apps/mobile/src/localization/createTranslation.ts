import { createInstance } from 'i18next';
import { Locale } from './locale';
import pl from './locales/pl/messages.json';
import en from './locales/en/messages.json';

export const catalogs = { pl, en };

export function createTranslation(locale: Locale) {
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: 'en',
    supportedLngs: ['pl', 'en'],
    initAsync: false,
    resources: { pl: { translation: pl }, en: { translation: en } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}
