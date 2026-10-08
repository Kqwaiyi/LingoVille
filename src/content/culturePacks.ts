import { z } from 'zod';
import { CLOCK, LANGUAGE_CODES, lookFromSeed, PLACE_IDS, WEEKDAYS, type LanguageCode, type LookWeights, type OpeningHours, type PlaceId } from '../sim/index.ts';
import { AppearancePresetSchema, BODY_IDS, BODY_PRESETS, CustomerWeightsSchema, type AppearancePreset, type CustomerWeights } from './appearance.ts';
import {
  ALLERGENS,
  DIETARY_NOTE_IDS,
  DRINK_OPTIONS,
  EXTRA_ALLERGENS,
  GROCERIES_SOLD,
  ITEM_IDS,
  type Allergen,
  type DietaryNoteId,
  type DrinkExtra,
  type DrinkOptionId,
  type GroceryId,
  type ItemId,
} from './items.ts';
import type { NamedNpcId } from './npcs.ts';
import { hours, HOURS_IDS, type HoursId } from './places.ts';
import { isPasserBy, PASSER_BY_IDS, PASSER_BY_STOPS, TOWN_NPCS, TRAM_LINE, type PasserById, type TownNpcId, type TramStopId } from './townNpcs.ts';

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

/**
 * The props the world knows how to draw, from the pack art: money at the till, what hangs at a door, food and goods on
 * show, and small local touches. Each pack picks the ones it sets out at each place; façades, roofs and layout stay shared.
 */
