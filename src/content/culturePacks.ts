import { z } from 'zod';
import { LANGUAGE_CODES, PLACE_IDS, type LanguageCode, type PlaceId } from '../sim/index.ts';
import { APPEARANCE_PRESET_IDS, type AppearancePresetId } from './appearance.ts';
import { ITEM_IDS, type ItemId } from './items.ts';
import type { NamedNpcId } from './npcs.ts';
import type { OpeningHours } from './places.ts';

// Each Culture Pack dresses the same town as Japan, China, the UK or Germany:
// local names, prices, money, customs, signs, sounds and props. Everything the
// Player can read carries a gloss in each of the three other Native Languages.

/** A Native Language → the meaning in it. A pack glosses its words in the three languages other than its own. */
export type Glosses = Partial<Record<LanguageCode, string>>;

/** An item as this pack sells it: its local name and glosses. Its price is the catalogue's (`ITEMS`), converted. */
export type Good = { name: string; glosses: Glosses };

/** Round prices below `below` (in local money) to multiples of `step`. The last rule has no `below`. */
export type PriceStep = { below?: number; step: number };

export type Currency = {
  /** ISO 4217. */
  code: string;
  /** How money is written: the locale `Intl` formats it in. */
  locale: string;
  /** Written after the number instead of as a currency symbol, as in 18元. */
  suffix?: string;
  /** What one Shift's base pay is worth: the anchor every price ratio converts by. */
  perShift: number;
  /** Local price points, from the smallest prices up. */
  priceSteps: PriceStep[];
};

/** Prop ids the world knows how to draw. Each pack picks the small set dressing it shows. */
export const PROP_IDS = ['noren', 'lucky-cat', 'red-lantern', 'tea-set', 'cake-stand', 'pretzel-basket', 'teapot', 'bunting'] as const;
export type PropId = (typeof PROP_IDS)[number];

/** Words that go on signs, apart from place names and goods. */
export const SIGN_WORDS = ['openingHours', 'menu'] as const;
export type SignWord = (typeof SIGN_WORDS)[number];

export type CulturePack = {
  id: LanguageCode;
  /** The Target Language's name in English, for the English meta-prompt. */
  languageName: string;
  /** The country the town is in, in English. */
  setting: string;
  currency: Currency;
  /** Local customs the staff know, in English. */
  customs: string[];
  /** Opening hours that differ from the town's defaults (`PLACE_HOURS`). */
  hours: Partial<Record<PlaceId, OpeningHours>>;
  /** Ambient one-shot sound ids, played now and then around the town (ticket 32). */
  ambient: string[];
  goods: Record<ItemId, Good>;
  signs: Record<SignWord, { text: string; glosses: Glosses }>;
  cafe: {
    name: string;
    nameGlosses: Glosses;
    /** Facts the café staff know, in English. */
    facts: string[];
  };
  /** Persona localisations: each Named NPC's local name. */
  personas: Record<NamedNpcId, { name: string }>;
  appearances: {
    /** Persona × pack → Appearance Preset. */
    npcs: Record<NamedNpcId, AppearancePresetId>;
    /** How often each preset turns up among Shift Customers. */
    customerWeights: Partial<Record<AppearancePresetId, number>>;
  };
  props: PropId[];
};

const HOUR = 60;
const hours = (opensAt: number, closesAt: number) => ({ opensAt: opensAt * HOUR, closesAt: closesAt * HOUR });

/** The schema a Culture Pack must pass. Its glosses must cover exactly the three other Native Languages. */
export function culturePackSchema(packId: LanguageCode) {
  const text = z.string().trim().min(1);
  const others = LANGUAGE_CODES.filter((language) => language !== packId);
  const glosses = z.strictObject(Object.fromEntries(others.map((language) => [language, text])));
  const kebab = z.string().regex(/^[a-z]+(-[a-z]+)*$/);
  const openingHours = z
    .object({ opensAt: z.int().min(0).max(24 * HOUR), closesAt: z.int().min(0).max(24 * HOUR) })
    .refine(({ opensAt, closesAt }) => opensAt < closesAt, 'A place must open before it closes.')
    .nullable();
  const priceSteps = z
    .array(z.object({ below: z.number().positive().optional(), step: z.number().positive() }))
    .min(1)
    .refine((steps) => steps.every((s, i) => (i === steps.length - 1) === (s.below === undefined)), 'Only the last price step has no "below".')
    .refine((steps) => steps.every((s, i) => i === 0 || s.below === undefined || s.below > steps[i - 1]!.below!), 'Price steps go up.');

  return z.object({
    id: z.literal(packId),
    languageName: text,
    setting: text,
    currency: z.object({
      code: z.string().regex(/^[A-Z]{3}$/),
      locale: text,
      suffix: text.optional(),
      perShift: z.number().positive(),
      priceSteps,
    }),
    customs: z.array(text),
    hours: z.partialRecord(z.enum(PLACE_IDS), openingHours),
    ambient: z.array(kebab),
    goods: z.partialRecord(z.enum(ITEM_IDS), z.object({ name: text, glosses })),
    signs: z.record(z.enum(SIGN_WORDS), z.object({ text, glosses })),
    cafe: z.object({ name: text, nameGlosses: glosses, facts: z.array(text) }),
    personas: z.record(z.string(), z.object({ name: text })),
    appearances: z.object({
      npcs: z.record(z.string(), z.enum(APPEARANCE_PRESET_IDS)),
      customerWeights: z.partialRecord(z.enum(APPEARANCE_PRESET_IDS), z.number().positive()),
    }),
    props: z.array(z.enum(PROP_IDS)),
  });
}

