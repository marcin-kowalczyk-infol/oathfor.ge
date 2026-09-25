import { createInstance } from 'i18next';
import { Locale } from './locale';
import pl from './locales/pl/messages.json';
import en from './locales/en/messages.json';

import plTimePicker from './locales/pl/timePicker.json';
import enTimePicker from './locales/en/timePicker.json';

export const catalogs = { pl: { ...pl, timePicker: plTimePicker }, en: { ...en, timePicker: enTimePicker } };

export function createTranslation(locale: Locale) {
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: 'en',
    supportedLngs: ['pl', 'en'],
    initAsync: false,
    resources: { pl: { translation: catalogs.pl }, en: { translation: catalogs.en } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}