export const PROP_IDS = [
  // Money at the till, as each pack pays.
  'cash-tray',
  'qr-stand',
  'card-reader',
  'coin-dish',
  // At a door.
  'noren',
  'red-lantern',
  'bunting',
  'flower-box',
  // On a counter.
  'lucky-cat',
  'tea-set',
  'cake-stand',
  'bread-basket',
  'onigiri',
  'tea-eggs',
  'sausage-rolls',
  'bockwurst',
  'medicine-boxes',
  'book-stack',
  'paperwork',
  'towel-stack',
  'nabe',
  'steamer',
  'fry-up',
  'sausage-pan',
  // On a table.
  'teishoku',
  'dim-sum',
  'fish-and-chips',
  'sauerkraut',
  // On a floor.
  'mikan-crate',
  'rice-sacks',
  'flower-buckets',
  'drinks-crates',
  'bonsai',
  'water-dispenser',
  'magazine-table',
  'coat-stand',
  'wash-buckets',
  'foot-basins',
  'sauna-bucket',
  'andon',
  'lucky-bamboo',
  'radio',
  'teddy',
  // On the park's lawn.
  'hanami-mat',
  'stone-lantern',
  'xiangqi-table',
  'picnic-blanket',
  'beer-bench',
  // On a tram platform.
  'vending-machine',
  'sorting-bins',
  'post-box',
  'litfass-column',
  // Groceries on the supermarket's shelves.
  'cabbages',
  'bok-choy',
  'carrots',
  'potatoes',
  'eggs',
  'udon',
  'dried-noodles',
  'spaghetti',
  'spaetzle',
] as const;
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
  /** What a café customer can be allergic to, as customers and the barista say it. */
  allergens: Record<Allergen, Good>;
  /** Which allergens each of this pack's café items has in it (none: an empty list), by what the local item is made with. */
  cafeAllergens: Partial<Record<ItemId, readonly Allergen[]>>;
  signs: Record<SignWord, { text: string; glosses: Glosses }>;
  cafe: Shop;
  supermarket: Shop;
  convenienceStore: Shop;
  restaurant: Shop;
  /** The clinic and hospital, by its local name: where the Fainting ward is. */
  hospital: { name: string; nameGlosses: Glosses };
  /** The apartment block the Character lives in, by its local name: where the landlord is. */
  apartments: { name: string; nameGlosses: Glosses };
  /** The tram stops by their local names, as the stop signs and passers-by say them. */
  tramStops: Record<TramStopId, { name: string; nameGlosses: Glosses }>;
  /** The other places Named NPCs are found, by their local names, and any facts their staff know (in English). */
  townPlaces: Record<TownPlaceId, { name: string; nameGlosses: Glosses; facts?: string[] }>;
  /** Persona localisations: each Named NPC's local name, and their favourite gift (the persona's `favouriteGift`) as a local would put it (in English, as the prompt reads it). */
  personas: Record<NamedNpcId, { name: string; favouriteGift: string }>;
  /**
   * The casual register a friend offers to switch to, once: `formal` and `casual` as the Target Language names them
   * (for the Recap), `offer` what the NPC offers and `inUse` how they speak once they have (in English, as the prompt reads them).
   */
  casualRegister: { formal: string; casual: string; offer: string; inUse: string };
  appearances: {
    /** Persona × pack → Appearance Preset: each Named NPC's local look, on the build they have in every pack. */
    npcs: Record<NamedNpcId, AppearancePreset>;
    /** How often each part of a look turns up among Shift Customers and passers-by. */
    customers: CustomerWeights;
  };
  /** Each place's set dressing: the props the world sets out there, each in a spot of its kind. */
  props: Record<PlaceId, PropId[]>;
  /** How each grocery looks on the supermarket's shelf. */
  shelves: Record<GroceryId, PropId>;
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
    allergens: z.record(z.enum(ALLERGENS), z.object({ name: text, glosses })),
    cafeAllergens: z.partialRecord(z.enum(ITEM_IDS), z.array(z.enum(ALLERGENS)).readonly()),
    signs: z.record(z.enum(SIGN_WORDS), z.object({ text, glosses })),
    cafe: shop,
    supermarket: shop,
    convenienceStore: shop,
    restaurant: shop,
    hospital: z.object({ name: text, nameGlosses: glosses }),
    apartments: z.object({ name: text, nameGlosses: glosses }),
    tramStops: z.record(z.enum(TRAM_LINE), z.object({ name: text, nameGlosses: glosses })),
    townPlaces: z.record(z.enum(TOWN_PLACE_IDS), z.object({ name: text, nameGlosses: glosses, facts: z.array(text).optional() })),
    personas: z.record(z.string(), z.object({ name: text, favouriteGift: text })),
    casualRegister: z.object({ formal: text, casual: text, offer: text, inUse: text }),
    appearances: z.object({
      npcs: z.record(z.string(), AppearancePresetSchema),
      customers: CustomerWeightsSchema,
    }),
    props: z.record(z.enum(PLACE_IDS), z.array(z.enum(PROP_IDS)).min(1)),
    shelves: z.record(z.enum(GROCERIES_SOLD), z.enum(PROP_IDS)),
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
      cake: { name: 'いちごのショートケーキ', glosses: { zh: '草莓奶油蛋糕', en: 'Strawberry shortcake', de: 'Erdbeer-Sahnetorte' } },
      'special-drink': { name: 'クリームソーダ', glosses: { zh: '冰淇淋苏打', en: 'Cream soda float', de: 'Limonade mit Eiskugel' } },
      'mystery-novel': { name: 'ミステリー小説', glosses: { zh: '推理小说', en: 'Mystery novel', de: 'Kriminalroman' } },
      cookbook: { name: '家庭料理の本', glosses: { zh: '家常菜谱', en: 'Home cooking cookbook', de: 'Kochbuch für Hausmannskost' } },
      'travel-book': { name: '散歩ガイド', glosses: { zh: '散步指南', en: 'Walking guide', de: 'Wanderführer' } },
      magazine: { name: '雑誌', glosses: { zh: '杂志', en: 'Magazine', de: 'Zeitschrift' } },
      flowers: { name: '花束', glosses: { zh: '花束', en: 'Bouquet of flowers', de: 'Blumenstrauß' } },
      chocolates: { name: 'チョコレートの詰め合わせ', glosses: { zh: '巧克力礼盒', en: 'Box of chocolates', de: 'Pralinenschachtel' } },
      'scented-candle': { name: 'アロマキャンドル', glosses: { zh: '香薰蜡烛', en: 'Scented candle', de: 'Duftkerze' } },
      'bath-entry': { name: '入浴券', glosses: { zh: '洗浴票', en: 'Bath entry ticket', de: 'Eintrittskarte fürs Bad' } },
      'gym-membership': { name: 'ジムの会員', glosses: { zh: '健身房会员', en: 'Gym membership', de: 'Mitgliedschaft im Fitnessstudio' } },
      'cold-medicine': { name: '風邪薬', glosses: { zh: '感冒药', en: 'Cold medicine', de: 'Erkältungsmittel' } },
      'fever-reducer': { name: '解熱剤', glosses: { zh: '退烧药', en: 'Fever reducer', de: 'Fiebersenkendes Mittel' } },
      'stomach-medicine': { name: '胃腸薬', glosses: { zh: '肠胃药', en: 'Stomach medicine', de: 'Magen-Darm-Mittel' } },
      antihistamine: { name: '花粉症の薬', glosses: { zh: '过敏药', en: 'Hay fever tablets', de: 'Heuschnupfentabletten' } },
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
    allergens: {
      milk: { name: '乳', glosses: { zh: '牛奶', en: 'Milk', de: 'Milch' } },
      egg: { name: '卵', glosses: { zh: '鸡蛋', en: 'Egg', de: 'Ei' } },
      wheat: { name: '小麦', glosses: { zh: '小麦', en: 'Wheat', de: 'Weizen' } },
    },
    // Melon bread and shortcake are made with flour, egg and butter or cream; a cream soda float has ice cream on top.
    cafeAllergens: { latte: ['milk'], coffee: [], tea: [], pastry: ['wheat', 'egg', 'milk'], cake: ['wheat', 'egg', 'milk'], 'special-drink': ['milk'] },
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
    tramStops: {
      'west-stop': { name: '旧市街', nameGlosses: { zh: '老城', en: 'Old Town', de: 'Altstadt' } },
      'central-stop': { name: '中央', nameGlosses: { zh: '市中心', en: 'Town Centre', de: 'Stadtmitte' } },
      'east-stop': { name: '市場通り', nameGlosses: { zh: '市场街', en: 'Market Street', de: 'Marktstraße' } },
    },
    townPlaces: {
      park: { name: '桜ヶ丘公園', nameGlosses: { zh: '樱丘公园', en: 'Sakuragaoka Park', de: 'Sakuragaoka-Park' } },
      bookshop: { name: 'ひだまり書店', nameGlosses: { zh: '向阳书店', en: 'Hidamari Books', de: 'Buchhandlung Hidamari' } },
      bathhouse: {
        name: '松の湯',
        nameGlosses: { zh: '松之汤', en: 'Matsu-no-yu Bathhouse', de: 'Badehaus Matsu-no-yu' },
        facts: [
          'Shoes go in the wooden shoe lockers at the entrance.',
          'Wash and rinse at the taps before getting into the bath, and keep towels out of the bathwater.',
          'The gym is a corner just inside the entrance with a running machine. Members wipe it down after use.',
          'After the bath, many people buy a bottle of cold milk from the fridge by the desk.',
        ],
      },
      'town-office': {
        name: '南町役場',
        nameGlosses: { zh: '南町政府', en: 'Minami Town Office', de: 'Gemeindeamt Minami' },
        facts: [
          'Anyone who moves to town registers their new address here (a moving-in notification, 転入届) within 14 days.',
          'The post office counter is in the same hall, at the far end.',
          'Customers take a numbered ticket from the machine by the door and wait to be called.',
        ],
      },
    },
    casualRegister: {
      formal: '敬語',
      casual: 'タメ口',
      offer: 'suggest that the two of you drop the polite です/ます forms (keigo) and talk in タメ口, the plain casual forms friends use',
      inUse: 'You talk to each other in タメ口 now: use the plain casual forms friends use, not です/ます.',
    },
    personas: {
      landlord: { name: '山本', favouriteGift: 'flowers for the hallway, seasonal ones like cosmos or chrysanthemums' },
      barista: { name: '佐藤', favouriteGift: 'chocolates, especially ones flavoured with matcha' },
      cashier: { name: '鈴木', favouriteGift: 'a scented candle with a calm hinoki cypress scent' },
      'convenience-clerk': { name: '田中', favouriteGift: 'chocolates, the more unusual the limited-edition flavour the better' },
      server: { name: '中村', favouriteGift: 'flowers, a small bunch to brighten the restaurant counter' },
      receptionist: { name: '小林', favouriteGift: 'flowers for the reception desk, something cheerful' },
      doctor: { name: '伊藤', favouriteGift: 'a scented candle to unwind with after a long day at the clinic' },
      nurse: { name: '高橋', favouriteGift: 'a scented candle, ideally with a yuzu scent' },
      pharmacist: { name: '渡辺', favouriteGift: 'chocolates, in a neat little box from a good shop' },
      'park-regular-1': { name: '加藤', favouriteGift: 'flowers that remind them of the garden they used to keep' },
      'park-regular-2': { name: '吉田', favouriteGift: 'chocolates to share at home (not with the dog!)' },
      'park-regular-3': { name: '山田', favouriteGift: 'flowers, to sketch before they wilt' },
      shopkeeper: { name: '松本', favouriteGift: 'a scented candle to read by in the evenings' },
      attendant: { name: '井上', favouriteGift: 'a scented candle that smells like a forest bath' },
      'office-clerk': { name: '木村', favouriteGift: 'chocolates to keep in the desk drawer for long afternoons' },
    },
    appearances: {
      npcs: {
        landlord: { body: 'body-3', hairStyle: 'buns', hairColour: 'grey', skinTone: 'tone-2' },
        barista: { body: 'body-2', hairStyle: 'short', hairColour: 'dark-brown', skinTone: 'tone-2' },
        cashier: { body: 'body-1', hairStyle: 'buzzed', hairColour: 'black', skinTone: 'tone-3' },
        'convenience-clerk': { body: 'body-3', hairStyle: 'long', hairColour: 'brown', skinTone: 'tone-1' },
        server: { body: 'body-1', hairStyle: 'short', hairColour: 'black', skinTone: 'tone-2' },
        receptionist: { body: 'body-3', hairStyle: 'buns', hairColour: 'black', skinTone: 'tone-2' },
        doctor: { body: 'body-4', hairStyle: 'short', hairColour: 'grey', skinTone: 'tone-2' },
        nurse: { body: 'body-4', hairStyle: 'buns', hairColour: 'dark-brown', skinTone: 'tone-3' },
        pharmacist: { body: 'body-2', hairStyle: 'short', hairColour: 'black', skinTone: 'tone-2' },
        'park-regular-1': { body: 'body-3', hairStyle: 'short', hairColour: 'grey', skinTone: 'tone-3' },
        'park-regular-2': { body: 'body-4', hairStyle: 'long', hairColour: 'black', skinTone: 'tone-1' },
        'park-regular-3': { body: 'body-1', hairStyle: 'buzzed', hairColour: 'brown', skinTone: 'tone-2' },
        shopkeeper: { body: 'body-2', hairStyle: 'bald', hairColour: 'grey', skinTone: 'tone-3' },
        attendant: { body: 'body-3', hairStyle: 'buns', hairColour: 'black', skinTone: 'tone-3' },
        'office-clerk': { body: 'body-4', hairStyle: 'short', hairColour: 'black', skinTone: 'tone-2' },
      },
      customers: {
        body: { 'body-1': 3, 'body-2': 3, 'body-3': 2, 'body-4': 2 },
        hairStyle: {
          masculine: { short: 4, buzzed: 2, long: 1, bearded: 1, bald: 1 },
          feminine: { long: 4, short: 3, buns: 3 },
        },
        hairColour: { black: 5, 'dark-brown': 4, brown: 1, grey: 2 },
        skinTone: { 'tone-1': 3, 'tone-2': 4, 'tone-3': 2 },
      },
    },
    props: {
      home: ['nabe', 'andon'],
      cafe: ['noren', 'lucky-cat', 'cash-tray'],
      supermarket: ['cash-tray', 'mikan-crate'],
      'convenience-store': ['onigiri', 'cash-tray'],
      restaurant: ['noren', 'teishoku', 'teishoku', 'teishoku'],
      clinic: ['cash-tray', 'medicine-boxes', 'bonsai'],
      park: ['hanami-mat', 'stone-lantern'],
      'tram-stop': ['vending-machine', 'vending-machine', 'vending-machine'],
      bookshop: ['cash-tray', 'book-stack'],
      bathhouse: ['noren', 'cash-tray', 'wash-buckets'],
      'town-office': ['cash-tray', 'paperwork'],
    },
    shelves: { vegetables: 'cabbages', eggs: 'eggs', noodles: 'udon' },
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
      cake: { name: '提拉米苏', glosses: { ja: 'ティラミス', en: 'Tiramisu', de: 'Tiramisu' } },
      'special-drink': { name: '芒果冰沙', glosses: { ja: 'マンゴースムージー', en: 'Mango smoothie', de: 'Mango-Smoothie' } },
      'mystery-novel': { name: '推理小说', glosses: { ja: 'ミステリー小説', en: 'Mystery novel', de: 'Kriminalroman' } },
      cookbook: { name: '家常菜谱', glosses: { ja: '家庭料理のレシピ本', en: 'Home cooking cookbook', de: 'Kochbuch für Hausmannskost' } },
      'travel-book': { name: '旅游指南', glosses: { ja: '旅行ガイド', en: 'Travel guide', de: 'Reiseführer' } },
      magazine: { name: '杂志', glosses: { ja: '雑誌', en: 'Magazine', de: 'Zeitschrift' } },
      flowers: { name: '鲜花', glosses: { ja: '生花', en: 'Fresh flowers', de: 'Frische Blumen' } },
      chocolates: { name: '巧克力礼盒', glosses: { ja: 'チョコレートのギフトボックス', en: 'Gift box of chocolates', de: 'Pralinen-Geschenkbox' } },
      'scented-candle': { name: '香薰蜡烛', glosses: { ja: 'アロマキャンドル', en: 'Scented candle', de: 'Duftkerze' } },
      'bath-entry': { name: '洗浴票', glosses: { ja: '入浴券', en: 'Bath entry ticket', de: 'Eintrittskarte fürs Bad' } },
      'gym-membership': { name: '健身卡', glosses: { ja: 'ジムの会員証', en: 'Gym pass', de: 'Karte fürs Fitnessstudio' } },
      'cold-medicine': { name: '感冒药', glosses: { ja: '風邪薬', en: 'Cold medicine', de: 'Erkältungsmittel' } },
      'fever-reducer': { name: '退烧药', glosses: { ja: '解熱剤', en: 'Fever reducer', de: 'Fiebersenkendes Mittel' } },
      'stomach-medicine': { name: '肠胃药', glosses: { ja: '胃腸薬', en: 'Stomach medicine', de: 'Magen-Darm-Mittel' } },
      antihistamine: { name: '抗过敏药', glosses: { ja: 'アレルギーの薬', en: 'Antihistamine', de: 'Antihistaminikum' } },
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
    allergens: {
      milk: { name: '牛奶', glosses: { ja: '乳', en: 'Milk', de: 'Milch' } },
      egg: { name: '鸡蛋', glosses: { ja: '卵', en: 'Egg', de: 'Ei' } },
      wheat: { name: '小麦', glosses: { ja: '小麦', en: 'Wheat', de: 'Weizen' } },
    },
    // An egg tart has a buttery pastry case; tiramisu has sponge fingers, egg and mascarpone. The mango smoothie is fruit and ice.
    cafeAllergens: { latte: ['milk'], coffee: [], tea: [], pastry: ['wheat', 'egg', 'milk'], cake: ['wheat', 'egg', 'milk'], 'special-drink': [] },
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
    tramStops: {
      'west-stop': { name: '老城', nameGlosses: { ja: '旧市街', en: 'Old Town', de: 'Altstadt' } },
      'central-stop': { name: '市中心', nameGlosses: { ja: '中央', en: 'Town Centre', de: 'Stadtmitte' } },
      'east-stop': { name: '市场街', nameGlosses: { ja: '市場通り', en: 'Market Street', de: 'Marktstraße' } },
    },
    townPlaces: {
      park: { name: '人民公园', nameGlosses: { ja: '人民公園', en: 'People’s Park', de: 'Volkspark' } },
      bookshop: { name: '书香书店', nameGlosses: { ja: '書香書店', en: 'Book Fragrance Bookshop', de: 'Buchhandlung Bücherduft' } },
      bathhouse: {
        name: '清泉浴池',
        nameGlosses: { ja: '清泉浴場', en: 'Clear Spring Bathhouse', de: 'Badehaus Klarquelle' },
        facts: [
          'The desk hands out flip-flops and a wristband with a locker key.',
          'Shower before going into the pools.',
          'The gym is a corner just inside the entrance with a running machine. Members show their pass at the desk.',
          'Many people rest in the lounge after bathing, with a pot of tea.',
        ],
      },
      'town-office': {
        name: '街道办事处',
        nameGlosses: { ja: '街道事務所', en: 'Neighbourhood Office', de: 'Bezirksamt' },
        facts: [
          'Newcomers register their address here (residence registration, 住宿登记) soon after they move in.',
          'There is a China Post counter (中国邮政) in the same hall.',
        ],
      },
    },
    casualRegister: {
      formal: '您',
      casual: '你',
      offer: 'tell them there is no need for the polite 您 or for titles between you: they can just say 你 and use your given name, as friends do',
      inUse: 'You talk to each other as friends now: say 你, never 您, and no titles.',
    },
    personas: {
      landlord: { name: '刘阿姨', favouriteGift: 'flowers for the stairwell, something bright like peonies' },
      barista: { name: '小李', favouriteGift: 'chocolates, especially dark ones that go with coffee' },
      cashier: { name: '张敏', favouriteGift: 'a scented candle with a jasmine scent' },
      'convenience-clerk': { name: '小陈', favouriteGift: 'chocolates, the fancier the gift box the better' },
      server: { name: '小赵', favouriteGift: 'flowers, a small bunch for the restaurant counter' },
      receptionist: { name: '杨洁', favouriteGift: 'flowers for the front desk, something cheerful' },
      doctor: { name: '黄医生', favouriteGift: 'a scented candle to relax with after a long day at the clinic' },
      nurse: { name: '王芳', favouriteGift: 'a scented candle with an osmanthus scent' },
      pharmacist: { name: '周明', favouriteGift: 'chocolates, a tidy box of them' },
      'park-regular-1': { name: '吴大爷', favouriteGift: 'flowers, especially chrysanthemums like the ones on the old balcony' },
      'park-regular-2': { name: '徐丽', favouriteGift: 'chocolates to share at home (not with the dog!)' },
      'park-regular-3': { name: '小孙', favouriteGift: 'flowers, to sketch before they wilt' },
      shopkeeper: { name: '马老师', favouriteGift: 'a scented candle to read by in the evenings' },
      attendant: { name: '胡姐', favouriteGift: 'a scented candle that smells like a warm bath' },
      'office-clerk': { name: '郭先生', favouriteGift: 'chocolates to keep in the desk drawer for long afternoons' },
    },
    appearances: {
      npcs: {
        landlord: { body: 'body-4', hairStyle: 'short', hairColour: 'grey', skinTone: 'tone-2' },
        barista: { body: 'body-2', hairStyle: 'short', hairColour: 'black', skinTone: 'tone-2' },
        cashier: { body: 'body-2', hairStyle: 'long', hairColour: 'black', skinTone: 'tone-1' },
        'convenience-clerk': { body: 'body-4', hairStyle: 'long', hairColour: 'dark-brown', skinTone: 'tone-2' },
        server: { body: 'body-1', hairStyle: 'buzzed', hairColour: 'black', skinTone: 'tone-3' },
        receptionist: { body: 'body-4', hairStyle: 'buns', hairColour: 'black', skinTone: 'tone-1' },
        doctor: { body: 'body-4', hairStyle: 'short', hairColour: 'black', skinTone: 'tone-2' },
        nurse: { body: 'body-4', hairStyle: 'buns', hairColour: 'black', skinTone: 'tone-2' },
        pharmacist: { body: 'body-2', hairStyle: 'short', hairColour: 'black', skinTone: 'tone-3' },
        'park-regular-1': { body: 'body-4', hairStyle: 'buzzed', hairColour: 'grey', skinTone: 'tone-3' },
        'park-regular-2': { body: 'body-4', hairStyle: 'long', hairColour: 'black', skinTone: 'tone-2' },
        'park-regular-3': { body: 'body-2', hairStyle: 'short', hairColour: 'dark-brown', skinTone: 'tone-2' },
        shopkeeper: { body: 'body-2', hairStyle: 'bearded', hairColour: 'grey', skinTone: 'tone-3' },
        attendant: { body: 'body-4', hairStyle: 'buns', hairColour: 'dark-brown', skinTone: 'tone-3' },
        'office-clerk': { body: 'body-4', hairStyle: 'short', hairColour: 'black', skinTone: 'tone-2' },
      },
      customers: {
        body: { 'body-1': 3, 'body-2': 2, 'body-3': 3, 'body-4': 2 },
        hairStyle: {
          masculine: { short: 4, buzzed: 3, long: 1, bearded: 1, bald: 1 },
          feminine: { long: 4, short: 3, buns: 3 },
        },
        hairColour: { black: 6, 'dark-brown': 3, grey: 2 },
        skinTone: { 'tone-1': 2, 'tone-2': 4, 'tone-3': 3 },
      },
    },
    props: {
      home: ['steamer', 'lucky-bamboo'],
      cafe: ['red-lantern', 'tea-set', 'qr-stand'],
      supermarket: ['red-lantern', 'qr-stand', 'rice-sacks'],
      'convenience-store': ['tea-eggs', 'qr-stand'],
      restaurant: ['red-lantern', 'dim-sum', 'dim-sum', 'dim-sum'],
      clinic: ['qr-stand', 'medicine-boxes', 'water-dispenser'],
      park: ['xiangqi-table'],
      'tram-stop': ['sorting-bins', 'sorting-bins', 'sorting-bins'],
      bookshop: ['red-lantern', 'qr-stand', 'book-stack'],
      bathhouse: ['red-lantern', 'qr-stand', 'foot-basins'],
      'town-office': ['red-lantern', 'qr-stand', 'paperwork'],
    },
    shelves: { vegetables: 'bok-choy', eggs: 'eggs', noodles: 'dried-noodles' },
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
      cake: { name: 'Victoria sponge', glosses: { ja: 'ヴィクトリアケーキ', zh: '维多利亚海绵蛋糕', de: 'Victoria-Biskuitkuchen' } },
      'special-drink': { name: 'Hot chocolate', glosses: { ja: 'ホットチョコレート', zh: '热巧克力', de: 'Heiße Schokolade' } },
      'mystery-novel': { name: 'Crime novel', glosses: { ja: '推理小説', zh: '侦探小说', de: 'Kriminalroman' } },
      cookbook: { name: 'Cookbook', glosses: { ja: '料理の本', zh: '菜谱', de: 'Kochbuch' } },
      'travel-book': { name: 'Walking guide', glosses: { ja: '散歩ガイド', zh: '徒步指南', de: 'Wanderführer' } },
      magazine: { name: 'Magazine', glosses: { ja: '雑誌', zh: '杂志', de: 'Zeitschrift' } },
      flowers: { name: 'Bunch of flowers', glosses: { ja: '花束', zh: '一束花', de: 'Blumenstrauß' } },
      chocolates: { name: 'Box of chocolates', glosses: { ja: 'チョコレートの箱', zh: '一盒巧克力', de: 'Pralinenschachtel' } },
      'scented-candle': { name: 'Scented candle', glosses: { ja: 'アロマキャンドル', zh: '香薰蜡烛', de: 'Duftkerze' } },
      'bath-entry': { name: 'Swim and steam entry', glosses: { ja: 'プールとスチームルームの入場券', zh: '游泳和蒸汽房门票', de: 'Eintritt Schwimmbad und Dampfbad' } },
      'gym-membership': { name: 'Gym membership', glosses: { ja: 'ジムの会員', zh: '健身房会员', de: 'Mitgliedschaft im Fitnessstudio' } },
      'cold-medicine': { name: 'Cold relief capsules', glosses: { ja: '風邪薬', zh: '感冒胶囊', de: 'Erkältungskapseln' } },
      'fever-reducer': { name: 'Paracetamol', glosses: { ja: '解熱鎮痛剤', zh: '扑热息痛', de: 'Paracetamol' } },
      'stomach-medicine': { name: 'Stomach settler', glosses: { ja: '胃腸薬', zh: '肠胃药', de: 'Magenberuhigungsmittel' } },
      antihistamine: { name: 'Hay fever tablets', glosses: { ja: '花粉症の薬', zh: '花粉过敏药片', de: 'Heuschnupfentabletten' } },
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
    allergens: {
      milk: { name: 'Milk', glosses: { ja: '乳', zh: '牛奶', de: 'Milch' } },
      egg: { name: 'Egg', glosses: { ja: '卵', zh: '鸡蛋', de: 'Ei' } },
      wheat: { name: 'Wheat', glosses: { ja: '小麦', zh: '小麦', de: 'Weizen' } },
    },
    // Scones and a Victoria sponge are made with flour, egg and butter; hot chocolate is made with milk.
    cafeAllergens: { latte: ['milk'], coffee: [], tea: [], pastry: ['wheat', 'egg', 'milk'], cake: ['wheat', 'egg', 'milk'], 'special-drink': ['milk'] },
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
        'There is no tipping: the bill is what the customer pays. Card and contactless are fine.',
      ],
    },
    hospital: {
      name: 'St Mary’s Hospital',
      nameGlosses: { ja: 'セント・メアリー病院', zh: '圣玛丽医院', de: 'St.-Marien-Krankenhaus' },
    },
    apartments: { name: 'Rosewood House', nameGlosses: { ja: 'ローズウッド・ハウス', zh: '玫瑰木公寓', de: 'Rosewood House' } },
    tramStops: {
      'west-stop': { name: 'Old Town', nameGlosses: { ja: '旧市街', zh: '老城', de: 'Altstadt' } },
      'central-stop': { name: 'Town Centre', nameGlosses: { ja: '中央', zh: '市中心', de: 'Stadtmitte' } },
      'east-stop': { name: 'Market Street', nameGlosses: { ja: '市場通り', zh: '市场街', de: 'Marktstraße' } },
    },
    townPlaces: {
      park: { name: 'Victoria Park', nameGlosses: { ja: 'ヴィクトリア公園', zh: '维多利亚公园', de: 'Victoria Park' } },
      bookshop: { name: 'The Book Nook', nameGlosses: { ja: 'ブック・ヌック', zh: '书角书店', de: 'Bücherecke' } },
      bathhouse: {
        name: 'Riverside Baths',
        nameGlosses: { ja: 'リバーサイド浴場', zh: '河畔浴场', de: 'Flussbad' },
        facts: [
          'The baths are Victorian: a pool and a steam room. Swimwear is worn everywhere.',
          'Please shower before using the pool or the steam room.',
          'Lockers take a £1 coin, which comes back when you open them again.',
          'The gym is a corner just inside the entrance with a running machine. Members sign in at the desk first.',
        ],
      },
      'town-office': {
        name: 'Town Hall',
        nameGlosses: { ja: 'タウンホール', zh: '市政厅', de: 'Rathaus' },
        facts: [
          'New residents register their address with the council here, which also puts them on the electoral register.',
          'The Post Office counter is just inside the main doors.',
        ],
      },
    },
    casualRegister: {
      formal: 'Mr / Ms',
      casual: 'first names',
      offer: 'tell them to drop the "sir", "madam" and surnames and call you by your first name, as friends do',
      inUse: 'You are on first-name terms now: talk to them casually, as friends do, with nothing formal.',
    },
    personas: {
      landlord: { name: 'Mrs Hughes', favouriteGift: 'flowers for the hallway, sweet peas if you can find them' },
      barista: { name: 'Jess', favouriteGift: 'chocolates, the posh dark kind that goes with coffee' },
      cashier: { name: 'Priya', favouriteGift: 'a scented candle, something like lavender for the bath' },
      'convenience-clerk': { name: 'Dev', favouriteGift: 'chocolates, the bigger the box the better' },
      server: { name: 'Tom', favouriteGift: 'flowers, a small bunch for the restaurant counter' },
      receptionist: { name: 'Karen', favouriteGift: 'flowers for the reception desk, something cheerful like daffodils' },
      doctor: { name: 'Dr Okafor', favouriteGift: 'a scented candle to unwind with after evening surgery' },
      nurse: { name: 'Bridget', favouriteGift: 'a scented candle, something fresh like lemon' },
      pharmacist: { name: 'Mr Shah', favouriteGift: 'chocolates, a neat box of them' },
      'park-regular-1': { name: 'Arthur', favouriteGift: 'flowers that remind them of their allotment' },
      'park-regular-2': { name: 'Ellie', favouriteGift: 'chocolates to share at home (not with the dog!)' },
      'park-regular-3': { name: 'Callum', favouriteGift: 'flowers, to sketch before they wilt' },
      shopkeeper: { name: 'Mr Price', favouriteGift: 'a scented candle to read by on winter evenings' },
      attendant: { name: 'Maureen', favouriteGift: 'a scented candle that smells of eucalyptus, like the steam room' },
      'office-clerk': { name: 'Gareth', favouriteGift: 'chocolates to keep in the desk drawer for long afternoons' },
    },
    appearances: {
      npcs: {
        landlord: { body: 'body-3', hairStyle: 'short', hairColour: 'grey', skinTone: 'tone-1' },
        barista: { body: 'body-1', hairStyle: 'long', hairColour: 'auburn', skinTone: 'tone-1' },
        cashier: { body: 'body-1', hairStyle: 'long', hairColour: 'black', skinTone: 'tone-4' },
        'convenience-clerk': { body: 'body-3', hairStyle: 'short', hairColour: 'black', skinTone: 'tone-4' },
        server: { body: 'body-2', hairStyle: 'short', hairColour: 'blonde', skinTone: 'tone-1' },
        receptionist: { body: 'body-4', hairStyle: 'buns', hairColour: 'blonde', skinTone: 'tone-2' },
        doctor: { body: 'body-3', hairStyle: 'buzzed', hairColour: 'black', skinTone: 'tone-6' },
        nurse: { body: 'body-3', hairStyle: 'buns', hairColour: 'auburn', skinTone: 'tone-1' },
        pharmacist: { body: 'body-1', hairStyle: 'bearded', hairColour: 'black', skinTone: 'tone-4' },
        'park-regular-1': { body: 'body-4', hairStyle: 'bald', hairColour: 'grey', skinTone: 'tone-2' },
        'park-regular-2': { body: 'body-3', hairStyle: 'long', hairColour: 'brown', skinTone: 'tone-2' },
        'park-regular-3': { body: 'body-2', hairStyle: 'buzzed', hairColour: 'brown', skinTone: 'tone-1' },
        shopkeeper: { body: 'body-1', hairStyle: 'bearded', hairColour: 'grey', skinTone: 'tone-2' },
        attendant: { body: 'body-4', hairStyle: 'short', hairColour: 'grey', skinTone: 'tone-1' },
        'office-clerk': { body: 'body-3', hairStyle: 'short', hairColour: 'dark-brown', skinTone: 'tone-2' },
      },
      customers: {
        body: { 'body-1': 3, 'body-2': 2, 'body-3': 2, 'body-4': 3 },
        hairStyle: {
          masculine: { short: 4, buzzed: 2, long: 1, bearded: 2, bald: 1 },
          feminine: { long: 4, short: 3, buns: 2 },
        },
        hairColour: { black: 2, 'dark-brown': 3, brown: 3, auburn: 1, blonde: 2, grey: 2 },
        skinTone: { 'tone-1': 3, 'tone-2': 3, 'tone-3': 1, 'tone-4': 2, 'tone-5': 1, 'tone-6': 1 },
      },
    },
    props: {
      home: ['fry-up', 'radio'],
      cafe: ['bunting', 'cake-stand', 'card-reader'],
      supermarket: ['card-reader', 'flower-buckets'],
      'convenience-store': ['sausage-rolls', 'card-reader'],
      restaurant: ['bunting', 'fish-and-chips', 'fish-and-chips', 'fish-and-chips'],
      clinic: ['card-reader', 'medicine-boxes', 'magazine-table'],
      park: ['picnic-blanket'],
      'tram-stop': ['post-box', 'post-box', 'post-box'],
      bookshop: ['bunting', 'card-reader', 'book-stack'],
      bathhouse: ['card-reader', 'towel-stack'],
      'town-office': ['bunting', 'card-reader', 'paperwork'],
    },
    shelves: { vegetables: 'carrots', eggs: 'eggs', noodles: 'spaghetti' },
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
      cake: { name: 'Käsekuchen', glosses: { ja: 'チーズケーキ', zh: '芝士蛋糕', en: 'Cheesecake' } },
      'special-drink': { name: 'Heiße Schokolade', glosses: { ja: 'ホットチョコレート', zh: '热巧克力', en: 'Hot chocolate' } },
      'mystery-novel': { name: 'Krimi', glosses: { ja: '推理小説', zh: '侦探小说', en: 'Crime novel' } },
      cookbook: { name: 'Kochbuch', glosses: { ja: '料理の本', zh: '菜谱', en: 'Cookbook' } },
      'travel-book': { name: 'Wanderführer', glosses: { ja: 'ハイキングガイド', zh: '徒步指南', en: 'Walking guide' } },
      magazine: { name: 'Zeitschrift', glosses: { ja: '雑誌', zh: '杂志', en: 'Magazine' } },
      flowers: { name: 'Blumenstrauß', glosses: { ja: '花束', zh: '花束', en: 'Bunch of flowers' } },
      chocolates: { name: 'Pralinen', glosses: { ja: 'プラリネ（チョコレート菓子）', zh: '果仁夹心巧克力', en: 'Chocolates' } },
      'scented-candle': { name: 'Duftkerze', glosses: { ja: 'アロマキャンドル', zh: '香薰蜡烛', en: 'Scented candle' } },
      'bath-entry': { name: 'Eintritt Bad und Sauna', glosses: { ja: 'プールとサウナの入場券', zh: '浴场和桑拿门票', en: 'Entry to the pool and sauna' } },
      'gym-membership': { name: 'Fitness-Mitgliedschaft', glosses: { ja: 'ジムの会員', zh: '健身房会员', en: 'Gym membership' } },
      'cold-medicine': { name: 'Erkältungsmittel', glosses: { ja: '風邪薬', zh: '感冒药', en: 'Cold medicine' } },
      'fever-reducer': { name: 'Fiebersaft', glosses: { ja: '解熱シロップ', zh: '退烧糖浆', en: 'Fever syrup' } },
      'stomach-medicine': { name: 'Magentropfen', glosses: { ja: '胃薬の滴剤', zh: '胃药滴剂', en: 'Stomach drops' } },
      antihistamine: { name: 'Heuschnupfentabletten', glosses: { ja: '花粉症の薬', zh: '花粉过敏药片', en: 'Hay fever tablets' } },
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
    allergens: {
      milk: { name: 'Milch', glosses: { ja: '乳', zh: '牛奶', en: 'Milk' } },
      egg: { name: 'Ei', glosses: { ja: '卵', zh: '鸡蛋', en: 'Egg' } },
      wheat: { name: 'Weizen', glosses: { ja: '小麦', zh: '小麦', en: 'Wheat' } },
    },
    // A butter pretzel is wheat dough with butter, and no egg; cheesecake has a shortcrust base, quark and egg.
    cafeAllergens: { latte: ['milk'], coffee: [], tea: [], pastry: ['wheat', 'milk'], cake: ['wheat', 'egg', 'milk'], 'special-drink': ['milk'] },
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
    tramStops: {
      'west-stop': { name: 'Altstadt', nameGlosses: { ja: '旧市街', zh: '老城', en: 'Old Town' } },
      'central-stop': { name: 'Stadtmitte', nameGlosses: { ja: '中央', zh: '市中心', en: 'Town Centre' } },
      'east-stop': { name: 'Marktstraße', nameGlosses: { ja: '市場通り', zh: '市场街', en: 'Market Street' } },
    },
    townPlaces: {
      park: { name: 'Stadtpark', nameGlosses: { ja: '市立公園', zh: '城市公园', en: 'City Park' } },
      bookshop: { name: 'Buchhandlung Seitenweise', nameGlosses: { ja: 'ザイテンヴァイゼ書店', zh: '页页书店', en: 'Seitenweise Bookshop' } },
      bathhouse: {
        name: 'Stadtbad',
        nameGlosses: { ja: '市営浴場', zh: '市立浴场', en: 'Town Baths' },
        facts: [
          'Outdoor shoes stay in the changing area.',
          'Shower before going into the pool or the sauna.',
          'The sauna is mixed and swimwear-free: always sit on your own towel.',
          'The gym is a corner just inside the entrance with a running machine. Members sign in at the desk first.',
        ],
      },
      'town-office': {
        name: 'Bürgeramt',
        nameGlosses: { ja: '市民課', zh: '市民服务中心', en: 'Citizens’ Office' },
        facts: [
          'Anyone who moves here must register their address within two weeks (the Anmeldung) and is given a registration certificate (Meldebescheinigung).',
          'There is a post office counter (Postfiliale) in the same building.',
        ],
      },
    },
    casualRegister: {
      formal: 'Sie',
      casual: 'du',
      offer: 'offer them the du ("Wollen wir uns duzen?"): to say du to each other instead of Sie, as friends do',
      inUse: 'You say du to each other now: never Sie.',
    },
    personas: {
      landlord: { name: 'Frau Becker', favouriteGift: 'flowers for the stairwell, ideally tulips' },
      barista: { name: 'Lena', favouriteGift: 'chocolates, the dark ones that go with an espresso' },
      cashier: { name: 'Jonas', favouriteGift: 'a scented candle with a cosy vanilla scent' },
      'convenience-clerk': { name: 'Murat', favouriteGift: 'chocolates, the more marzipan the better' },
      server: { name: 'Sabine', favouriteGift: 'flowers, a small bunch for the restaurant counter' },
      receptionist: { name: 'Frau Wagner', favouriteGift: 'flowers for the reception desk, something cheerful like sunflowers' },
      doctor: { name: 'Dr. Schulz', favouriteGift: 'a scented candle to wind down with after a long day at the practice' },
      nurse: { name: 'Petra', favouriteGift: 'a scented candle with a fresh citrus scent' },
      pharmacist: { name: 'Herr Hoffmann', favouriteGift: 'chocolates, a tidy box of them' },
      'park-regular-1': { name: 'Herr Krüger', favouriteGift: 'flowers that remind them of their allotment garden' },
      'park-regular-2': { name: 'Anja', favouriteGift: 'chocolates to share at home (not with the dog!)' },
      'park-regular-3': { name: 'Felix', favouriteGift: 'flowers, to sketch before they wilt' },
      shopkeeper: { name: 'Herr Lange', favouriteGift: 'a scented candle to read by on long winter evenings' },
      attendant: { name: 'Frau Schmitt', favouriteGift: 'a scented candle that smells of pine, like the sauna' },
      'office-clerk': { name: 'Herr Neumann', favouriteGift: 'chocolates to keep in the desk drawer for long afternoons' },
    },
    appearances: {
      npcs: {
        landlord: { body: 'body-4', hairStyle: 'buns', hairColour: 'grey', skinTone: 'tone-1' },
        barista: { body: 'body-1', hairStyle: 'long', hairColour: 'blonde', skinTone: 'tone-1' },
        cashier: { body: 'body-2', hairStyle: 'short', hairColour: 'brown', skinTone: 'tone-2' },
        'convenience-clerk': { body: 'body-4', hairStyle: 'short', hairColour: 'black', skinTone: 'tone-3' },
        server: { body: 'body-2', hairStyle: 'long', hairColour: 'auburn', skinTone: 'tone-1' },
        receptionist: { body: 'body-3', hairStyle: 'short', hairColour: 'blonde', skinTone: 'tone-2' },
        doctor: { body: 'body-3', hairStyle: 'short', hairColour: 'grey', skinTone: 'tone-1' },
        nurse: { body: 'body-3', hairStyle: 'buns', hairColour: 'brown', skinTone: 'tone-2' },
        pharmacist: { body: 'body-1', hairStyle: 'bearded', hairColour: 'brown', skinTone: 'tone-2' },
        'park-regular-1': { body: 'body-3', hairStyle: 'bald', hairColour: 'grey', skinTone: 'tone-2' },
        'park-regular-2': { body: 'body-3', hairStyle: 'long', hairColour: 'dark-brown', skinTone: 'tone-1' },
        'park-regular-3': { body: 'body-1', hairStyle: 'buzzed', hairColour: 'blonde', skinTone: 'tone-1' },
        shopkeeper: { body: 'body-1', hairStyle: 'bald', hairColour: 'grey', skinTone: 'tone-2' },
        attendant: { body: 'body-3', hairStyle: 'buns', hairColour: 'auburn', skinTone: 'tone-2' },
        'office-clerk': { body: 'body-3', hairStyle: 'short', hairColour: 'brown', skinTone: 'tone-2' },
      },
      customers: {
        body: { 'body-1': 2, 'body-2': 3, 'body-3': 3, 'body-4': 2 },
        hairStyle: {
          masculine: { short: 4, buzzed: 2, long: 1, bearded: 2, bald: 1 },
          feminine: { long: 4, short: 3, buns: 2 },
        },
        hairColour: { black: 1, 'dark-brown': 2, brown: 4, auburn: 1, blonde: 3, grey: 2 },
        skinTone: { 'tone-1': 3, 'tone-2': 4, 'tone-3': 2, 'tone-4': 1, 'tone-5': 1 },
      },
    },
    props: {
      home: ['sausage-pan', 'teddy'],
      cafe: ['flower-box', 'bread-basket', 'coin-dish'],
      supermarket: ['coin-dish', 'drinks-crates'],
      'convenience-store': ['bockwurst', 'coin-dish'],
      restaurant: ['flower-box', 'sauerkraut', 'sauerkraut', 'sauerkraut'],
      clinic: ['coin-dish', 'medicine-boxes', 'coat-stand'],
      park: ['beer-bench'],
      'tram-stop': ['litfass-column', 'litfass-column', 'litfass-column'],
      bookshop: ['flower-box', 'coin-dish', 'book-stack'],
      bathhouse: ['flower-box', 'coin-dish', 'sauna-bucket'],
      'town-office': ['flower-box', 'coin-dish', 'paperwork'],
    },
    shelves: { vegetables: 'potatoes', eggs: 'eggs', noodles: 'spaetzle' },
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

