import type { LanguageCode } from '../sim/index.ts';
import type { CafeItemId } from './cafe.ts';
import type { NamedNpcId } from './npcs.ts';

// The parts of each Culture Pack that conversations need so far. Ticket 11 turns
// this into the full Zod-typed pack (menus, prices, signs, glosses, hours).

export type CulturePack = {
  id: LanguageCode;
  /** The Target Language's name in English, for the English meta-prompt. */
  languageName: string;
  /** The country the town is in, in English. */
  setting: string;
  cafe: {
    name: string;
    /** Facts the café staff know, in English. */
    facts: string[];
    /** Each café item's local name, as it's written on the menu. */
    menu: Record<CafeItemId, string>;
  };
  /** Persona localisations: each Named NPC's local name. */
  personas: Record<NamedNpcId, { name: string }>;
};

export const CULTURE_PACKS: Record<LanguageCode, CulturePack> = {
  ja: {
    id: 'ja',
    languageName: 'Japanese',
    setting: 'Japan',
    cafe: {
      name: 'ほしコーヒー',
      facts: ['Cash, card and IC cards are all fine.', 'The toilet is at the back.', 'There is free Wi-Fi.'],
      menu: { latte: 'ホットラテ', coffee: 'コーヒー', tea: '紅茶' },
    },
    personas: { barista: { name: '佐藤' } },
  },
  zh: {
    id: 'zh',
    languageName: 'Mandarin Chinese',
    setting: 'China',
    cafe: {
      name: '星星咖啡',
      facts: ['WeChat Pay, Alipay and cash are all fine.', 'The toilet is at the back.', 'There is free Wi-Fi.'],
      menu: { latte: '热拿铁', coffee: '美式咖啡', tea: '红茶' },
    },
    personas: { barista: { name: '小李' } },
  },
  en: {
    id: 'en',
    languageName: 'British English',
    setting: 'the UK',
    cafe: {
      name: 'The Little Star Café',
      facts: ['Card and cash are both fine.', 'The toilet is at the back.', 'There is free Wi-Fi.'],
      menu: { latte: 'Hot latte', coffee: 'Filter coffee', tea: 'Cup of tea' },
    },
    personas: { barista: { name: 'Jess' } },
  },
  de: {
    id: 'de',
    languageName: 'German',
    setting: 'Germany',
    cafe: {
      name: 'Café Stern',
      facts: ['Card and cash are both fine.', 'The toilet is at the back.', 'There is free Wi-Fi.'],
      menu: { latte: 'Latte macchiato', coffee: 'Filterkaffee', tea: 'Schwarztee' },
    },
    personas: { barista: { name: 'Lena' } },
  },
};
