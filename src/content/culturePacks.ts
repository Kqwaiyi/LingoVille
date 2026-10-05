import { z } from 'zod';
import { CLOCK, LANGUAGE_CODES, WEEKDAYS, type LanguageCode, type OpeningHours, type PlaceId } from '../sim/index.ts';
import { APPEARANCE_PRESET_IDS, type AppearancePresetId } from './appearance.ts';
import { ITEM_IDS, type ItemId } from './items.ts';
import type { NamedNpcId } from './npcs.ts';
import { hours, HOURS_IDS, type HoursId } from './places.ts';

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

/** A shop the Character can be served at: its local name, glosses, and facts its staff know (in English). */
export type Shop = { name: string; nameGlosses: Glosses; facts: string[] };

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
  /** Opening hours that differ from the town's defaults (`PLACE_HOURS`, `SERVICE_HOURS`). */
  hours: Partial<Record<HoursId, OpeningHours>>;
  /** Ambient one-shot sound ids, played now and then around the town (ticket 32). */
  ambient: string[];
  goods: Record<ItemId, Good>;
  signs: Record<SignWord, { text: string; glosses: Glosses }>;
  cafe: Shop;
  supermarket: Shop;
  convenienceStore: Shop;
  /** The clinic and hospital, by its local name: where the Fainting ward is. */
  hospital: { name: string; nameGlosses: Glosses };
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

const DAY = CLOCK.minutesPerDay;