/** What the staff at a place know about it in this pack (in English): a shop's facts, or another place's, if it has any. */
export function localPlaceFacts(placeId: PlaceId, packId: LanguageCode): string[] {
  if (isTownPlace(placeId)) return CULTURE_PACKS[packId].townPlaces[placeId].facts ?? [];
  return localShop(placeId, packId)?.facts ?? [];
}

/** A place's local name in this pack, and what it means in the three other Native Languages. */
function localTitle(placeId: PlaceId, packId: LanguageCode): { name: string; nameGlosses: Glosses } {
  const pack = CULTURE_PACKS[packId];
  if (placeId === 'clinic') return pack.hospital;
  if (placeId === 'home') return pack.apartments;
  if (isTownPlace(placeId)) return pack.townPlaces[placeId];
  const shop = localShop(placeId, packId);
  if (shop) return shop;
  throw new Error(`The ${placeId} has no local name in the ${packId} pack`);
}

/** A staffed place by its local name in this pack, as the Journal keeps it: a shop, the hospital, the apartment block, or another place Named NPCs are found. */
export function localPlaceName(placeId: PlaceId, packId: LanguageCode): string {
  return localTitle(placeId, packId).name;
}

/** What a place's local name means in each of the three other Native Languages, as its name board glosses it. */
export function placeNameGlosses(placeId: PlaceId, packId: LanguageCode): Glosses {
  return localTitle(placeId, packId).nameGlosses;
}

