import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '../locales/en';
import bm from '../locales/bm';

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
const supportedLanguage = deviceLocale === 'ms' ? 'ms' : 'en';

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources: {
      en,
      ms: bm,
    },
    lng: supportedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
