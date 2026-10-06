import { z } from 'zod';
import { CLOCK, LANGUAGE_CODES, WEEKDAYS, type LanguageCode, type OpeningHours, type PlaceId } from '../sim/index.ts';
import { APPEARANCE_PRESET_IDS, type AppearancePresetId } from './appearance.ts';
import { DIETARY_NOTE_IDS, DRINK_OPTIONS, ITEM_IDS, type DietaryNoteId, type DrinkOptionId, type ItemId } from './items.ts';
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
  /** The coins and notes in a till, smallest first: what a cashier gives change in. */
  denominations: number[];
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
  /** How a café drink can be made (size, hot or iced, extras), as the menu grid and Shift Customers say it. */
  drinkOptions: Record<DrinkOptionId, Good>;
  /** The dietary needs a server notes on the order pad, as the pad and diners say them. */
  dietaryNotes: Record<DietaryNoteId, Good>;
  signs: Record<SignWord, { text: string; glosses: Glosses }>;
  cafe: Shop;
  supermarket: Shop;
  convenienceStore: Shop;
  restaurant: Shop;
  /** The clinic and hospital, by its local name: where the Fainting ward is. */
  hospital: { name: string; nameGlosses: Glosses };
  /** The apartment block the Character lives in, by its local name: where the landlord is. */
  apartments: { name: string; nameGlosses: Glosses };
  /** The other places Named NPCs are found, by their local names. */
  townPlaces: Record<TownPlaceId, { name: string; nameGlosses: Glosses }>;
  /** Persona localisations: each Named NPC's local name, and their favourite gift as a local would give it (in English, as the prompt reads it). */
  personas: Record<NamedNpcId, { name: string; favouriteGift: string }>;
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
      denominations: z
        .array(z.number().positive())
        .min(1)
        .refine((money) => money.every((d, i) => i === 0 || d > money[i - 1]!), 'Denominations go up.'),
    }),
    customs: z.array(text),
    hours: z.partialRecord(z.enum(HOURS_IDS), openingHours),
    ambient: z.array(kebab),
    goods: z.partialRecord(z.enum(ITEM_IDS), z.object({ name: text, glosses })),
    drinkOptions: z.record(z.enum(DRINK_OPTIONS), z.object({ name: text, glosses })),
    dietaryNotes: z.record(z.enum(DIETARY_NOTE_IDS), z.object({ name: text, glosses })),
    signs: z.record(z.enum(SIGN_WORDS), z.object({ text, glosses })),
    cafe: shop,
    supermarket: shop,
    convenienceStore: shop,
    restaurant: shop,
    hospital: z.object({ name: text, nameGlosses: glosses }),
    apartments: z.object({ name: text, nameGlosses: glosses }),
    townPlaces: z.record(z.enum(TOWN_PLACE_IDS), z.object({ name: text, nameGlosses: glosses })),
    personas: z.record(z.string(), z.object({ name: text, favouriteGift: text })),
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
      denominations: [1, 5, 10, 50, 100, 500, 1000, 5000, 10000],
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
      batteries: { name: '単三電池', glosses: { zh: '五号电池', en: 'AA batteries', de: 'AA-Batterien' } },
      stamps: { name: '切手', glosses: { zh: '邮票', en: 'Stamps', de: 'Briefmarken' } },
      'gift-card': { name: 'ギフトカード', glosses: { zh: '礼品卡', en: 'Gift card', de: 'Geschenkkarte' } },
      'pork-dish': { name: 'ポークソテー', glosses: { zh: '香煎猪排', en: 'Pan-fried pork', de: 'Gebratenes Schweinesteak' } },
      'chicken-dish': { name: 'チキン南蛮', glosses: { zh: '南蛮炸鸡', en: 'Fried chicken with tartar sauce', de: 'Frittiertes Hähnchen mit Remoulade' } },
      'fish-dish': { name: '焼き鮭定食', glosses: { zh: '烤三文鱼套餐', en: 'Grilled salmon set meal', de: 'Menü mit gegrilltem Lachs' } },
      'veggie-dish': { name: '野菜のトマトパスタ', glosses: { zh: '蔬菜番茄意面', en: 'Vegetable tomato pasta', de: 'Gemüsepasta mit Tomatensoße' } },
      juice: { name: 'オレンジジュース', glosses: { zh: '橙汁', en: 'Orange juice', de: 'Orangensaft' } },
      cola: { name: 'コーラ', glosses: { zh: '可乐', en: 'Cola', de: 'Cola' } },
    },
    drinkOptions: {
      small: { name: 'Sサイズ', glosses: { zh: '小杯', en: 'Small', de: 'Klein' } },
      medium: { name: 'Mサイズ', glosses: { zh: '中杯', en: 'Medium', de: 'Mittel' } },
      large: { name: 'Lサイズ', glosses: { zh: '大杯', en: 'Large', de: 'Groß' } },
      hot: { name: 'ホット', glosses: { zh: '热的', en: 'Hot', de: 'Heiß' } },
      iced: { name: 'アイス', glosses: { zh: '冰的', en: 'Iced', de: 'Mit Eis' } },
      milk: { name: 'ミルク', glosses: { zh: '加奶', en: 'Milk', de: 'Milch' } },
      sugar: { name: '砂糖', glosses: { zh: '加糖', en: 'Sugar', de: 'Zucker' } },
      'extra-shot': { name: 'ショット追加', glosses: { zh: '加一份浓缩', en: 'Extra shot', de: 'Extra Shot' } },
      lemon: { name: 'レモン', glosses: { zh: '加柠檬', en: 'Lemon', de: 'Zitrone' } },
    },
    dietaryNotes: {
      vegetarian: { name: 'ベジタリアン', glosses: { zh: '吃素', en: 'Vegetarian', de: 'Vegetarisch' } },
      'no-pork': { name: '豚肉抜き', glosses: { zh: '不吃猪肉', en: 'No pork', de: 'Ohne Schweinefleisch' } },
      'no-seafood': { name: '魚介類抜き', glosses: { zh: '不吃海鲜', en: 'No fish or seafood', de: 'Ohne Fisch und Meeresfrüchte' } },
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
    restaurant: {
      name: 'レストランひまわり',
      nameGlosses: { zh: '向日葵餐厅', en: 'Sunflower Restaurant', de: 'Restaurant Sonnenblume' },
      facts: [
        'Water and a wet towel (oshibori) come free to every table.',
        'Set meals (teishoku) come with rice, miso soup and pickles. Miso soup is made with fish stock (dashi).',
        'Customers pay at the till by the door on the way out. Cash and card are both fine.',
      ],
    },
    hospital: {
      name: 'みどり総合病院',
      nameGlosses: { zh: '绿树综合医院', en: 'Midori General Hospital', de: 'Allgemeines Krankenhaus Midori' },
    },
    apartments: { name: 'さくら荘', nameGlosses: { zh: '樱花庄', en: 'Sakura House', de: 'Haus Sakura' } },
    townPlaces: {
      park: { name: '桜ヶ丘公園', nameGlosses: { zh: '樱丘公园', en: 'Sakuragaoka Park', de: 'Sakuragaoka-Park' } },
      bookshop: { name: 'ひだまり書店', nameGlosses: { zh: '向阳书店', en: 'Hidamari Books', de: 'Buchhandlung Hidamari' } },
      bathhouse: { name: '松の湯', nameGlosses: { zh: '松之汤', en: 'Matsu-no-yu Bathhouse', de: 'Badehaus Matsu-no-yu' } },
      'town-office': { name: '南町役場', nameGlosses: { zh: '南町政府', en: 'Minami Town Office', de: 'Gemeindeamt Minami' } },
    },
    personas: {
      landlord: { name: '山本', favouriteGift: 'a box of seasonal wagashi from the old sweet shop' },
      barista: { name: '佐藤', favouriteGift: 'a bag of single-origin coffee beans' },
      cashier: { name: '鈴木', favouriteGift: 'a pot of hand cream' },
      'convenience-clerk': { name: '田中', favouriteGift: 'a new manga volume' },
      server: { name: '中村', favouriteGift: 'a furoshiki cloth with a wave pattern' },
      receptionist: { name: '小林', favouriteGift: 'a pack of pretty washi tape' },
      doctor: { name: '伊藤', favouriteGift: 'a bottle of good sake' },
      nurse: { name: '高橋', favouriteGift: 'a tin of green tea' },
      pharmacist: { name: '渡辺', favouriteGift: 'a box of yuzu sweets' },
      'park-regular-1': { name: '加藤', favouriteGift: 'a bag of rice crackers' },
      'park-regular-2': { name: '吉田', favouriteGift: 'dog treats for the dog' },
      'park-regular-3': { name: '山田', favouriteGift: 'a set of colour pencils' },
      shopkeeper: { name: '松本', favouriteGift: 'a bookmark made of pressed flowers' },
      attendant: { name: '井上', favouriteGift: 'a bottle of coffee milk' },
      'office-clerk': { name: '木村', favouriteGift: 'a fancy fountain pen' },
    },
    appearances: {
      npcs: {
        landlord: 'preset-3',
        barista: 'preset-2',
        cashier: 'preset-1',
        'convenience-clerk': 'preset-3',
        server: 'preset-1',
        receptionist: 'preset-3',
        doctor: 'preset-4',
        nurse: 'preset-4',
        pharmacist: 'preset-2',
        'park-regular-1': 'preset-3',
        'park-regular-2': 'preset-4',
        'park-regular-3': 'preset-1',
        shopkeeper: 'preset-2',
        attendant: 'preset-3',
        'office-clerk': 'preset-4',
      },
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
      denominations: [0.1, 0.5, 1, 5, 10, 20, 50, 100],
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
      batteries: { name: '五号电池', glosses: { ja: '単三電池', en: 'AA batteries', de: 'AA-Batterien' } },
      stamps: { name: '邮票', glosses: { ja: '切手', en: 'Stamps', de: 'Briefmarken' } },
      'gift-card': { name: '购物卡', glosses: { ja: 'ギフトカード', en: 'Gift card', de: 'Geschenkkarte' } },
      'pork-dish': { name: '糖醋里脊', glosses: { ja: '豚ヒレ肉の甘酢炒め', en: 'Sweet and sour pork', de: 'Süßsaures Schweinefilet' } },
      'chicken-dish': { name: '宫保鸡丁', glosses: { ja: '鶏肉とピーナッツの辛味炒め', en: 'Kung pao chicken', de: 'Kung-Pao-Hähnchen' } },
      'fish-dish': { name: '清蒸鱼', glosses: { ja: '魚の姿蒸し', en: 'Steamed fish', de: 'Gedämpfter Fisch' } },
      'veggie-dish': { name: '地三鲜', glosses: { ja: 'じゃがいもとナスとピーマンの炒め物', en: 'Stir-fried potato, aubergine and pepper', de: 'Gebratene Kartoffeln, Auberginen und Paprika' } },
      juice: { name: '橙汁', glosses: { ja: 'オレンジジュース', en: 'Orange juice', de: 'Orangensaft' } },
      cola: { name: '可乐', glosses: { ja: 'コーラ', en: 'Cola', de: 'Cola' } },
    },
    drinkOptions: {
      small: { name: '小杯', glosses: { ja: 'Sサイズ', en: 'Small', de: 'Klein' } },
      medium: { name: '中杯', glosses: { ja: 'Mサイズ', en: 'Medium', de: 'Mittel' } },
      large: { name: '大杯', glosses: { ja: 'Lサイズ', en: 'Large', de: 'Groß' } },
      hot: { name: '热的', glosses: { ja: 'ホット', en: 'Hot', de: 'Heiß' } },
      iced: { name: '冰的', glosses: { ja: 'アイス', en: 'Iced', de: 'Mit Eis' } },
      milk: { name: '加奶', glosses: { ja: 'ミルク', en: 'Milk', de: 'Milch' } },
      sugar: { name: '加糖', glosses: { ja: '砂糖', en: 'Sugar', de: 'Zucker' } },
      'extra-shot': { name: '加一份浓缩', glosses: { ja: 'ショット追加', en: 'Extra shot', de: 'Extra Shot' } },
      lemon: { name: '加柠檬', glosses: { ja: 'レモン', en: 'Lemon', de: 'Zitrone' } },
    },
    dietaryNotes: {
      vegetarian: { name: '吃素', glosses: { ja: 'ベジタリアン', en: 'Vegetarian', de: 'Vegetarisch' } },
      'no-pork': { name: '不吃猪肉', glosses: { ja: '豚肉抜き', en: 'No pork', de: 'Ohne Schweinefleisch' } },
      'no-seafood': { name: '不吃海鲜', glosses: { ja: '魚介類抜き', en: 'No fish or seafood', de: 'Ohne Fisch und Meeresfrüchte' } },
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
    restaurant: {
      name: '老街饭馆',
      nameGlosses: { ja: '老街食堂', en: 'Old Street Restaurant', de: 'Restaurant Alte Straße' },
      facts: [
        'Hot tea comes free to every table.',
        'Rice is ordered separately, by the bowl.',
        'Most people pay by scanning a QR code with WeChat or Alipay; cash is fine too.',
      ],
    },
    hospital: {
      name: '绿城医院',
      nameGlosses: { ja: '緑城病院', en: 'Green City Hospital', de: 'Krankenhaus Grünstadt' },
    },
    apartments: { name: '幸福公寓', nameGlosses: { ja: '幸福アパート', en: 'Happiness Apartments', de: 'Wohnhaus Glück' } },
    townPlaces: {
      park: { name: '人民公园', nameGlosses: { ja: '人民公園', en: 'People’s Park', de: 'Volkspark' } },
      bookshop: { name: '书香书店', nameGlosses: { ja: '書香書店', en: 'Book Fragrance Bookshop', de: 'Buchhandlung Bücherduft' } },
      bathhouse: { name: '清泉浴池', nameGlosses: { ja: '清泉浴場', en: 'Clear Spring Bathhouse', de: 'Badehaus Klarquelle' } },
      'town-office': { name: '街道办事处', nameGlosses: { ja: '街道事務所', en: 'Neighbourhood Office', de: 'Bezirksamt' } },
    },
    personas: {
      landlord: { name: '刘阿姨', favouriteGift: 'a jar of good honey' },
      barista: { name: '小李', favouriteGift: 'a bag of Yunnan coffee beans' },
      cashier: { name: '张敏', favouriteGift: 'a pot of hand cream' },
      'convenience-clerk': { name: '小陈', favouriteGift: 'a phone charm of a cartoon cat' },
      server: { name: '小赵', favouriteGift: 'a box of egg tarts' },
      receptionist: { name: '杨洁', favouriteGift: 'a potted succulent for the desk' },
      doctor: { name: '黄医生', favouriteGift: 'a tin of Longjing tea' },
      nurse: { name: '王芳', favouriteGift: 'a box of dried longan' },
      pharmacist: { name: '周明', favouriteGift: 'a tin of chrysanthemum tea' },
      'park-regular-1': { name: '吴大爷', favouriteGift: 'a set of Chinese chess pieces' },
      'park-regular-2': { name: '徐丽', favouriteGift: 'dog treats for the dog' },
      'park-regular-3': { name: '小孙', favouriteGift: 'a sketchbook' },
      shopkeeper: { name: '马老师', favouriteGift: 'a calligraphy brush' },
      attendant: { name: '胡姐', favouriteGift: 'a bag of fresh fruit' },
      'office-clerk': { name: '郭先生', favouriteGift: 'a box of mooncakes' },
    },
    appearances: {
      npcs: {
        landlord: 'preset-4',
        barista: 'preset-3',
        cashier: 'preset-2',
        'convenience-clerk': 'preset-4',
        server: 'preset-1',
        receptionist: 'preset-4',
        doctor: 'preset-1',
        nurse: 'preset-1',
        pharmacist: 'preset-3',
        'park-regular-1': 'preset-4',
        'park-regular-2': 'preset-1',
        'park-regular-3': 'preset-2',
        shopkeeper: 'preset-3',
        attendant: 'preset-4',
        'office-clerk': 'preset-1',
      },
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
      denominations: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50],
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
      batteries: { name: 'AA batteries', glosses: { ja: '単三電池', zh: '五号电池', de: 'AA-Batterien' } },
      stamps: { name: 'Stamps', glosses: { ja: '切手', zh: '邮票', de: 'Briefmarken' } },
      'gift-card': { name: 'Gift card', glosses: { ja: 'ギフトカード', zh: '礼品卡', de: 'Geschenkkarte' } },
      'pork-dish': { name: 'Sausage and mash', glosses: { ja: 'ソーセージとマッシュポテト', zh: '香肠配土豆泥', de: 'Würstchen mit Kartoffelbrei' } },
      'chicken-dish': { name: 'Chicken pie', glosses: { ja: 'チキンパイ', zh: '鸡肉派', de: 'Hähnchenpastete' } },
      'fish-dish': { name: 'Fish and chips', glosses: { ja: 'フィッシュ・アンド・チップス', zh: '炸鱼薯条', de: 'Fisch mit Pommes' } },
      'veggie-dish': { name: 'Veggie burger', glosses: { ja: 'ベジバーガー', zh: '素食汉堡', de: 'Veggie-Burger' } },
      juice: { name: 'Orange juice', glosses: { ja: 'オレンジジュース', zh: '橙汁', de: 'Orangensaft' } },
      cola: { name: 'Cola', glosses: { ja: 'コーラ', zh: '可乐', de: 'Cola' } },
    },
    drinkOptions: {
      small: { name: 'Small', glosses: { ja: 'スモール', zh: '小杯', de: 'Klein' } },
      medium: { name: 'Regular', glosses: { ja: 'レギュラー', zh: '中杯', de: 'Mittel' } },
      large: { name: 'Large', glosses: { ja: 'ラージ', zh: '大杯', de: 'Groß' } },
      hot: { name: 'Hot', glosses: { ja: 'ホット', zh: '热的', de: 'Heiß' } },
      iced: { name: 'Iced', glosses: { ja: 'アイス', zh: '冰的', de: 'Mit Eis' } },
      milk: { name: 'Milk', glosses: { ja: 'ミルク', zh: '加奶', de: 'Milch' } },
      sugar: { name: 'Sugar', glosses: { ja: '砂糖', zh: '加糖', de: 'Zucker' } },
      'extra-shot': { name: 'Extra shot', glosses: { ja: 'ショット追加', zh: '加一份浓缩', de: 'Extra Shot' } },
      lemon: { name: 'Lemon', glosses: { ja: 'レモン', zh: '加柠檬', de: 'Zitrone' } },
    },
    dietaryNotes: {
      vegetarian: { name: 'Vegetarian', glosses: { ja: 'ベジタリアン', zh: '吃素', de: 'Vegetarisch' } },
      'no-pork': { name: 'No pork', glosses: { ja: '豚肉抜き', zh: '不吃猪肉', de: 'Ohne Schweinefleisch' } },
      'no-seafood': { name: 'No fish or seafood', glosses: { ja: '魚介類抜き', zh: '不吃海鲜', de: 'Ohne Fisch und Meeresfrüchte' } },
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
    restaurant: {
      name: 'Rosie’s Kitchen',
      nameGlosses: { ja: 'ロージーズ・キッチン', zh: '罗茜厨房', de: 'Rosies Küche' },
      facts: [
        'This is a sit-down restaurant with table service: the server takes the order at the table.',
        'Tap water is free; customers only have to ask.',
        'Tipping about 10% is usual for table service. Card and contactless are fine.',
      ],
    },
    hospital: {
      name: 'St Mary’s Hospital',
      nameGlosses: { ja: 'セント・メアリー病院', zh: '圣玛丽医院', de: 'St.-Marien-Krankenhaus' },
    },
    apartments: { name: 'Rosewood House', nameGlosses: { ja: 'ローズウッド・ハウス', zh: '玫瑰木公寓', de: 'Rosewood House' } },
    townPlaces: {
      park: { name: 'Victoria Park', nameGlosses: { ja: 'ヴィクトリア公園', zh: '维多利亚公园', de: 'Victoria Park' } },
      bookshop: { name: 'The Book Nook', nameGlosses: { ja: 'ブック・ヌック', zh: '书角书店', de: 'Bücherecke' } },
      bathhouse: { name: 'Riverside Baths', nameGlosses: { ja: 'リバーサイド浴場', zh: '河畔浴场', de: 'Flussbad' } },
      'town-office': { name: 'Town Hall', nameGlosses: { ja: 'タウンホール', zh: '市政厅', de: 'Rathaus' } },
    },
    personas: {
      landlord: { name: 'Mrs Hughes', favouriteGift: 'a packet of seeds for the hallway plants' },
      barista: { name: 'Jess', favouriteGift: 'a bag of single-origin coffee beans' },
      cashier: { name: 'Priya', favouriteGift: 'a box of shortbread' },
      'convenience-clerk': { name: 'Dev', favouriteGift: 'a bar of fancy chocolate' },
      server: { name: 'Tom', favouriteGift: 'a jar of homemade chutney' },
      receptionist: { name: 'Karen', favouriteGift: 'a novelty mug' },
      doctor: { name: 'Dr Okafor', favouriteGift: 'a book of crosswords' },
      nurse: { name: 'Bridget', favouriteGift: 'a box of good tea bags' },
      pharmacist: { name: 'Mr Shah', favouriteGift: 'a tin of travel sweets' },
      'park-regular-1': { name: 'Arthur', favouriteGift: 'a bag of birdseed' },
      'park-regular-2': { name: 'Ellie', favouriteGift: 'dog treats for the dog' },
      'park-regular-3': { name: 'Callum', favouriteGift: 'a set of drawing pencils' },
      shopkeeper: { name: 'Mr Price', favouriteGift: 'a fountain pen' },
      attendant: { name: 'Maureen', favouriteGift: 'a bar of handmade soap' },
      'office-clerk': { name: 'Gareth', favouriteGift: 'a packet of chocolate digestives' },
    },
    appearances: {
      npcs: {
        landlord: 'preset-2',
        barista: 'preset-1',
        cashier: 'preset-4',
        'convenience-clerk': 'preset-2',
        server: 'preset-3',
        receptionist: 'preset-1',
        doctor: 'preset-2',
        nurse: 'preset-3',
        pharmacist: 'preset-4',
        'park-regular-1': 'preset-1',
        'park-regular-2': 'preset-2',
        'park-regular-3': 'preset-3',
        shopkeeper: 'preset-4',
        attendant: 'preset-1',
        'office-clerk': 'preset-2',
      },
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
      denominations: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50],
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
      batteries: { name: 'AA-Batterien', glosses: { ja: '単三電池', zh: '五号电池', en: 'AA batteries' } },
      stamps: { name: 'Briefmarken', glosses: { ja: '切手', zh: '邮票', en: 'Stamps' } },
      'gift-card': { name: 'Geschenkkarte', glosses: { ja: 'ギフトカード', zh: '礼品卡', en: 'Gift card' } },
      'pork-dish': { name: 'Schweineschnitzel', glosses: { ja: 'ポークシュニッツェル', zh: '炸猪排', en: 'Pork schnitzel' } },
      'chicken-dish': { name: 'Hähnchengeschnetzeltes', glosses: { ja: '鶏肉のクリーム煮', zh: '奶油鸡肉丝', en: 'Sliced chicken in cream sauce' } },
      'fish-dish': { name: 'Lachsfilet', glosses: { ja: 'サーモンのフィレ', zh: '三文鱼排', en: 'Salmon fillet' } },
      'veggie-dish': { name: 'Käsespätzle', glosses: { ja: 'チーズシュペッツレ', zh: '奶酪面疙瘩', en: 'Cheese spätzle' } },
      juice: { name: 'Orangensaft', glosses: { ja: 'オレンジジュース', zh: '橙汁', en: 'Orange juice' } },
      cola: { name: 'Cola', glosses: { ja: 'コーラ', zh: '可乐', en: 'Cola' } },
    },
    drinkOptions: {
      small: { name: 'Klein', glosses: { ja: 'スモール', zh: '小杯', en: 'Small' } },
      medium: { name: 'Mittel', glosses: { ja: 'ミディアム', zh: '中杯', en: 'Medium' } },
      large: { name: 'Groß', glosses: { ja: 'ラージ', zh: '大杯', en: 'Large' } },
      hot: { name: 'Heiß', glosses: { ja: 'ホット', zh: '热的', en: 'Hot' } },
      iced: { name: 'Mit Eis', glosses: { ja: 'アイス', zh: '冰的', en: 'Iced' } },
      milk: { name: 'Milch', glosses: { ja: 'ミルク', zh: '加奶', en: 'Milk' } },
      sugar: { name: 'Zucker', glosses: { ja: '砂糖', zh: '加糖', en: 'Sugar' } },
      'extra-shot': { name: 'Extra Shot', glosses: { ja: 'ショット追加', zh: '加一份浓缩', en: 'Extra shot' } },
      lemon: { name: 'Zitrone', glosses: { ja: 'レモン', zh: '加柠檬', en: 'Lemon' } },
    },
    dietaryNotes: {
      vegetarian: { name: 'Vegetarisch', glosses: { ja: 'ベジタリアン', zh: '吃素', en: 'Vegetarian' } },
      'no-pork': { name: 'Ohne Schweinefleisch', glosses: { ja: '豚肉抜き', zh: '不吃猪肉', en: 'No pork' } },
      'no-seafood': { name: 'Ohne Fisch und Meeresfrüchte', glosses: { ja: '魚介類抜き', zh: '不吃海鲜', en: 'No fish or seafood' } },
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
    restaurant: {
      name: 'Gasthaus zur Linde',
      nameGlosses: { ja: 'ガストハウス・ツア・リンデ', zh: '椴树餐馆', en: 'The Linden Tree Inn' },
      facts: [
        'Tap water is not usually served; drinks are ordered with the meal.',
        'Customers usually round the bill up a little as a tip.',
        'Cash is preferred, but card is fine.',
      ],
    },
    hospital: {
      name: 'Klinikum am Park',
      nameGlosses: { ja: '公園前総合病院', zh: '公园医院', en: 'Park Hospital' },
    },
    apartments: { name: 'Haus Lindenhof', nameGlosses: { ja: 'リンデンホーフ荘', zh: '椴树庭公寓', en: 'Lindenhof House' } },
    townPlaces: {
      park: { name: 'Stadtpark', nameGlosses: { ja: '市立公園', zh: '城市公园', en: 'City Park' } },
      bookshop: { name: 'Buchhandlung Seitenweise', nameGlosses: { ja: 'ザイテンヴァイゼ書店', zh: '页页书店', en: 'Seitenweise Bookshop' } },
      bathhouse: { name: 'Stadtbad', nameGlosses: { ja: '市営浴場', zh: '市立浴场', en: 'Town Baths' } },
      'town-office': { name: 'Bürgeramt', nameGlosses: { ja: '市民課', zh: '市民服务中心', en: 'Citizens’ Office' } },
    },
    personas: {
      landlord: { name: 'Frau Becker', favouriteGift: 'a potted geranium for the window box' },
      barista: { name: 'Lena', favouriteGift: 'a bag of single-origin coffee beans' },
      cashier: { name: 'Jonas', favouriteGift: 'a bag of Haribo' },
      'convenience-clerk': { name: 'Murat', favouriteGift: 'a ticket to a football match' },
      server: { name: 'Sabine', favouriteGift: 'a box of Lebkuchen' },
      receptionist: { name: 'Frau Wagner', favouriteGift: 'a pretty notebook' },
      doctor: { name: 'Dr. Schulz', favouriteGift: 'a bottle of Riesling' },
      nurse: { name: 'Petra', favouriteGift: 'a tin of herbal tea' },
      pharmacist: { name: 'Herr Hoffmann', favouriteGift: 'a jar of local honey' },
      'park-regular-1': { name: 'Herr Krüger', favouriteGift: 'a bag of birdseed' },
      'park-regular-2': { name: 'Anja', favouriteGift: 'dog treats for the dog' },
      'park-regular-3': { name: 'Felix', favouriteGift: 'a set of drawing pencils' },
      shopkeeper: { name: 'Herr Lange', favouriteGift: 'a leather bookmark' },
      attendant: { name: 'Frau Schmitt', favouriteGift: 'a bottle of bath oil' },
      'office-clerk': { name: 'Herr Neumann', favouriteGift: 'a new rubber stamp' },
    },
    appearances: {
      npcs: {
        landlord: 'preset-1',
        barista: 'preset-4',
        cashier: 'preset-3',
        'convenience-clerk': 'preset-1',
        server: 'preset-2',
        receptionist: 'preset-2',
        doctor: 'preset-3',
        nurse: 'preset-2',
        pharmacist: 'preset-1',
        'park-regular-1': 'preset-2',
        'park-regular-2': 'preset-3',
        'park-regular-3': 'preset-4',
        shopkeeper: 'preset-1',
        attendant: 'preset-2',
        'office-clerk': 'preset-3',
      },
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
  if (placeId === 'restaurant') return pack.restaurant;
  return null;
}

/** The places Named NPCs are found that are neither a shop, the hospital nor the apartment block. */
export const TOWN_PLACE_IDS = ['park', 'bookshop', 'bathhouse', 'town-office'] as const satisfies readonly PlaceId[];
export type TownPlaceId = (typeof TOWN_PLACE_IDS)[number];
const isTownPlace = (placeId: PlaceId): placeId is TownPlaceId => (TOWN_PLACE_IDS as readonly PlaceId[]).includes(placeId);

/** A staffed place by its local name in this pack, as the Journal keeps it: a shop, the hospital, the apartment block, or another place Named NPCs are found. */
export function localPlaceName(placeId: PlaceId, packId: LanguageCode): string {
  if (placeId === 'clinic') return CULTURE_PACKS[packId].hospital.name;
  if (placeId === 'home') return CULTURE_PACKS[packId].apartments.name;
  if (isTownPlace(placeId)) return CULTURE_PACKS[packId].townPlaces[placeId].name;
  const shop = localShop(placeId, packId);
  if (shop) return shop.name;
  throw new Error(`The ${placeId} has no local name in the ${packId} pack`);
}
