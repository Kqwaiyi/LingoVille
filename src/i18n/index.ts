// Public interface of the i18n module. Other modules import from here.
import i18next from 'i18next';
import { useEffect } from 'react';
import { initReactI18next } from 'react-i18next';
import type { LanguageCode } from '../sim/index.ts';
import { de } from './de.ts';
import { en, type UiStrings } from './en.ts';
import { ja } from './ja.ts';
import { zh } from './zh.ts';

export { Trans, useTranslation } from 'react-i18next';
export type { UiStrings } from './en.ts';

/** The UI strings for each Native Language. */
export const RESOURCES: Record<LanguageCode, UiStrings> = { ja, zh, en, de };

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}

/** Each Native Language by its own name ("Deutsch"), whichever Native Language is chosen. */
export const languageEndonym = (language: LanguageCode) => RESOURCES[language].languages[language];

export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(RESOURCES).map(([language, strings]) => [language, { translation: strings }])),
  lng: 'en',
  fallbackLng: 'en',
  // Every resource is bundled, so there's nothing to wait for.
  initAsync: false,
  // React escapes what it renders.
  interpolation: { escapeValue: false },
});

/** Shows the whole UI in the Native Language, switching live whenever it changes. */
export function useShowNativeLanguage(language: LanguageCode) {
  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [language]);
}