export const CULTURE_PACKS: Record<LanguageCode, CulturePack> = {
  ja: {
    id: 'ja',
    languageName: 'Japanese',
    setting: 'Japan',
    currency: {
      code: 'JPY',
      // en-JP writes ¥ as the half-width sign the Player expects, with comma grouping.
      locale: 'en-JP',
      perShift: 6000,
      priceSteps: [{ below: 1000, step: 10 }, { step: 100 }],
    },
    customs: [
      'Tipping is not done, and staff will politely turn a tip down.',
      'Customers put their money on the small tray by the till rather than in the hand.',
    ],
    hours: { cafe: hours(7, 20) },
    ambient: ['crow-caw', 'level-crossing', 'shop-door-chime', 'evening-chime'],
    goods: {
      latte: { name: 'ホットラテ', glosses: { zh: '热拿铁', en: 'Hot latte', de: 'Heißer Latte' } },
      coffee: { name: 'ブレンドコーヒー', glosses: { zh: '招牌混合咖啡', en: 'House blend coffee', de: 'Kaffee der Hausmischung' } },
      tea: { name: '紅茶', glosses: { zh: '红茶', en: 'Black tea', de: 'Schwarzer Tee' } },
      pastry: { name: 'メロンパン', glosses: { zh: '菠萝包', en: 'Melon bread', de: 'Melonenbrötchen' } },
    },
    signs: {
      openingHours: { text: '営業時間', glosses: { zh: '营业时间', en: 'Opening hours', de: 'Öffnungszeiten' } },
      menu: { text: 'メニュー', glosses: { zh: '菜单', en: 'Menu', de: 'Speisekarte' } },
    },
    cafe: {
      name: 'ほしコーヒー',
      nameGlosses: { zh: '星星咖啡', en: 'Star Coffee', de: 'Stern-Kaffee' },
      facts: ['Cash, card and IC cards are all fine.', 'The toilet is at the back.', 'There is free Wi-Fi.'],
    },
    personas: { barista: { name: '佐藤' } },
    appearances: {
      npcs: { barista: 'preset-2' },
      customerWeights: { 'preset-1': 3, 'preset-2': 3, 'preset-3': 2, 'preset-4': 2 },
    },
    props: ['noren', 'lucky-cat'],
  },
  zh: {
    id: 'zh',
    languageName: 'Mandarin Chinese',
    setting: 'China',
    currency: {
      code: 'CNY',
      locale: 'zh-CN',
      suffix: '元',
      perShift: 240,
      priceSteps: [{ below: 100, step: 1 }, { step: 5 }],
    },
    customs: ['Tipping is not expected.', 'Most people pay by scanning a QR code with WeChat or Alipay.'],
    hours: {},
    ambient: ['bicycle-bell', 'scooter-horn', 'street-vendor-call', 'shop-door-chime'],
    goods: {
      latte: { name: '热拿铁', glosses: { ja: 'ホットラテ', en: 'Hot latte', de: 'Heißer Latte' } },
      coffee: { name: '美式咖啡', glosses: { ja: 'アメリカーノ', en: 'Americano', de: 'Americano' } },
      tea: { name: '红茶', glosses: { ja: '紅茶', en: 'Black tea', de: 'Schwarzer Tee' } },
      pastry: { name: '蛋挞', glosses: { ja: 'エッグタルト', en: 'Egg tart', de: 'Puddingtörtchen' } },
    },
    signs: {
      openingHours: { text: '营业时间', glosses: { ja: '営業時間', en: 'Opening hours', de: 'Öffnungszeiten' } },
      menu: { text: '菜单', glosses: { ja: 'メニュー', en: 'Menu', de: 'Speisekarte' } },
    },
    cafe: {
      name: '星星咖啡',
      nameGlosses: { ja: 'スターコーヒー', en: 'Star Coffee', de: 'Stern-Kaffee' },
      facts: ['WeChat Pay, Alipay and cash are all fine.', 'The toilet is at the back.', 'There is free Wi-Fi.'],
    },
    personas: { barista: { name: '小李' } },
    appearances: {
      npcs: { barista: 'preset-3' },
      customerWeights: { 'preset-1': 3, 'preset-2': 2, 'preset-3': 3, 'preset-4': 2 },
    },
    props: ['red-lantern', 'tea-set'],
  },
  en: {
    id: 'en',
    languageName: 'British English',
    setting: 'the UK',
    currency: {
      code: 'GBP',
      locale: 'en-GB',
      perShift: 60,
      priceSteps: [{ below: 10, step: 0.05 }, { below: 100, step: 0.5 }, { step: 1 }],
    },
    customs: [
      'Customers order and pay at the counter; there is no table service.',
      'Tipping at the counter is optional, and there is a tip jar by the till.',
    ],
    hours: { cafe: hours(7, 18) },
    ambient: ['pigeon-coo', 'bus-brakes', 'church-bells', 'shop-door-chime'],
    goods: {
      latte: { name: 'Latte', glosses: { ja: 'ラテ', zh: '拿铁', de: 'Latte' } },
      coffee: { name: 'Filter coffee', glosses: { ja: 'ドリップコーヒー', zh: '滴滤咖啡', de: 'Filterkaffee' } },
      tea: { name: 'Cup of tea', glosses: { ja: '紅茶', zh: '一杯红茶', de: 'Tasse Tee' } },
      pastry: { name: 'Scone', glosses: { ja: 'スコーン', zh: '司康饼', de: 'Scone' } },
    },
    signs: {
      openingHours: { text: 'Opening hours', glosses: { ja: '営業時間', zh: '营业时间', de: 'Öffnungszeiten' } },
      menu: { text: 'Menu', glosses: { ja: 'メニュー', zh: '菜单', de: 'Speisekarte' } },
    },
    cafe: {
      name: 'The Little Star Café',
      nameGlosses: { ja: '小さな星カフェ', zh: '小星星咖啡馆', de: 'Café Kleiner Stern' },
      facts: ['Card and cash are both fine.', 'The toilet is at the back.', 'There is free Wi-Fi.'],
    },
    personas: { barista: { name: 'Jess' } },
    appearances: {
      npcs: { barista: 'preset-1' },
      customerWeights: { 'preset-1': 3, 'preset-2': 2, 'preset-3': 2, 'preset-4': 3 },
    },
    props: ['teapot', 'bunting'],
  },
  de: {
    id: 'de',
    languageName: 'German',
    setting: 'Germany',
    currency: {
      code: 'EUR',
      locale: 'de-DE',
      perShift: 60,
      priceSteps: [{ below: 10, step: 0.1 }, { below: 100, step: 0.5 }, { step: 1 }],
    },
    customs: [
      'At the counter tipping is optional; people often round up.',
      'Cash is still common, and some cafés only take card above a few euros.',
    ],
    hours: { cafe: hours(8, 18) },
    ambient: ['tram-bell', 'church-bells', 'bicycle-bell', 'shop-door-chime'],
    goods: {
      latte: { name: 'Latte macchiato', glosses: { ja: 'ラテ・マキアート', zh: '拿铁玛奇朵', en: 'Latte macchiato' } },
      coffee: { name: 'Filterkaffee', glosses: { ja: 'ドリップコーヒー', zh: '滴滤咖啡', en: 'Filter coffee' } },
      tea: { name: 'Schwarztee', glosses: { ja: '紅茶', zh: '红茶', en: 'Black tea' } },
      pastry: { name: 'Butterbrezel', glosses: { ja: 'バタープレッツェル', zh: '黄油扭结饼', en: 'Butter pretzel' } },
    },
    signs: {
      openingHours: { text: 'Öffnungszeiten', glosses: { ja: '営業時間', zh: '营业时间', en: 'Opening hours' } },
      menu: { text: 'Karte', glosses: { ja: 'メニュー', zh: '菜单', en: 'Menu' } },
    },
    cafe: {
      name: 'Café Stern',
      nameGlosses: { ja: 'カフェ・シュテルン（星）', zh: '星星咖啡馆', en: 'Star Café' },
      facts: ['Card and cash are both fine.', 'The toilet is at the back.', 'There is free Wi-Fi.'],
    },
    personas: { barista: { name: 'Lena' } },
    appearances: {
      npcs: { barista: 'preset-4' },
      customerWeights: { 'preset-1': 2, 'preset-2': 3, 'preset-3': 3, 'preset-4': 2 },
    },
    props: ['cake-stand', 'pretzel-basket'],
  },
};