/** The schema a Culture Pack must pass. Its glosses must cover exactly the three other Native Languages. */
export function culturePackSchema(packId: LanguageCode) {
  const text = z.string().trim().min(1);
  const others = LANGUAGE_CODES.filter((language) => language !== packId);
  const glosses = z.strictObject(Object.fromEntries(others.map((language) => [language, text])));
  const kebab = z.string().regex(/^[a-z]+(-[a-z]+)*$/);
  const openingHours = z
    .object({
      opensAt: z.int().min(0).max(DAY),
      // Past 24:00 runs into the next morning, but it must close before opening time comes round again.
      closesAt: z.int().min(0).max(2 * DAY),
      closedOn: z.array(z.enum(WEEKDAYS)),
    })
    .refine(({ opensAt, closesAt }) => opensAt < closesAt, 'A place must open before it closes.')
    .refine(({ opensAt, closesAt }) => closesAt - opensAt < DAY, 'Open all day is null, not 24 hours.')
    .nullable();
  const priceSteps = z
    .array(z.object({ below: z.number().positive().optional(), step: z.number().positive() }))
    .min(1)
    .refine((steps) => steps.every((s, i) => (i === steps.length - 1) === (s.below === undefined)), 'Only the last price step has no "below".')
    .refine((steps) => steps.every((s, i) => i === 0 || s.below === undefined || s.below > steps[i - 1]!.below!), 'Price steps go up.');
  const shop = z.object({ name: text, nameGlosses: glosses, facts: z.array(text) });

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
    hours: z.partialRecord(z.enum(HOURS_IDS), openingHours),
    ambient: z.array(kebab),
    goods: z.partialRecord(z.enum(ITEM_IDS), z.object({ name: text, glosses })),
    signs: z.record(z.enum(SIGN_WORDS), z.object({ text, glosses })),
    cafe: shop,
    supermarket: shop,
    convenienceStore: shop,
    hospital: z.object({ name: text, nameGlosses: glosses }),
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
      snack: { name: 'からあげ', glosses: { zh: '日式炸鸡块', en: 'Japanese fried chicken', de: 'Japanisches Brathähnchen' } },
      bento: { name: 'のり弁当', glosses: { zh: '海苔便当', en: 'Seaweed bento box', de: 'Nori-Bento' } },
      vegetables: { name: 'キャベツ', glosses: { zh: '卷心菜', en: 'Cabbage', de: 'Weißkohl' } },
      eggs: { name: '卵', glosses: { zh: '鸡蛋', en: 'Eggs', de: 'Eier' } },
      noodles: { name: 'うどん', glosses: { zh: '乌冬面', en: 'Udon noodles', de: 'Udon-Nudeln' } },
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
    supermarket: {
      name: 'スーパーまるやま',
      nameGlosses: { zh: '丸山超市', en: 'Maruyama Supermarket', de: 'Supermarkt Maruyama' },
      facts: [
        'Plastic bags cost nothing here; the cashier asks whether the customer wants one.',
        'The points card is free; customers who have one show it at the till.',
        'Cash, card and IC cards are all fine.',
      ],
    },
    convenienceStore: {
      name: 'ニコニコマート',
      nameGlosses: { zh: '笑笑便利店', en: 'Smile Mart', de: 'Smile-Markt' },
      facts: [
        'Bentos are heated in the microwave behind the counter for free; the clerk asks whether to heat one.',
        'Hot snacks are kept in the warmer by the till.',
        'Cash, card and IC cards are all fine.',
      ],
    },
    hospital: {
      name: 'みどり総合病院',
      nameGlosses: { zh: '绿树综合医院', en: 'Midori General Hospital', de: 'Allgemeines Krankenhaus Midori' },
    },
    personas: { barista: { name: '佐藤' }, nurse: { name: '高橋' }, cashier: { name: '鈴木' }, 'convenience-clerk': { name: '田中' } },
    appearances: {
      npcs: { barista: 'preset-2', nurse: 'preset-4', cashier: 'preset-1', 'convenience-clerk': 'preset-3' },
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
      snack: { name: '茶叶蛋', glosses: { ja: '茶葉卵', en: 'Tea egg', de: 'Tee-Ei' } },
      bento: { name: '盒饭', glosses: { ja: 'お弁当', en: 'Boxed rice meal', de: 'Reis-Box' } },
      vegetables: { name: '青菜', glosses: { ja: 'チンゲン菜', en: 'Bok choy', de: 'Pak Choi' } },
      eggs: { name: '鸡蛋', glosses: { ja: '卵', en: 'Eggs', de: 'Eier' } },
      noodles: { name: '挂面', glosses: { ja: '乾麺', en: 'Dried noodles', de: 'Getrocknete Nudeln' } },
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
    supermarket: {
      name: '好又多超市',
      nameGlosses: { ja: 'ハオヨウドゥオ・スーパー', en: 'Good-and-Plenty Supermarket', de: 'Supermarkt Gut-und-Viel' },
      facts: [
        'Plastic bags are free here; the cashier asks whether the customer wants one.',
        'The membership points card is free; customers who have one show it at the till.',
        'WeChat Pay, Alipay and cash are all fine.',
      ],
    },
    convenienceStore: {
      name: '快客便利店',
      nameGlosses: { ja: 'クイック・コンビニ', en: 'Quick Stop', de: 'Quick-Stop-Laden' },
      facts: [
        'Boxed meals are heated in the microwave behind the counter for free; the clerk asks whether to heat one.',
        'Tea eggs simmer in a pot by the till.',
        'WeChat Pay, Alipay and cash are all fine.',
      ],
    },
    hospital: {
      name: '绿城医院',
      nameGlosses: { ja: '緑城病院', en: 'Green City Hospital', de: 'Krankenhaus Grünstadt' },
    },
    personas: { barista: { name: '小李' }, nurse: { name: '王芳' }, cashier: { name: '张敏' }, 'convenience-clerk': { name: '小陈' } },
    appearances: {
      npcs: { barista: 'preset-3', nurse: 'preset-1', cashier: 'preset-2', 'convenience-clerk': 'preset-4' },
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
      snack: { name: 'Sausage roll', glosses: { ja: 'ソーセージロール', zh: '香肠卷', de: 'Würstchen im Blätterteig' } },
      bento: { name: 'Microwave lasagne', glosses: { ja: 'レンジで温めるラザニア', zh: '微波炉千层面', de: 'Mikrowellen-Lasagne' } },
      vegetables: { name: 'Carrots', glosses: { ja: 'にんじん', zh: '胡萝卜', de: 'Karotten' } },
      eggs: { name: 'Eggs', glosses: { ja: '卵', zh: '鸡蛋', de: 'Eier' } },
      noodles: { name: 'Spaghetti', glosses: { ja: 'スパゲッティ', zh: '意大利面', de: 'Spaghetti' } },
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
    supermarket: {
      name: 'Brooks Supermarket',
      nameGlosses: { ja: 'ブルックス・スーパー', zh: '布鲁克斯超市', de: 'Brooks Supermarkt' },
      facts: [
        'Bags are free here; the cashier asks whether the customer wants one.',
        'The loyalty card is free; customers who have one show it at the till.',
        'Card and cash are both fine.',
      ],
    },
    convenienceStore: {
      name: 'Patel’s Corner Shop',
      nameGlosses: { ja: 'パテルさんの街角の店', zh: '帕特尔街角小店', de: 'Patels Eckladen' },
      facts: [
        'Ready meals are heated in the microwave behind the counter for free; the clerk asks whether to heat one.',
        'Sausage rolls are kept warm in the cabinet by the till.',
        'Card and cash are both fine.',
      ],
    },
    hospital: {
      name: 'St Mary’s Hospital',
      nameGlosses: { ja: 'セント・メアリー病院', zh: '圣玛丽医院', de: 'St.-Marien-Krankenhaus' },
    },
    personas: { barista: { name: 'Jess' }, nurse: { name: 'Bridget' }, cashier: { name: 'Priya' }, 'convenience-clerk': { name: 'Dev' } },
    appearances: {
      npcs: { barista: 'preset-1', nurse: 'preset-3', cashier: 'preset-4', 'convenience-clerk': 'preset-2' },
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
    // Almost everything shuts on Sunday. The bathhouse, the Fainting ward, the
    // convenience store and the trams don't; the clinic and town office already do.
    hours: {
      cafe: hours(8, 18, ['sunday']),
      supermarket: hours(9, 21, ['sunday']),
      restaurant: hours(11, 22, ['monday', 'sunday']),
      bookshop: hours(10, 20, ['sunday']),
      landlord: hours(8, 20, ['sunday']),
    },
    ambient: ['tram-bell', 'church-bells', 'bicycle-bell', 'shop-door-chime'],
    goods: {
      latte: { name: 'Latte macchiato', glosses: { ja: 'ラテ・マキアート', zh: '拿铁玛奇朵', en: 'Latte macchiato' } },
      coffee: { name: 'Filterkaffee', glosses: { ja: 'ドリップコーヒー', zh: '滴滤咖啡', en: 'Filter coffee' } },
      tea: { name: 'Schwarztee', glosses: { ja: '紅茶', zh: '红茶', en: 'Black tea' } },
      pastry: { name: 'Butterbrezel', glosses: { ja: 'バタープレッツェル', zh: '黄油扭结饼', en: 'Butter pretzel' } },
      snack: { name: 'Bockwurst', glosses: { ja: 'ボックヴルスト（ソーセージ）', zh: '德式香肠', en: 'Bockwurst sausage' } },
      bento: { name: 'Fertiggericht', glosses: { ja: '温めて食べる調理済みの料理', zh: '速食餐', en: 'Ready meal' } },
      vegetables: { name: 'Kartoffeln', glosses: { ja: 'じゃがいも', zh: '土豆', en: 'Potatoes' } },
      eggs: { name: 'Eier', glosses: { ja: '卵', zh: '鸡蛋', en: 'Eggs' } },
      noodles: { name: 'Spätzle', glosses: { ja: 'シュペッツレ（卵の麺）', zh: '德式鸡蛋面', en: 'Spätzle (egg noodles)' } },
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
    supermarket: {
      name: 'Frischmarkt Krause',
      nameGlosses: { ja: 'クラウゼ生鮮マーケット', zh: '克劳泽生鲜超市', en: 'Krause Fresh Market' },
      facts: [
        'Bags are free here; the cashier asks whether the customer wants one.',
        'The points card is free; customers who have one show it at the till.',
        'Card and cash are both fine.',
      ],
    },
    convenienceStore: {
      name: 'Späti am Eck',
      nameGlosses: { ja: '角の深夜商店（シュペーティ）', zh: '街角深夜小店', en: 'Late shop on the corner' },
      facts: [
        'Ready meals are heated in the microwave behind the counter for free; the clerk asks whether to heat one.',
        'Bockwurst is kept hot in a pot by the till.',
        'Card and cash are both fine.',
      ],
    },
    hospital: {
      name: 'Klinikum am Park',
      nameGlosses: { ja: '公園前総合病院', zh: '公园医院', en: 'Park Hospital' },
    },
    personas: { barista: { name: 'Lena' }, nurse: { name: 'Petra' }, cashier: { name: 'Jonas' }, 'convenience-clerk': { name: 'Murat' } },
    appearances: {
      npcs: { barista: 'preset-4', nurse: 'preset-2', cashier: 'preset-3', 'convenience-clerk': 'preset-1' },
      customerWeights: { 'preset-1': 2, 'preset-2': 3, 'preset-3': 3, 'preset-4': 2 },
    },
    props: ['cake-stand', 'pretzel-basket'],
  },
};

/** The shop at a place in this pack, or null if the place isn't a shop. */
export function localShop(placeId: PlaceId, packId: LanguageCode): Shop | null {
  const pack = CULTURE_PACKS[packId];
  if (placeId === 'cafe') return pack.cafe;
  if (placeId === 'supermarket') return pack.supermarket;
  if (placeId === 'convenience-store') return pack.convenienceStore;
  return null;
}

/** A staffed place by its local name in this pack, as the Journal keeps it: a shop, or the hospital. */
export function localPlaceName(placeId: PlaceId, packId: LanguageCode): string {
  if (placeId === 'clinic') return CULTURE_PACKS[packId].hospital.name;
  const shop = localShop(placeId, packId);
  if (shop) return shop.name;
  throw new Error(`The ${placeId} has no local name in the ${packId} pack`);
}