/** Where a town NPC is found, by its local name in this pack: their place's, or for a passer-by, the tram stop they wait at. */
export function localNpcPlaceName(npcId: TownNpcId, packId: LanguageCode): string {
  return isPasserBy(npcId) ? CULTURE_PACKS[packId].tramStops[PASSER_BY_STOPS[npcId]].name : localPlaceName(TOWN_NPCS[npcId].placeId, packId);
}

/** The allergens in one of this pack's café items, made with these extras (milk added to a coffee has milk in it). */
export function cafeAllergensIn(itemId: ItemId, extras: readonly DrinkExtra[], packId: LanguageCode): Allergen[] {
  const added = extras.flatMap((extra) => EXTRA_ALLERGENS[extra] ?? []);
  return ALLERGENS.filter((allergen) => (CULTURE_PACKS[packId].cafeAllergens[itemId] ?? []).includes(allergen) || added.includes(allergen));
}

/** This pack's weights for anonymous looks, as the sim draws them: each body with the hair styles its build wears. */
export function customerLookWeights(packId: LanguageCode): LookWeights {
  const { customers } = CULTURE_PACKS[packId].appearances;
  const hairStyle = Object.fromEntries(BODY_IDS.map((body) => [body, customers.hairStyle[BODY_PRESETS[body].build]]));
  return { ...customers, hairStyle: hairStyle as LookWeights['hairStyle'] };
}

/** Each pack's passers-by, each in a look drawn once from the pack's weights: the same every day. */
const PASSER_BY_LOOKS = Object.fromEntries(
  LANGUAGE_CODES.map((packId) => [
    packId,
    Object.fromEntries(PASSER_BY_IDS.map((npcId, i) => [npcId, lookFromSeed(i, customerLookWeights(packId))])),
  ]),
) as Record<LanguageCode, Record<PasserById, AppearancePreset>>;

/** How a town NPC looks in this pack: a Named NPC as the persona × pack table has them, a passer-by as drawn for the pack. */
export function townNpcLook(npcId: TownNpcId, packId: LanguageCode): AppearancePreset {
  return isPasserBy(npcId) ? PASSER_BY_LOOKS[packId][npcId] : CULTURE_PACKS[packId].appearances.npcs[npcId];
}
