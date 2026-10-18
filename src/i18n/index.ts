// Public interface of the i18n module. Other modules import from here.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en.ts';

export { Trans, useTranslation } from 'react-i18next';

/** The UI strings: the UI is in English. */
export const RESOURCES = { en };

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}

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
