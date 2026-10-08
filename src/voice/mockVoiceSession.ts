import {
  LEARN_NAME_TOOL,
  NOT_UNDERSTOOD_TOOL,
  OUT_OF_PATIENCE_SCENE,
  readChangedOrder,
  readChangeScene,
  readCheckout,
  readGiftScene,
  readServedScene,
  readShiftOrder,
  readTable,
  REVEAL_FAVOURITE_TOOL,
  WRAP_UP_SCENE,
  type CheckoutSaid,
  type DinerSaid,
  type NpcSession,
  type ToolResponse,
} from '../ai/index.ts';
import {
  ALLERGENS,
  BILL_METHODS,
  cafeAllergensIn,
  chargeInShifts,
  CULTURE_PACKS,
  dishFits,
  DRINK_EXTRAS,
  DRINK_SIZES,
  DRINK_TEMPERATURES,
  formatLocalMoney,
  ILLNESSES,
  INTERACTIONS,
  isDish,
  isMadeToOrder,
  ITEMS,
  localPlaceName,
  localPrice,
  MADE_TO_ORDER_EXTRAS,
  menuPrice,
  NAMED_NPCS,
  readBasketTotal,
  readBillTotal,
  readHospitalOwed,
  readNewWeeklyRent,
  readPrescription,
  readRentOwed,
  SEATING,
  SHIPPING_SPEEDS,
  START_WHEN,
  STOP_PLACES,
  SYMPTOM_IDS,
  TRAM_LINE,
  type Allergen,
  type DietaryNoteId,
  type DrinkExtra,
  type DrinkOptionId,
  type DrinkSize,
  type DrinkTemperature,
  type ItemId,
  type ShippingSpeed,
  type SymptomId,
  type TramStopId,
} from '../content/index.ts';
import { ECONOMY, ILLNESS_IDS, type IllnessId, type LanguageCode, type PlaceId } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents, VoiceSessionOptions } from './voiceSession.ts';

/** Roughly how long the real NPC takes to start answering. */
const REPLY_DELAY_MS = 600;

// The completions the fake knows how to script: an order over a counter, paying at the till or the bookshop,
// pointing to an item on the shelves, the nurse letting the patient go home, and the landlord
// taking rent, giving more time, or telling the tenant their new rent, the barista hiring, the server seating
// a guest and taking the bill, and the bathhouse attendant letting a bather in and signing up a gym member.
const SERVE_ORDER = INTERACTIONS.orderDrink.completion.name;
const COMPLETE_PURCHASE = INTERACTIONS.payForGroceries.completion.name;
const POINT_TO = INTERACTIONS.findAnItem.completion.name;
const DISCHARGE_PATIENT = INTERACTIONS.wakeInWard.completion.name;
const ACCEPT_RENT = INTERACTIONS.payRent.completion.name;
const GRANT_EXTENSION = INTERACTIONS.askForMoreTime.completion.name;
const FINISH_RENT_NEWS = INTERACTIONS.newcomerDiscountNews.completion.name;
const HIRE_APPLICANT = INTERACTIONS.askBaristaForWork.completion.name;
const SEAT_GUEST = INTERACTIONS.getATable.completion.name;
const SETTLE_BILL = INTERACTIONS.payTheBill.completion.name;
const ADMIT = INTERACTIONS.buyBathEntry.completion.name;
const REGISTER_MEMBER = INTERACTIONS.joinTheGym.completion.name;
const REGISTER_PATIENT = INTERACTIONS.checkIn.completion.name;
const DIAGNOSE = INTERACTIONS.seeTheDoctor.completion.name;
const DISPENSE = INTERACTIONS.getMedicine.completion.name;
const SET_PAYMENT_PLAN = INTERACTIONS.settleHospitalBill.completion.name;
const REFUND = INTERACTIONS.returnAnItem.completion.name;
const REGISTER_RESIDENT = INTERACTIONS.registerAddress.completion.name;
const SHIP = INTERACTIONS.sendAParcel.completion.name;
const GIVE_DIRECTIONS = INTERACTIONS.askForDirections.completion.name;
/** How many more days the fake landlord gives. */
const EXTENSION_DAYS = 3;

/**
 * Typed to the fake NPC, this makes its connection drop, so the smoke tests can
 * script a network failure. It only exists in mock mode.
 */
export const MOCK_DROP_LINE = '#drop';

/** The words a fake NPC recognises. A line with none of them is gibberish to it. */
type Words = { yes: string[]; no: string[]; known: string[] };

/** How each pack's Player might name each item. */
const ITEM_WORDS: Record<LanguageCode, Record<ItemId, string[]>> = {
  ja: {
    latte: ['ラテ', 'らて', 'latte'],
    coffee: ['コーヒー', 'こーひー', 'coffee'],
    tea: ['紅茶', 'こうちゃ', 'tea'],
    pastry: ['メロンパン', 'めろんぱん'],
    snack: ['からあげ', '唐揚げ', 'karaage'],
    bento: ['弁当', 'べんとう', 'bento'],
    vegetables: ['キャベツ', 'きゃべつ', '野菜', 'やさい'],
    eggs: ['卵', 'たまご', '玉子', 'egg'],
    noodles: ['うどん', 'udon'],
    batteries: ['電池', 'でんち', 'battery'],
    stamps: ['切手', 'きって'],
    'gift-card': ['ギフトカード', 'ぎふとかーど'],
    'pork-dish': ['ポークソテー', 'ぽーくそてー', 'ポーク'],
    'chicken-dish': ['チキン南蛮', 'ちきんなんばん', 'チキン'],
    'fish-dish': ['焼き鮭', '鮭', 'さけ', 'しゃけ'],
    'veggie-dish': ['パスタ', 'ぱすた', 'pasta'],
    juice: ['ジュース', 'じゅーす', 'juice'],
    cola: ['コーラ', 'こーら', 'cola'],
    cake: ['ケーキ', 'けーき', 'cake'],
    'special-drink': ['クリームソーダ', 'くりーむそーだ', 'ソーダ'],
    'mystery-novel': ['ミステリー', '推理小説', '小説'],
    cookbook: ['料理', 'レシピ'],
    'travel-book': ['散歩', 'ガイド'],
    magazine: ['雑誌', 'ざっし'],
    flowers: ['花束', 'はなたば', '花'],
    chocolates: ['チョコ'],
    'scented-candle': ['キャンドル', 'ろうそく'],
    'bath-entry': ['お風呂', '風呂', 'ふろ', '入浴', '銭湯'],
    'gym-membership': ['ジム', 'じむ', 'トレーニング', '会員'],
    'cold-medicine': ['風邪薬', 'かぜぐすり'],
    'fever-reducer': ['解熱剤', 'げねつざい', '熱さまし'],
    'stomach-medicine': ['胃腸薬', 'いちょうやく', '胃薬'],
    antihistamine: ['花粉症の薬', 'アレルギーの薬'],
  },
  zh: {
    latte: ['拿铁', 'latte'],
    coffee: ['咖啡', 'coffee'],
    tea: ['红茶', '茶', 'tea'],
    pastry: ['蛋挞'],
    snack: ['茶叶蛋'],
    bento: ['盒饭', '便当'],
    vegetables: ['青菜', '蔬菜'],
    eggs: ['鸡蛋'],
    noodles: ['挂面', '面条'],
    batteries: ['电池'],
    stamps: ['邮票'],
    'gift-card': ['购物卡', '礼品卡'],
    'pork-dish': ['糖醋里脊', '里脊'],
    'chicken-dish': ['宫保鸡丁', '鸡丁'],
    'fish-dish': ['清蒸鱼', '鱼'],
    'veggie-dish': ['地三鲜'],
    juice: ['橙汁', '果汁', 'juice'],
    cola: ['可乐', 'cola'],
    cake: ['提拉米苏', '蛋糕'],
    'special-drink': ['芒果冰沙', '冰沙'],
    'mystery-novel': ['推理', '小说'],
    cookbook: ['菜谱', '食谱'],
    'travel-book': ['旅游', '指南'],
    magazine: ['杂志'],
    flowers: ['鲜花', '花'],
    chocolates: ['巧克力'],
    'scented-candle': ['蜡烛', '香薰'],
    'bath-entry': ['洗澡', '泡澡', '澡', '浴'],
    'gym-membership': ['健身', '会员'],
    'cold-medicine': ['感冒药'],
    'fever-reducer': ['退烧药', '退烧'],
    'stomach-medicine': ['肠胃药', '胃药'],
    antihistamine: ['抗过敏药', '过敏药'],
  },
  en: {
    latte: ['latte'],
    coffee: ['coffee', 'americano'],
    tea: ['tea', 'cuppa'],
    pastry: ['scone'],
    snack: ['sausage roll', 'sausage'],
    bento: ['lasagne', 'lasagna', 'ready meal'],
    vegetables: ['carrots', 'carrot', 'vegetables'],
    eggs: ['eggs', 'egg'],
    noodles: ['spaghetti', 'pasta'],
    batteries: ['batteries', 'battery'],
    stamps: ['stamps', 'stamp'],
    'gift-card': ['gift card'],
    'pork-dish': ['sausage and mash', 'bangers'],
    'chicken-dish': ['chicken pie'],
    'fish-dish': ['fish and chips', 'fish'],
    'veggie-dish': ['veggie burger', 'burger'],
    juice: ['orange juice', 'juice'],
    cola: ['cola', 'coke'],
    cake: ['victoria sponge', 'sponge', 'cake'],
    'special-drink': ['hot chocolate', 'chocolate'],
    'mystery-novel': ['crime novel', 'novel', 'crime', 'mystery'],
    cookbook: ['cookbook', 'recipe'],
    'travel-book': ['walking guide', 'guide', 'walking'],
    magazine: ['magazine'],
    flowers: ['flowers', 'bouquet'],
    chocolates: ['chocolates'],
    'scented-candle': ['candle'],
    'bath-entry': ['bath', 'baths', 'swim', 'steam', 'pool'],
    'gym-membership': ['gym', 'membership', 'join'],
    'cold-medicine': ['cold relief', 'capsules'],
    'fever-reducer': ['paracetamol'],
    'stomach-medicine': ['stomach settler'],
    antihistamine: ['hay fever tablets', 'antihistamine'],
  },
  de: {
    latte: ['latte', 'milchkaffee'],
    coffee: ['kaffee', 'coffee'],
    tea: ['tee', 'tea'],
    pastry: ['brezel', 'breze'],
    snack: ['bockwurst', 'wurst'],
    bento: ['fertiggericht'],
    vegetables: ['kartoffeln', 'kartoffel'],
    eggs: ['eier', 'ei'],
    noodles: ['spätzle', 'nudeln'],
    batteries: ['batterien', 'batterie'],
    stamps: ['briefmarken', 'briefmarke'],
    'gift-card': ['geschenkkarte', 'gutschein'],
    'pork-dish': ['schnitzel'],
    'chicken-dish': ['geschnetzeltes', 'hähnchen'],
    'fish-dish': ['lachs', 'fisch'],
    'veggie-dish': ['käsespätzle'],
    juice: ['orangensaft', 'saft'],
    cola: ['cola'],
    cake: ['käsekuchen', 'kuchen'],
    'special-drink': ['heiße schokolade', 'schokolade', 'kakao'],
    'mystery-novel': ['krimi', 'roman'],
    cookbook: ['kochbuch', 'rezept'],
    'travel-book': ['wanderführer', 'reiseführer'],
    magazine: ['zeitschrift', 'magazin'],
    flowers: ['blumenstrauß', 'blumen'],
    chocolates: ['pralinen'],
    'scented-candle': ['duftkerze', 'kerze'],
    'bath-entry': ['bad', 'baden', 'sauna', 'schwimmen'],
    'gym-membership': ['fitnessstudio', 'fitness', 'mitglied', 'mitgliedschaft', 'training'],
    'cold-medicine': ['erkältungsmittel'],
    'fever-reducer': ['fiebersaft'],
    'stomach-medicine': ['magentropfen'],
    antihistamine: ['heuschnupfentabletten'],
  },
};

/** A fake NPC taking an order over a counter: the barista, or the convenience store clerk. */
type OrderScript = {
  greeting: string;
  /** Picks up again after a dropped connection, instead of greeting. */
  resume: string;
  /** Clarifying re-asks for a line it understood but can't act on. None sounds like not understanding. */
  clarify: string[];
  readBack: (item: string, price: string) => string;
  served: string;
  cannotAfford: string;
  askAgain: string;
  notUnderstood: string;
  outOfPatience: string;
  price: (amount: number) => string;
  words: Words;
};

const SCRIPT: Record<LanguageCode, OrderScript> = {
  ja: {
    greeting: 'いらっしゃいませ！ご注文はお決まりですか？',
    resume: '大変お待たせしました。ご注文をどうぞ。',
    clarify: ['ご注文は何になさいますか？', 'ラテ、コーヒー、紅茶、メロンパンがございます。どれにしますか？'],
    readBack: (item, price) => `${item}ですね。${price}です。よろしいですか？`,
    served: 'ありがとうございます！こちら、どうぞ。またお越しくださいませ。',
    cannotAfford: '申し訳ございません、お支払いが足りないようです。ほかのものになさいますか？',
    askAgain: '失礼しました。ご注文は何になさいますか？',
    notUnderstood: 'すみません、よくわかりませんでした。',
    outOfPatience: '申し訳ございません…。またのお越しをお待ちしております。',
    price: (amount) => `${amount}円`,
    words: {
      yes: ['はい', 'ええ', 'うん', 'お願いします', 'おねがいします', 'yes', 'ok'],
      no: ['いいえ', 'いや', 'ちがいます', '違います', 'no'],
      known: ['ください', 'こんにちは', 'おはよう', 'すみません', 'ありがとう', 'メニュー', 'hello'],
    },
  },
  zh: {
    greeting: '欢迎光临！您想喝点什么？',
    resume: '让您久等了。您想喝点什么？',
    clarify: ['您想喝点什么？', '我们有拿铁、咖啡、红茶和蛋挞。您要哪个？'],
    readBack: (item, price) => `一杯${item}，${price}。对吗？`,
    served: '好的，这是您的饮料。欢迎下次光临！',
    cannotAfford: '不好意思，您的钱好像不够。要换别的吗？',
    askAgain: '不好意思。您要点什么？',
    notUnderstood: '不好意思，我没听懂。',
    outOfPatience: '真不好意思……欢迎下次再来。',
    price: (amount) => `${amount}元`,
    words: {
      yes: ['好', '对', '是', '可以', 'yes', 'ok'],
      no: ['不', 'no'],
      known: ['你好', '请', '谢谢', '菜单', '要', 'hello'],
    },
  },
  en: {
    greeting: 'Hiya! What can I get you?',
    resume: 'Sorry about that! What can I get you?',
    clarify: ['What would you like?', "We've got lattes, coffee, tea and scones. Which one?"],
    readBack: (item, price) => `One ${item.toLowerCase()}, that's ${price}. Is that right?`,
    served: 'Lovely, here you go. Have a nice day!',
    cannotAfford: "Sorry, it looks like that's not enough. Would you like something else?",
    askAgain: 'Sorry! What would you like?',
    notUnderstood: "Sorry, I didn't catch that.",
    outOfPatience: "I'm so sorry, I can't quite help. Maybe another time!",
    price: (amount) => `£${amount.toFixed(2)}`,
    words: {
      yes: ['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'right', 'correct'],
      no: ['no', 'nope', 'wrong'],
      known: ['hello', 'hi', 'hiya', 'please', 'thanks', 'thank you', 'menu', 'morning'],
    },
  },
  de: {
    greeting: 'Hallo! Was darf’s sein?',
    resume: 'Entschuldigung! Was darf’s sein?',
    clarify: ['Was möchten Sie trinken?', 'Wir haben Latte, Kaffee, Tee und Brezeln. Was darf’s sein?'],
    readBack: (item, price) => `Einmal ${item} für ${price}, richtig?`,
    served: 'Bitte schön! Einen schönen Tag noch!',
    cannotAfford: 'Oh, das reicht leider nicht. Möchten Sie etwas anderes?',
    askAgain: 'Entschuldigung! Was möchten Sie?',
    notUnderstood: 'Entschuldigung, das habe ich nicht verstanden.',
    outOfPatience: 'Tut mir leid… Vielleicht ein anderes Mal. Tschüss!',
    price: (amount) => `${amount.toFixed(2).replace('.', ',')} €`,
    words: {
      yes: ['ja', 'genau', 'gerne', 'okay', 'ok', 'richtig', 'stimmt'],
      no: ['nein', 'nee', 'falsch'],
      known: ['hallo', 'guten', 'bitte', 'danke', 'karte', 'moin', 'hello'],
    },
  },
};

/** The convenience store clerk: the barista's way of taking an order, in a shop's words. */
const CLERK_SCRIPT: Record<LanguageCode, OrderScript> = {
  ja: {
    ...SCRIPT.ja,
    greeting: 'いらっしゃいませ！ホットスナックやお弁当はいかがですか？',
    resume: 'お待たせしました。ご注文をどうぞ。',
    clarify: ['ご注文は何になさいますか？', 'からあげとのり弁当がございます。どちらにしますか？'],
    served: 'ありがとうございました！またお越しくださいませ。',
  },
  zh: {
    ...SCRIPT.zh,
    greeting: '欢迎光临！要来点热的小吃或者盒饭吗？',
    resume: '让您久等了。您要点什么？',
    clarify: ['您要点什么？', '我们有茶叶蛋和盒饭。您要哪个？'],
    readBack: (item, price) => `${item}，${price}。对吗？`,
    served: '好的，给您。欢迎下次光临！',
  },
  en: {
    ...SCRIPT.en,
    greeting: 'Hiya! Anything hot today?',
    resume: 'Sorry about that! What can I get you?',
    clarify: ['What can I get you?', "We've got sausage rolls and microwave lasagne. Which one?"],
    served: 'There you go. Cheers!',
  },
  de: {
    ...SCRIPT.de,
    greeting: 'Hallo! Eine Bockwurst oder was Warmes?',
    resume: 'Entschuldigung! Was darf’s sein?',
    clarify: ['Was möchten Sie?', 'Wir haben Bockwurst und Fertiggerichte. Was darf’s sein?'],
    served: 'Bitte schön! Schönen Tag noch!',
  },
};

/** The shopkeeper selling something to read: the barista's way of taking an order, in a bookshop's words. */
const BOOKSHOP_SCRIPT: Record<LanguageCode, OrderScript> = {
  ja: {
    ...SCRIPT.ja,
    greeting: 'いらっしゃいませ。本をお探しですか？',
    resume: 'お待たせしました。何をお探しですか？',
    clarify: ['どの本になさいますか？', 'ミステリー小説、料理の本、散歩ガイド、雑誌がございます。どれになさいますか？'],
    served: 'ありがとうございました。どうぞお楽しみください。',
    cannotAfford: '申し訳ございません、お支払いが足りないようです。ほかの本になさいますか？',
    askAgain: '失礼しました。どの本になさいますか？',
  },
  zh: {
    ...SCRIPT.zh,
    greeting: '欢迎光临！您想找什么书？',
    resume: '让您久等了。您想找什么书？',
    clarify: ['您要哪本书？', '我们有推理小说、家常菜谱、旅游指南和杂志。您要哪个？'],
    readBack: (item, price) => `${item}，${price}。对吗？`,
    served: '谢谢！祝您阅读愉快。',
    cannotAfford: '不好意思，您的钱好像不够。要换别的书吗？',
    askAgain: '不好意思。您要哪本书？',
  },
  en: {
    ...SCRIPT.en,
    greeting: 'Hiya! Looking for something to read?',
    resume: 'Sorry about that! What are you looking for?',
    clarify: ['Which one would you like?', "We've got a crime novel, a cookbook, a walking guide and magazines. Which one?"],
    served: 'There you go. Happy reading!',
    cannotAfford: "Sorry, it looks like that's not enough. Would you like a different one?",
    askAgain: 'Sorry! Which one would you like?',
  },
  de: {
    ...SCRIPT.de,
    greeting: 'Hallo! Suchen Sie etwas zum Lesen?',
    resume: 'Entschuldigung! Was suchen Sie?',
    clarify: ['Welches möchten Sie?', 'Wir haben einen Krimi, ein Kochbuch, einen Wanderführer und Zeitschriften. Was darf es sein?'],
    served: 'Bitte schön! Viel Spaß beim Lesen!',
    cannotAfford: 'Oh, das reicht leider nicht. Möchten Sie ein anderes?',
    askAgain: 'Entschuldigung! Welches möchten Sie?',
  },
};

/** The shopkeeper selling a gift: finds out which, asks whether to wrap it, and reads both back with the price. */
type GiftScript = {
  greeting: string;
  resume: string;
  clarify: string;
  askWrap: (item: string) => string;
  readBack: (item: string, price: string, wrap: boolean) => string;
  served: string;
  cannotAfford: string;
};

const GIFT_SCRIPT: Record<LanguageCode, GiftScript> = {
  ja: {
    greeting: 'いらっしゃいませ。贈り物をお探しですか？',
    resume: 'お待たせしました。贈り物をお探しですか？',
    clarify: '花束、チョコレート、アロマキャンドルがございます。どれになさいますか？',
    askWrap: (item) => `${item}ですね。プレゼント用にお包みしましょうか？`,
    readBack: (item, price, wrap) => `${item}、${price}、${wrap ? 'お包みあり' : 'お包みなし'}ですね。よろしいですか？`,
    served: 'ありがとうございました。喜ばれるといいですね。',
    cannotAfford: '申し訳ございません、お支払いが足りないようです。ほかの贈り物になさいますか？',
  },
  zh: {
    greeting: '欢迎光临！您想买礼物吗？',
    resume: '让您久等了。您想买什么礼物？',
    clarify: '我们有鲜花、巧克力礼盒和香薰蜡烛。您要哪个？',
    askWrap: (item) => `${item}，好的。需要包装吗？`,
    readBack: (item, price, wrap) => `${item}，${price}，${wrap ? '要包装' : '不要包装'}，对吗？`,
    served: '谢谢！希望对方会喜欢。',
    cannotAfford: '不好意思，您的钱好像不够。要换别的礼物吗？',
  },
  en: {
    greeting: 'Hiya! Looking for a present?',
    resume: 'Sorry about that! What present are you after?',
    clarify: "We've got flowers, chocolates and scented candles. Which one?",
    askWrap: (item) => `${item}, lovely. Shall I gift-wrap it for you?`,
    readBack: (item, price, wrap) => `${item}, that's ${price}, ${wrap ? 'gift-wrapped' : 'not wrapped'}. Is that right?`,
    served: 'There you go. I hope they love it!',
    cannotAfford: "Sorry, it looks like that's not enough. Would you like a different present?",
  },
  de: {
    greeting: 'Hallo! Suchen Sie ein Geschenk?',
    resume: 'Entschuldigung! Was für ein Geschenk suchen Sie?',
    clarify: 'Wir haben Blumensträuße, Pralinen und Duftkerzen. Was darf es sein?',
    askWrap: (item) => `${item}, gern. Soll ich es als Geschenk einpacken?`,
    readBack: (item, price, wrap) => `${item} für ${price}, ${wrap ? 'als Geschenk verpackt' : 'nicht verpackt'}, richtig?`,
    served: 'Bitte schön! Viel Freude damit!',
    cannotAfford: 'Oh, das reicht leider nicht. Möchten Sie ein anderes Geschenk?',
  },
};

/** The server taking an order at a table: the barista's way of taking an order, in a restaurant's words. */
const SERVER_ORDER_SCRIPT: Record<LanguageCode, OrderScript> = {
  ja: {
    ...SCRIPT.ja,
    greeting: 'お待たせいたしました。ご注文はお決まりですか？',
    resume: 'お待たせしました。ご注文をどうぞ。',
    clarify: [
      'ご注文は何になさいますか？',
      'ポークソテー、チキン南蛮、焼き鮭定食、野菜のトマトパスタ、お飲み物はオレンジジュースとコーラがございます。',
    ],
    served: 'お待たせしました。どうぞごゆっくり。お会計の際はお声がけください。',
    cannotAfford: '申し訳ございません、お支払いが足りなくなってしまうようです。ほかのものになさいますか？',
  },
  zh: {
    ...SCRIPT.zh,
    greeting: '您好，可以点菜了吗？',
    resume: '让您久等了。您要点什么？',
    clarify: ['您要点什么？', '我们有糖醋里脊、宫保鸡丁、清蒸鱼和地三鲜，饮料有橙汁和可乐。'],
    readBack: (item, price) => `${item}，${price}。对吗？`,
    served: '菜来了，请慢用！吃好了叫我结账。',
    cannotAfford: '不好意思，您的钱好像不够付这个。要换别的吗？',
  },
  en: {
    ...SCRIPT.en,
    greeting: 'Are you ready to order?',
    clarify: [
      'What would you like?',
      "We've got sausage and mash, chicken pie, fish and chips and a veggie burger, and orange juice or cola to drink.",
    ],
    served: "Here you go. Enjoy your meal, and just ask when you'd like the bill.",
    cannotAfford: "Sorry, it looks like that won't be enough. Would you like something else?",
  },
  de: {
    ...SCRIPT.de,
    greeting: 'Haben Sie schon gewählt?',
    clarify: [
      'Was möchten Sie bestellen?',
      'Wir haben Schweineschnitzel, Hähnchengeschnetzeltes, Lachsfilet und Käsespätzle, und zu trinken Orangensaft oder Cola.',
    ],
    served: 'Bitte schön, guten Appetit! Sagen Sie Bescheid, wenn Sie zahlen möchten.',
  },
};

type Seating = (typeof SEATING)[number];
type BillMethod = (typeof BILL_METHODS)[number];
/** The party sizes the fake server understands. */
const PARTY_SIZES = [1, 2, 3, 4] as const;
/** The dietary needs in the order the fake server listens for them: "no pork" before a vegetarian's "no meat". */
const DIETS_HEARD = ['no-pork', 'no-seafood', 'vegetarian'] as const satisfies readonly DietaryNoteId[];

/**
 * The fake server's own lines: seating a guest (how many, then where), recommending a dish that keeps to what they
 * don't eat, and taking the bill (the total, then how they pay). Each reads back before calling its completion.
 */
type ServerScript = {
  welcome: string;
  askParty: string;
  askSeating: string;
  readBackTable: (party: number, seating: string) => string;
  seated: string;
  party: Record<(typeof PARTY_SIZES)[number], string[]>;
  seating: Record<Seating, { words: string[]; said: string }>;
  welcomeToRecommend: string;
  askDiet: string;
  diets: Record<DietaryNoteId, string[]>;
  recommend: (dish: string, price: string) => string;
  notThatOne: (dish: string, price: string) => string;
  billTotal: (total: string) => string;
  askMethod: string;
  readBackBill: (total: string, method: string) => string;
  methods: Record<BillMethod, { words: string[]; said: string }>;
  paid: string;
  cannotPay: string;
};

const SERVER_SCRIPT: Record<LanguageCode, ServerScript> = {
  ja: {
    welcome: 'いらっしゃいませ！何名様ですか？',
    askParty: '何名様でいらっしゃいますか？',
    askSeating: 'テーブル席、カウンター席、窓際の席がございます。どちらがよろしいですか？',
    readBackTable: (party, seating) => `${party}名様、${seating}ですね。よろしいですか？`,
    seated: 'こちらへどうぞ。ご注文がお決まりになりましたら、お呼びください。',
    party: { 1: ['一人', 'ひとり', '1人', '一名', '1名'], 2: ['二人', 'ふたり', '2人', '2名'], 3: ['三人', '3人', '3名'], 4: ['四人', '4人', '4名'] },
    seating: {
      table: { words: ['テーブル'], said: 'テーブル席' },
      counter: { words: ['カウンター'], said: 'カウンター席' },
      window: { words: ['窓', 'まど'], said: '窓際の席' },
    },
    welcomeToRecommend: 'いらっしゃいませ。おすすめですね。何か召し上がれないものはございますか？',
    askDiet: '何か召し上がれないものはございますか？',
    diets: { vegetarian: ['ベジタリアン', '菜食'], 'no-pork': ['豚肉', '豚'], 'no-seafood': ['魚', 'シーフード'] },
    recommend: (dish, price) => `それでしたら、${dish}がおすすめです。${price}です。いかがですか？`,
    notThatOne: (dish, price) => `申し訳ございません、そちらは召し上がれないものが入っております。${dish}はいかがですか？${price}です。`,
    billTotal: (total) => `お会計ですね。合計${total}になります。お支払いは現金とカード、どちらになさいますか？`,
    askMethod: 'お支払いは現金とカード、どちらになさいますか？',
    readBackBill: (total, method) => `${total}、${method}でのお支払いですね。よろしいですか？`,
    methods: { cash: { words: ['現金', 'げんきん'], said: '現金' }, card: { words: ['カード', 'かーど'], said: 'カード' } },
    paid: 'ありがとうございました。またお越しくださいませ。',
    cannotPay: '申し訳ございません、お支払いが足りないようです。また後でお支払いいただけますか？',
  },
  zh: {
    welcome: '欢迎光临！请问几位？',
    askParty: '请问几位？',
    askSeating: '您想坐桌子、吧台还是靠窗的位子？',
    readBackTable: (party, seating) => `${party}位，${seating}，对吗？`,
    seated: '这边请。点菜的时候叫我就行。',
    party: { 1: ['一位', '一个人', '1位'], 2: ['两位', '两个人', '2位'], 3: ['三位', '3位'], 4: ['四位', '4位'] },
    seating: {
      table: { words: ['桌'], said: '坐桌子' },
      counter: { words: ['吧台'], said: '坐吧台' },
      window: { words: ['窗'], said: '靠窗的位子' },
    },
    welcomeToRecommend: '您好！想让我推荐吗？请问您有什么忌口吗？',
    askDiet: '请问您有什么忌口吗？',
    diets: { vegetarian: ['吃素', '素食'], 'no-pork': ['猪肉', '不吃猪'], 'no-seafood': ['海鲜', '不吃鱼'] },
    recommend: (dish, price) => `那我推荐${dish}，${price}。您看可以吗？`,
    notThatOne: (dish, price) => `不好意思，这个不合您的忌口。我推荐${dish}，${price}，可以吗？`,
    billTotal: (total) => `好的，一共${total}。您用现金还是刷卡？`,
    askMethod: '您用现金还是刷卡？',
    readBackBill: (total, method) => `一共${total}，${method}，对吗？`,
    methods: { cash: { words: ['现金'], said: '付现金' }, card: { words: ['刷卡', '卡', '扫码'], said: '刷卡' } },
    paid: '谢谢光临，欢迎下次再来！',
    cannotPay: '不好意思，您的钱好像不够。您可以下次再来付。',
  },
  en: {
    welcome: 'Hiya, welcome in! How many of you are there?',
    askParty: 'How many of you are there?',
    askSeating: 'Would you like a table, a seat at the counter, or one by the window?',
    readBackTable: (party, seating) => `${party === 1 ? 'Just the one' : `${party} of you`}, ${seating}. Is that right?`,
    seated: "Right this way. Give me a shout when you're ready to order.",
    party: { 1: ['just me', 'one', 'alone', 'myself'], 2: ['two'], 3: ['three'], 4: ['four'] },
    seating: {
      table: { words: ['table'], said: 'at a table' },
      counter: { words: ['counter', 'bar'], said: 'at the counter' },
      window: { words: ['window'], said: 'by the window' },
    },
    welcomeToRecommend: "Hiya! Happy to recommend something. Is there anything you don't eat?",
    askDiet: "Is there anything you don't eat?",
    diets: { vegetarian: ['vegetarian', 'no meat'], 'no-pork': ['pork'], 'no-seafood': ['seafood', 'no fish'] },
    recommend: (dish, price) => `Then I'd recommend the ${dish.toLowerCase()}, that's ${price}. How does that sound?`,
    notThatOne: (dish, price) => `Sorry, that one won't suit you. How about the ${dish.toLowerCase()} instead? That's ${price}.`,
    billTotal: (total) => `Of course. That comes to ${total} altogether. Cash or card?`,
    askMethod: 'Will that be cash or card?',
    readBackBill: (total, method) => `${total}, paying ${method}. Is that right?`,
    methods: { cash: { words: ['cash'], said: 'in cash' }, card: { words: ['card', 'contactless'], said: 'by card' } },
    paid: 'Thanks very much. Hope to see you again soon!',
    cannotPay: "Sorry, it looks like that's not enough. You can come back and pay it later.",
  },
  de: {
    welcome: 'Guten Tag! Für wie viele Personen?',
    askParty: 'Für wie viele Personen?',
    askSeating: 'Möchten Sie an einem Tisch, an der Theke oder am Fenster sitzen?',
    readBackTable: (party, seating) => `${party === 1 ? 'Eine Person' : `${party} Personen`}, ${seating}, richtig?`,
    seated: 'Bitte hier entlang. Rufen Sie mich, wenn Sie bestellen möchten.',
    party: { 1: ['eine person', 'allein', 'einer'], 2: ['zwei'], 3: ['drei'], 4: ['vier'] },
    seating: {
      table: { words: ['tisch'], said: 'an einem Tisch' },
      counter: { words: ['theke', 'tresen'], said: 'an der Theke' },
      window: { words: ['fenster'], said: 'am Fenster' },
    },
    welcomeToRecommend: 'Guten Tag! Gern empfehle ich Ihnen etwas. Gibt es etwas, das Sie nicht essen?',
    askDiet: 'Gibt es etwas, das Sie nicht essen?',
    diets: {
      vegetarian: ['vegetarier', 'vegetarierin', 'vegetarisch', 'kein fleisch'],
      'no-pork': ['schweinefleisch', 'kein schwein'],
      'no-seafood': ['fisch', 'meeresfrüchte'],
    },
    recommend: (dish, price) => `Dann empfehle ich Ihnen ${dish} für ${price}. Wie klingt das?`,
    notThatOne: (dish, price) => `Das passt leider nicht. Wie wäre es mit ${dish} für ${price}?`,
    billTotal: (total) => `Gern. Das macht ${total}. Zahlen Sie bar oder mit Karte?`,
    askMethod: 'Zahlen Sie bar oder mit Karte?',
    readBackBill: (total, method) => `${total}, ${method}, richtig?`,
    methods: { cash: { words: ['bar', 'bargeld'], said: 'bar' }, card: { words: ['karte'], said: 'mit Karte' } },
    paid: 'Vielen Dank! Bis zum nächsten Mal!',
    cannotPay: 'Oh, das reicht leider nicht. Sie können auch später bezahlen.',
  },
};

/**
 * The cashier at the till: asks about a bag, then a points card, reads back the total and both, and takes payment.
 * Short of money, the customer can put something back, and the cashier reads back the new total.
 */
type TillScript = {
  greeting: string;
  resume: string;
  /** The bag question again, without the greeting. */
  askBag: string;
  askCard: string;
  readBack: (total: string, bag: boolean, card: boolean) => string;
  paid: string;
  cannotAfford: string;
  /** "Yes" and "no" to a bag or a points card. "No" is listened for first: "不要" holds "要". */
  words: Words;
};

const TILL_SCRIPT: Record<LanguageCode, TillScript> = {
  ja: {
    greeting: 'いらっしゃいませ。レジ袋はご利用ですか？',
    resume: '大変お待たせしました。レジ袋はご利用ですか？',
    askBag: 'レジ袋はご利用ですか？',
    askCard: 'ポイントカードはお持ちですか？',
    readBack: (total, bag, card) =>
      `合計${total}、レジ袋${bag ? 'あり' : 'なし'}、ポイントカード${card ? 'あり' : 'なし'}ですね。よろしいですか？`,
    paid: 'ありがとうございました！またお越しくださいませ。',
    cannotAfford: '申し訳ございません、お支払いが足りないようです。商品をお戻しになりますか？',
    words: {
      yes: [...SCRIPT.ja.words.yes, 'あります', 'ほしい'],
      no: [...SCRIPT.ja.words.no, 'いりません', 'ないです', 'ません', '大丈夫'],
      known: SCRIPT.ja.words.known,
    },
  },
  zh: {
    greeting: '欢迎光临！需要袋子吗？',
    resume: '让您久等了。需要袋子吗？',
    askBag: '需要袋子吗？',
    askCard: '您有会员卡吗？',
    readBack: (total, bag, card) => `一共${total}，${bag ? '要袋子' : '不要袋子'}，${card ? '有会员卡' : '没有会员卡'}，对吗？`,
    paid: '谢谢，欢迎下次光临！',
    cannotAfford: '不好意思，您的钱好像不够。要放回一些东西吗？',
    words: {
      yes: [...SCRIPT.zh.words.yes, '要', '需要', '有'],
      no: [...SCRIPT.zh.words.no, '没'],
      known: SCRIPT.zh.words.known,
    },
  },
  en: {
    greeting: 'Hiya! Do you need a bag?',
    resume: 'Sorry about that! Do you need a bag?',
    askBag: 'Do you need a bag?',
    askCard: 'Have you got a loyalty card?',
    readBack: (total, bag, card) =>
      `That's ${total}, ${bag ? 'with a bag' : 'no bag'}, and ${card ? 'your loyalty card' : 'no loyalty card'}. Is that right?`,
    paid: 'Lovely, there you go. Have a nice day!',
    cannotAfford: "Sorry, it looks like that's not enough. Do you want to put something back?",
    words: {
      yes: [...SCRIPT.en.words.yes, 'please', 'i have'],
      no: [...SCRIPT.en.words.no, "don't", 'not'],
      known: SCRIPT.en.words.known,
    },
  },
  de: {
    greeting: 'Hallo! Brauchen Sie eine Tüte?',
    resume: 'Entschuldigung! Brauchen Sie eine Tüte?',
    askBag: 'Brauchen Sie eine Tüte?',
    askCard: 'Haben Sie eine Kundenkarte?',
    readBack: (total, bag, card) =>
      `Das macht ${total}, ${bag ? 'mit Tüte' : 'ohne Tüte'}, ${card ? 'mit Kundenkarte' : 'ohne Kundenkarte'}, richtig?`,
    paid: 'Danke schön! Einen schönen Tag noch!',
    cannotAfford: 'Oh, das reicht leider nicht. Möchten Sie etwas zurücklegen?',
    words: {
      yes: [...SCRIPT.de.words.yes, 'bitte'],
      no: [...SCRIPT.de.words.no, 'keine', 'kein', 'nicht'],
      known: SCRIPT.de.words.known,
    },
  },
};

/** The cashier by the shelves: finds out which item, checks it, and points the way. */
type ShelvesScript = {
  greeting: string;
  resume: string;
  ask: string;
  readBack: (item: string) => string;
  shown: (item: string) => string;
  notSold: string;
};

const SHELVES_SCRIPT: Record<LanguageCode, ShelvesScript> = {
  ja: {
    greeting: 'いらっしゃいませ。何かお探しですか？',
    resume: 'お待たせしました。何かお探しですか？',
    ask: 'どの商品をお探しですか？',
    readBack: (item) => `${item}ですね？`,
    shown: (item) => `${item}はあちらの棚にございます。`,
    notSold: '申し訳ございません、それは置いていないんです。',
  },
  zh: {
    greeting: '欢迎光临！您在找什么？',
    resume: '让您久等了。您在找什么？',
    ask: '您要找什么东西？',
    readBack: (item) => `${item}，对吗？`,
    shown: (item) => `${item}在那边的货架上。`,
    notSold: '不好意思，我们没有卖这个。',
  },
  en: {
    greeting: 'Hiya! Are you looking for something?',
    resume: 'Sorry about that! What are you looking for?',
    ask: 'What are you looking for?',
    readBack: (item) => `${item}, is it?`,
    shown: (item) => `${item}: that shelf just over there.`,
    notSold: "Sorry, we don't sell that here.",
  },
  de: {
    greeting: 'Hallo! Suchen Sie etwas?',
    resume: 'Entschuldigung! Was suchen Sie?',
    ask: 'Was suchen Sie denn?',
    readBack: (item) => `${item}, richtig?`,
    shown: (item) => `${item} finden Sie dort drüben im Regal.`,
    notSold: 'Tut mir leid, das haben wir nicht.',
  },
};

/** The fake nurse on the Fainting ward, who speaks first as the Character wakes. */
type WardScript = {
  greeting: string;
  resume: string;
  /** Asks how the patient feels, for a line it understood that doesn't say. */
  ask: string;
  goodbye: string;
  notUnderstood: string;
  outOfPatience: string;
  /** Unwell is listened for first: "not well" is still unwell. */
  words: { unwell: string[]; well: string[]; known: string[] };
};

const WARD_SCRIPT: Record<LanguageCode, WardScript> = {
  ja: {
    greeting: 'あ、目が覚めましたね。気分はどうですか？',
    resume: 'お待たせしました。気分はどうですか？',
    ask: '気分はどうですか？大丈夫ですか？',
    goodbye: 'よかったです。もう帰っても大丈夫ですよ。ちゃんと食べてくださいね。',
    notUnderstood: 'すみません、よくわかりませんでした。',
    outOfPatience: 'すみません…。もう少し休んでいてくださいね。',
    words: {
      unwell: ['痛い', 'いたい', '気分が悪い', 'つらい', 'だるい'],
      well: ['大丈夫', 'だいじょうぶ', '元気', 'げんき', 'fine', 'ok'],
      known: ['はい', 'ありがとう', 'すみません', 'こんにちは', 'おはよう', 'hello'],
    },
  },
  zh: {
    greeting: '你醒了！感觉怎么样？',
    resume: '不好意思，久等了。你感觉怎么样？',
    ask: '你现在感觉怎么样？还好吗？',
    goodbye: '那就好。你可以回家了，要好好吃饭喝水哦。',
    notUnderstood: '不好意思，我没听懂。',
    outOfPatience: '不好意思……你先好好休息吧。',
    words: {
      unwell: ['不舒服', '疼', '难受', '不好'],
      well: ['好', '没事', '不错', 'fine', 'ok'],
      known: ['你好', '谢谢', '是', '对', 'hello'],
    },
  },
  en: {
    greeting: "Oh, you're awake! How are you feeling?",
    resume: 'Sorry about that. How are you feeling?',
    ask: 'How are you feeling now? Any better?',
    goodbye: 'Good. You can go home now. Make sure you eat and drink properly!',
    notUnderstood: "Sorry, I didn't catch that.",
    outOfPatience: "Sorry, I can't quite follow. Just rest a bit longer.",
    words: {
      unwell: ['not well', 'not good', 'bad', 'ill', 'sick', 'dizzy', 'unwell', 'poorly'],
      well: ['fine', 'good', 'better', 'okay', 'ok', 'alright', 'well'],
      known: ['hello', 'hi', 'yes', 'thanks', 'thank you', 'morning'],
    },
  },
  de: {
    greeting: 'Ah, Sie sind wach! Wie geht es Ihnen?',
    resume: 'Entschuldigung! Wie geht es Ihnen?',
    ask: 'Wie fühlen Sie sich jetzt?',
    goodbye: 'Schön. Sie dürfen nach Hause gehen. Essen und trinken Sie bitte genug!',
    notUnderstood: 'Entschuldigung, das habe ich nicht verstanden.',
    outOfPatience: 'Tut mir leid… Ruhen Sie sich noch etwas aus.',
    words: {
      unwell: ['nicht gut', 'schlecht', 'schwindlig', 'krank', 'weh'],
      well: ['gut', 'besser', 'okay', 'ok', 'prima'],
      known: ['hallo', 'guten', 'danke', 'ja', 'morgen', 'hello'],
    },
  },
};

/** The fake landlord: taking rent (asked to pay, or catching the tenant in the hallway), giving more time, or telling them their new rent. */
type LandlordScript = {
  /** Greets a tenant who has come to pay, with what they owe. */
  payGreeting: (owed: string) => string;
  /** Catches the tenant in the hallway with what they owe. */
  reminder: (owed: string) => string;
  nothingOwed: string;
  paid: string;
  cannotAfford: string;
  /** The tenant won't pay now. */
  later: string;
  askTime: string;
  readBackTime: (days: number) => string;
  timeGiven: string;
  news: (rent: string) => string;
  newsDone: string;
  resume: string;
  notUnderstood: string;
  outOfPatience: string;
};

const LANDLORD_SCRIPT: Record<LanguageCode, LandlordScript> = {
  ja: {
    payGreeting: (owed) => `こんにちは。家賃ですね。全部で${owed}です。お支払いになりますか？`,
    reminder: (owed) => `あ、ちょっといいですか。家賃がまだなんです。全部で${owed}です。今払えますか？`,
    nothingOwed: '今は払っていただくものはありませんよ。',
    paid: 'はい、確かに。ありがとうございます。',
    cannotAfford: 'あら、足りないみたいですね。一部だけでも大丈夫ですよ。',
    later: 'そうですか。待ってほしいときは、相談してくださいね。',
    askTime: 'どうしました？',
    readBackTime: (days) => `じゃあ、あと${days}日待ちましょう。いいですか？`,
    timeGiven: 'わかりました。それまでにお願いしますね。',
    news: (rent) => `ちょっといいですか。日本語、上手になりましたね。来週から家賃は${rent}になります。わかりましたか？`,
    newsDone: 'よろしくお願いしますね。',
    resume: 'すみません、どこまで話しましたっけ。',
    notUnderstood: 'すみません、よくわかりませんでした。',
    outOfPatience: 'すみません…。また今度話しましょう。',
  },
  zh: {
    payGreeting: (owed) => `你好，来交房租吧？一共${owed}。现在交吗？`,
    reminder: (owed) => `哎，等一下。你的房租还没交，一共${owed}。现在能交吗？`,
    nothingOwed: '你现在不欠房租。',
    paid: '好的，收到了，谢谢。',
    cannotAfford: '哎呀，好像钱不够。先交一部分也行。',
    later: '好吧。需要晚点交的话，跟我说一声。',
    askTime: '怎么了？',
    readBackTime: (days) => `那我再等你${days}天，行吗？`,
    timeGiven: '好，那到时候记得交。',
    news: (rent) => `等一下，你的中文进步真大！从下个星期开始，房租是${rent}。明白了吗？`,
    newsDone: '好，那就这样。',
    resume: '不好意思，我们说到哪儿了？',
    notUnderstood: '不好意思，我没听懂。',
    outOfPatience: '不好意思……下次再说吧。',
  },
  en: {
    payGreeting: (owed) => `Hello, love. Come about the rent? It's ${owed} altogether. Paying now?`,
    reminder: (owed) => `Oh, have you got a minute? Your rent's due and not paid yet: ${owed} altogether. Can you pay now?`,
    nothingOwed: "You don't owe me anything at the moment.",
    paid: "That's lovely, thank you.",
    cannotAfford: "Oh dear, that's not quite enough. A bit of it will do for now.",
    later: 'All right. If you need more time, just ask me.',
    askTime: 'What can I do for you?',
    readBackTime: (days) => `I'll give you ${days} more days, then. All right?`,
    timeGiven: "Right you are. Don't forget, will you?",
    news: (rent) => `Have you got a minute? Your English is ever so good now. From next week the rent's ${rent}. All right?`,
    newsDone: 'Lovely. Thanks, dear.',
    resume: 'Sorry, where were we?',
    notUnderstood: "Sorry, I didn't catch that.",
    outOfPatience: "Sorry, love, I can't quite follow. Another time.",
  },
  de: {
    payGreeting: (owed) => `Guten Tag! Wegen der Miete? Das sind insgesamt ${owed}. Zahlen Sie jetzt?`,
    reminder: (owed) => `Ach, haben Sie kurz Zeit? Die Miete ist noch offen: insgesamt ${owed}. Können Sie jetzt zahlen?`,
    nothingOwed: 'Sie schulden mir im Moment nichts.',
    paid: 'Danke schön, alles in Ordnung.',
    cannotAfford: 'Oh, das reicht leider nicht. Ein Teil davon geht auch.',
    later: 'Na gut. Wenn Sie mehr Zeit brauchen, fragen Sie mich einfach.',
    askTime: 'Was gibt’s?',
    readBackTime: (days) => `Dann warte ich noch ${days} Tage. Einverstanden?`,
    timeGiven: 'Gut. Aber dann bitte pünktlich.',
    news: (rent) => `Haben Sie kurz Zeit? Ihr Deutsch ist richtig gut geworden. Ab nächster Woche kostet die Miete ${rent}. Verstanden?`,
    newsDone: 'Gut, danke.',
    resume: 'Entschuldigung, wo waren wir?',
    notUnderstood: 'Entschuldigung, das habe ich nicht verstanden.',
    outOfPatience: 'Tut mir leid… Ein andermal.',
  },
};

/** When an applicant can start, as `hire_applicant` takes it. */
type StartWhen = (typeof START_WHEN)[number];

/** The fake barista hiring: asks the name, then when they can start, and reads both back. */
type HiringScript = {
  /** Words that ask for work. */
  work: string[];
  askName: string;
  askStart: (name: string) => string;
  readBack: (name: string, start: string) => string;
  hired: string;
  nameAgain: string;
  /** Said around a name ("my name is"), and taken off to leave the name. */
  introductions: string[];
  /** How the Player might say each start, and how the barista says it back. */
  starts: Record<StartWhen, { words: string[]; said: string }>;
};

const HIRING_SCRIPT: Record<LanguageCode, HiringScript> = {
  ja: {
    work: ['仕事', 'しごと', '働き', 'はたらき', 'バイト', 'job', 'work'],
    askName: 'あ、アルバイトですね！お名前は？',
    askStart: (name) => `${name}さんですね。いつから働けますか？`,
    readBack: (name, start) => `${name}さん、${start}からですね。よろしいですか？`,
    hired: '採用です！働くときは、営業中にスタッフ用のドアから来てくださいね。',
    nameAgain: 'すみません、お名前をもう一度ゆっくりお願いします。',
    introductions: ['私の名前は', 'わたしのなまえは', '名前は', 'なまえは', '私は', 'わたしは', 'と申します', 'といいます', 'です', 'さん'],
    starts: {
      today: { words: ['今日', 'きょう'], said: '今日' },
      tomorrow: { words: ['明日', 'あした', 'あす'], said: '明日' },
      this_week: { words: ['今週', 'こんしゅう'], said: '今週' },
      next_week: { words: ['来週', 'らいしゅう'], said: '来週' },
    },
  },
  zh: {
    work: ['工作', '打工', '招人', 'job', 'work'],
    askName: '哦，你想来工作？你叫什么名字？',
    askStart: (name) => `${name}，对吧？你什么时候能开始？`,
    readBack: (name, start) => `${name}，${start}开始。对吗？`,
    hired: '好，你被录用了！营业时间从员工门进来就可以上班。',
    nameAgain: '不好意思，请再慢慢说一遍你的名字。',
    introductions: ['我的名字是', '我的名字叫', '我叫', '我是'],
    starts: {
      today: { words: ['今天'], said: '今天' },
      tomorrow: { words: ['明天'], said: '明天' },
      this_week: { words: ['这个星期', '这周', '本周'], said: '这个星期' },
      next_week: { words: ['下个星期', '下周'], said: '下个星期' },
    },
  },
  en: {
    work: ['job', 'jobs', 'work', 'hiring'],
    askName: "Oh, you're after a job? Lovely. What's your name?",
    askStart: (name) => `${name}, is it? When can you start?`,
    readBack: (name, start) => `So that's ${name}, starting ${start}. Right?`,
    hired: "You're hired! Just come in through the staff door whenever we're open.",
    nameAgain: 'Sorry, I think I got your name wrong. Could you say it again, slowly?',
    introductions: ['my name is', "my name's", "i'm", 'i am', "it's", 'it is', 'call me'],
    starts: {
      today: { words: ['today'], said: 'today' },
      tomorrow: { words: ['tomorrow'], said: 'tomorrow' },
      this_week: { words: ['this week'], said: 'this week' },
      next_week: { words: ['next week'], said: 'next week' },
    },
  },
  de: {
    work: ['arbeit', 'job', 'stelle', 'arbeiten'],
    askName: 'Ach, Sie suchen Arbeit? Wie heißen Sie?',
    askStart: (name) => `${name}, richtig? Ab wann können Sie anfangen?`,
    readBack: (name, start) => `Also ${name}, ab ${start}. Stimmt das?`,
    hired: 'Sie sind eingestellt! Kommen Sie einfach durch die Personaltür, wenn wir geöffnet haben.',
    nameAgain: 'Entschuldigung, wie war Ihr Name noch mal? Bitte langsam.',
    introductions: ['mein name ist', 'ich heiße', 'ich bin'],
    starts: {
      today: { words: ['heute'], said: 'heute' },
      tomorrow: { words: ['morgen'], said: 'morgen' },
      this_week: { words: ['diese woche'], said: 'dieser Woche' },
      next_week: { words: ['nächste woche'], said: 'nächster Woche' },
    },
  },
};

const LATIN = /^[\p{Script=Latin}\s']+$/u;

/** Whole words for Latin-script words ("no" isn't in "know"); anywhere in the line otherwise. */
function mentions(line: string, words: readonly string[]) {
  const lower = line.toLowerCase();
  return words.some((word) =>
    LATIN.test(word) ? new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, 'iu').test(lower) : lower.includes(word),
  );
}

/** The items a session's completion function takes, read from its tool declaration. */
function itemsIn(session: NpcSession, toolName: string): ItemId[] {
  const parameters = session.tools.find((tool) => tool.name === toolName)?.parameters;
  const item = parameters?.properties?.items?.items?.properties?.item ?? parameters?.properties?.item;
  return (item?.enum ?? []) as ItemId[];
}

/** What a scripted NPC can do: speak, call a tool and act on the answer, or drop the connection. */
type Act = {
  say: (line: string) => void;
  call: (name: string, args: unknown, onAnswer: (response: ToolResponse) => void) => void;
  drop: () => void;
  notUnderstood: () => void;
};

/** A scripted NPC: what it says first, and how it answers each line the Player types. */
type Npc = { greeting: string; resume: string; outOfPatience: string; notUnderstood: string; hear: (line: string) => void };

/** An order read back and taken over a counter, completed with `toolName`: serve_order, or the bookshop's complete_purchase. */
function orderNpc(script: OrderScript, menu: ItemId[], packId: LanguageCode, act: Act, toolName = SERVE_ORDER): Npc {
  let clarifications = 0;
  let readBack: ItemId | null = null;
  return {
    ...script,
    hear: (line) => {
      const item = menu.find((id) => mentions(line, ITEM_WORDS[packId][id]));
      if (item) {
        readBack = item;
        const { name } = CULTURE_PACKS[packId].goods[item];
        return act.say(script.readBack(name, script.price(localPrice(ITEMS[item].priceInShifts, packId))));
      }
      const { yes, no, known } = script.words;
      if (readBack && mentions(line, no)) {
        readBack = null;
        return act.say(script.askAgain);
      }
      if (readBack && mentions(line, yes)) {
        const order = { items: [{ item: readBack, quantity: 1 }] };
        readBack = null;
        return act.call(toolName, order, (response) => {
          if (response.result === 'served') act.say(script.served);
          else if (response.result === 'cannot_afford') act.say(script.cannotAfford);
          else act.say(script.askAgain);
        });
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(script.clarify[clarifications++ % script.clarify.length]!);
      act.notUnderstood();
    },
  };
}

function giftNpc(script: GiftScript, common: OrderScript, gifts: ItemId[], packId: LanguageCode, act: Act): Npc {
  let gift: ItemId | null = null;
  let wrap: boolean | null = null;
  const { yes, no, known } = common.words;
  const name = (item: ItemId) => CULTURE_PACKS[packId].goods[item].name;
  const readBack = (item: ItemId, wrapped: boolean) =>
    script.readBack(name(item), common.price(localPrice(ITEMS[item].priceInShifts, packId)), wrapped);
  /** Asks again whatever is still to be answered, or reads everything back. */
  const currentQuestion = () => (gift === null ? script.clarify : wrap === null ? script.askWrap(name(gift)) : readBack(gift, wrap));
  return {
    ...common,
    ...script,
    hear: (line) => {
      const asked = gifts.find((id) => mentions(line, ITEM_WORDS[packId][id]));
      if (asked) {
        [gift, wrap] = [asked, null];
        return act.say(script.askWrap(name(asked)));
      }
      // "No" first: "不要" holds "要", and "no thanks" holds "thanks".
      const answer = mentions(line, no) ? false : mentions(line, yes) ? true : null;
      if (answer === null || gift === null) return mentions(line, [...yes, ...no, ...known]) ? act.say(currentQuestion()) : act.notUnderstood();
      if (wrap === null) {
        wrap = answer;
        return act.say(readBack(gift, wrap));
      }
      if (!answer) {
        [gift, wrap] = [null, null];
        return act.say(script.clarify);
      }
      const sale = { items: [{ item: gift, quantity: 1 }], wrap };
      [gift, wrap] = [null, null];
      act.call(COMPLETE_PURCHASE, sale, (response) => {
        if (response.result === 'served') act.say(script.served);
        else if (response.result === 'cannot_afford') act.say(script.cannotAfford);
        else act.say(script.clarify);
      });
    },
  };
}

/** The bathhouse attendant: lets a bather in (#21), asking about a towel first, or signs up or renews a gym member (#22). */
type AttendantScript = {
  bathGreeting: string;
  joinGreeting: string;
  /** Renewing, the attendant reads the membership back as it greets. */
  renewGreeting: (membership: string, price: string) => string;
  resume: string;
  askTowel: string;
  readBackBath: (entry: string, price: string, towel: boolean) => string;
  admitted: string;
  clarifyBath: string;
  readBackMembership: (membership: string, price: string) => string;
  registered: string;
  clarifyGym: string;
  cannotAfford: string;
};

const ATTENDANT_SCRIPT: Record<LanguageCode, AttendantScript> = {
  ja: {
    bathGreeting: 'いらっしゃいませ。お風呂ですか？',
    joinGreeting: 'いらっしゃいませ。ジムのご案内ですか？',
    renewGreeting: (membership, price) => `いらっしゃいませ。ジムの会員期限が切れていますね。${membership}、${price}で更新なさいますか？`,
    resume: 'お待たせしました。ご用件をどうぞ。',
    askTowel: 'タオルはお使いになりますか？',
    readBackBath: (entry, price, towel) => `${entry}、${price}、タオル${towel ? 'あり' : 'なし'}ですね。よろしいですか？`,
    admitted: 'ありがとうございます。どうぞごゆっくり。',
    clarifyBath: 'お風呂になさいますか？',
    readBackMembership: (membership, price) => `${membership}は${price}です。ジムは一日一回ご利用いただけます。よろしいですか？`,
    registered: 'ご登録ありがとうございます。今日からジムをご利用いただけます。',
    clarifyGym: 'ジムの会員になさいますか？',
    cannotAfford: '申し訳ございません、お支払いが足りないようです。',
  },
  zh: {
    bathGreeting: '欢迎光临！您要洗澡吗？',
    joinGreeting: '欢迎光临！您想了解健身房吗？',
    renewGreeting: (membership, price) => `欢迎光临！您的健身房会员到期了。${membership}，${price}，要续办吗？`,
    resume: '让您久等了。您需要什么？',
    askTowel: '需要毛巾吗？',
    readBackBath: (entry, price, towel) => `${entry}，${price}，${towel ? '要毛巾' : '不要毛巾'}，对吗？`,
    admitted: '好的，请进。祝您泡得舒服！',
    clarifyBath: '您要洗澡吗？',
    readBackMembership: (membership, price) => `${membership}，${price}。每天可以健身一次。对吗？`,
    registered: '办好了！今天就可以去健身房了。',
    clarifyGym: '您要办健身卡吗？',
    cannotAfford: '不好意思，您的钱好像不够。',
  },
  en: {
    bathGreeting: 'Hiya! Here for a swim and a steam?',
    joinGreeting: 'Hiya! Interested in the gym?',
    renewGreeting: (membership, price) => `Hiya! Your gym membership has run out, I'm afraid. ${membership} is ${price}. Shall I renew it?`,
    resume: 'Sorry about that! What can I do for you?',
    askTowel: 'Would you like to borrow a towel?',
    readBackBath: (entry, price, towel) => `${entry}, that's ${price}, ${towel ? 'with a towel' : 'no towel'}. Is that right?`,
    admitted: 'Lovely. Enjoy your swim!',
    clarifyBath: 'Are you here for a swim and a steam?',
    readBackMembership: (membership, price) => `${membership} is ${price}, and you can use the gym once a day. Shall I sign you up?`,
    registered: "You're all signed up. The gym's just by the door!",
    clarifyGym: 'Would you like to join the gym?',
    cannotAfford: "Sorry, it looks like that's not enough.",
  },
  de: {
    bathGreeting: 'Hallo! Einmal Bad und Sauna?',
    joinGreeting: 'Hallo! Interessieren Sie sich für das Fitnessstudio?',
    renewGreeting: (membership, price) => `Hallo! Ihre Mitgliedschaft ist leider abgelaufen. ${membership} kostet ${price}. Soll ich sie verlängern?`,
    resume: 'Entschuldigung! Was kann ich für Sie tun?',
    askTowel: 'Möchten Sie ein Handtuch leihen?',
    readBackBath: (entry, price, towel) => `${entry} für ${price}, ${towel ? 'mit Handtuch' : 'ohne Handtuch'}, richtig?`,
    admitted: 'Bitte schön! Viel Spaß beim Entspannen!',
    clarifyBath: 'Möchten Sie ins Bad?',
    readBackMembership: (membership, price) => `${membership} für ${price}, Training einmal am Tag. Soll ich Sie anmelden?`,
    registered: 'Sie sind angemeldet! Das Fitnessstudio ist gleich am Eingang.',
    clarifyGym: 'Möchten Sie Mitglied werden?',
    cannotAfford: 'Oh, das reicht leider nicht.',
  },
};

/** The local name and price of what the attendant sells, as it reads them back. */
function soldAtTheDesk(itemId: ItemId, common: OrderScript, packId: LanguageCode) {
  return { name: CULTURE_PACKS[packId].goods[itemId].name, price: common.price(localPrice(ITEMS[itemId].priceInShifts, packId)) };
}

/** #21: a yes or the bath asked for gets the towel question, its answer the read-back, and a yes to that lets the bather in. */
function bathNpc(script: AttendantScript, common: OrderScript, packId: LanguageCode, act: Act): Npc {
  let bath = false;
  let towel: boolean | null = null;
  const { yes, no, known } = common.words;
  const entry = soldAtTheDesk('bath-entry', common, packId);
  /** Asks again whatever is still to be answered, or reads everything back. */
  const currentQuestion = () => (!bath ? script.clarifyBath : towel === null ? script.askTowel : script.readBackBath(entry.name, entry.price, towel));
  return {
    ...common,
    greeting: script.bathGreeting,
    resume: script.resume,
    hear: (line) => {
      if (!bath && mentions(line, ITEM_WORDS[packId]['bath-entry'])) {
        bath = true;
        return act.say(script.askTowel);
      }
      // "No" first: "不要" holds "要", and "no thanks" holds "thanks".
      const answer = mentions(line, no) ? false : mentions(line, yes) ? true : null;
      if (answer === null) return mentions(line, known) ? act.say(currentQuestion()) : act.notUnderstood();
      if (!bath) {
        if (!answer) return act.say(script.clarifyBath);
        bath = true;
        return act.say(script.askTowel);
      }
      if (towel === null) {
        towel = answer;
        return act.say(currentQuestion());
      }
      if (!answer) {
        [bath, towel] = [false, null];
        return act.say(script.clarifyBath);
      }
      const options = towel ? ['towel'] : [];
      [bath, towel] = [false, null];
      act.call(ADMIT, { options }, (response) => {
        if (response.result === 'done') act.say(script.admitted);
        else if (response.result === 'cannot_afford') act.say(script.cannotAfford);
        else act.say(script.clarifyBath);
      });
    },
  };
}

/** #22: reads back the membership and its price, and signs up or renews on a yes. Renewing, the greeting is the read-back. */
function memberNpc(script: AttendantScript, common: OrderScript, packId: LanguageCode, renewing: boolean, act: Act): Npc {
  let readBack = renewing;
  const { yes, no, known } = common.words;
  const membership = soldAtTheDesk('gym-membership', common, packId);
  const readBackLine = script.readBackMembership(membership.name, membership.price);
  return {
    ...common,
    greeting: renewing ? script.renewGreeting(membership.name, membership.price) : script.joinGreeting,
    resume: script.resume,
    hear: (line) => {
      const answer = mentions(line, no) ? false : mentions(line, yes) ? true : null;
      if (answer === false) {
        readBack = false;
        return act.say(script.clarifyGym);
      }
      if (!readBack && (answer || mentions(line, ITEM_WORDS[packId]['gym-membership']))) {
        readBack = true;
        return act.say(readBackLine);
      }
      if (answer) {
        readBack = renewing;
        return act.call(REGISTER_MEMBER, { kind: renewing ? 'renew' : 'join' }, (response) => {
          if (response.result === 'done') act.say(script.registered);
          else if (response.result === 'cannot_afford') act.say(script.cannotAfford);
          else act.say(script.clarifyGym);
        });
      }
      if (mentions(line, known)) return act.say(readBack ? readBackLine : script.clarifyGym);
      act.notUnderstood();
    },
  };
}

/** How each pack's Player might describe each symptom. */
const SYMPTOM_WORDS: Record<LanguageCode, Record<SymptomId, string[]>> = {
  ja: {
    cough: ['咳', 'せき'],
    'sore-throat': ['喉', 'のど'],
    'runny-nose': ['鼻水', 'はなみず'],
    fever: ['熱', 'ねつ'],
    'body-aches': ['節々', 'ふしぶし', '体が痛', 'からだが痛'],
    chills: ['寒気', 'さむけ'],
    'stomach-ache': ['お腹', 'おなか', '腹痛'],
    nausea: ['吐き気', 'はきけ'],
    sneezing: ['くしゃみ'],
    'itchy-eyes': ['目がかゆ', '目が痒'],
  },
  zh: {
    cough: ['咳嗽'],
    'sore-throat': ['嗓子', '喉咙'],
    'runny-nose': ['鼻涕'],
    fever: ['发烧', '发热'],
    'body-aches': ['浑身疼', '全身疼', '身上疼'],
    chills: ['发冷'],
    'stomach-ache': ['肚子疼', '胃疼'],
    nausea: ['恶心', '想吐'],
    sneezing: ['喷嚏'],
    'itchy-eyes': ['眼睛痒'],
  },
  en: {
    cough: ['cough', 'coughing'],
    'sore-throat': ['sore throat', 'throat'],
    'runny-nose': ['runny nose', 'nose'],
    fever: ['fever', 'temperature'],
    'body-aches': ['aches', 'aching'],
    chills: ['chills', 'shivering', 'shivery'],
    'stomach-ache': ['stomach', 'tummy'],
    nausea: ['nausea', 'nauseous', 'throw up', 'sick'],
    sneezing: ['sneeze', 'sneezing'],
    'itchy-eyes': ['itchy eyes', 'eyes'],
  },
  de: {
    cough: ['husten'],
    'sore-throat': ['halsschmerzen', 'hals'],
    'runny-nose': ['schnupfen', 'nase'],
    fever: ['fieber'],
    'body-aches': ['gliederschmerzen', 'glieder'],
    chills: ['schüttelfrost', 'friere'],
    'stomach-ache': ['bauchschmerzen', 'bauch', 'magen'],
    nausea: ['übel', 'übelkeit'],
    sneezing: ['niesen'],
    'itchy-eyes': ['augen'],
  },
};

/** The symptoms a line describes, in the order the game lists them. */
const symptomsIn = (line: string, packId: LanguageCode) => SYMPTOM_IDS.filter((id) => mentions(line, SYMPTOM_WORDS[packId][id]));

/** The fake clinic staff: reception (#12, #15), the doctor (#13) and the pharmacist (#14). */
type ClinicScript = {
  receptionGreeting: string;
  /** Words for wanting to see the doctor, besides any symptom. */
  unwell: string[];
  readBackCheckIn: string;
  checkedIn: string;
  clarifyCheckIn: string;
  doctorGreeting: string;
  askSymptoms: string;
  readBackDiagnosis: (illness: string) => string;
  diagnosed: string;
  illnesses: Record<IllnessId, string>;
  pharmacyGreeting: (medicine: string, price: string) => string;
  noPrescription: string;
  dispensed: string;
  billGreeting: (owed: string) => string;
  /** Words for paying the whole bill now. */
  all: string[];
  readBackAll: (owed: string) => string;
  readBackWeeks: (weeks: number) => string;
  settled: string;
  clarifyBill: string;
  cannotAfford: string;
  resume: string;
};

const CLINIC_SCRIPT: Record<LanguageCode, ClinicScript> = {
  ja: {
    receptionGreeting: 'こんにちは。今日はどうされましたか？',
    unwell: ['診察', '先生', '具合', '医者'],
    readBackCheckIn: '診察ですね。受付しますね。よろしいですか？',
    checkedIn: '受付しました。待合室でお待ちください。お名前をお呼びします。',
    clarifyCheckIn: '今日はどうされましたか？',
    doctorGreeting: 'どうぞ、お入りください。今日はどうしましたか？',
    askSymptoms: 'どんな症状がありますか？',
    readBackDiagnosis: (illness) => `${illness}ですね。お薬を出しておきます。わかりましたか？`,
    diagnosed: 'お大事に。お薬は薬局で受け取ってください。',
    illnesses: { cold: '風邪', flu: 'インフルエンザ', 'food-poisoning': '食中毒', 'hay-fever': '花粉症' },
    pharmacyGreeting: (medicine, price) => `こんにちは。${medicine}ですね。${price}です。よろしいですか？`,
    noPrescription: 'すみません、処方箋がないとお薬はお出しできません。',
    dispensed: 'こちらです。お大事にどうぞ。',
    billGreeting: (owed) => `病院のお支払いが${owed}残っています。一括にしますか、分割にしますか？`,
    all: ['一括', '全部', 'ぜんぶ', 'いっかつ'],
    readBackAll: (owed) => `では、${owed}を一括でお支払いですね。よろしいですか？`,
    readBackWeeks: (weeks) => `では、${weeks}週間の分割ですね。家賃の日に引き落とします。よろしいですか？`,
    settled: 'ありがとうございました。お大事に。',
    clarifyBill: '一括にしますか、分割にしますか？',
    cannotAfford: '申し訳ございません、お支払いが足りないようです。分割もできますよ。',
    resume: 'お待たせしました。どうぞ。',
  },
  zh: {
    receptionGreeting: '您好，今天哪里不舒服？',
    unwell: ['看病', '医生', '不舒服'],
    readBackCheckIn: '您要看医生，对吗？我给您挂号。',
    checkedIn: '挂好号了。请在候诊室等一下，到时候会叫您的名字。',
    clarifyCheckIn: '您今天哪里不舒服？',
    doctorGreeting: '请进，请坐。今天哪里不舒服？',
    askSymptoms: '您有什么症状？',
    readBackDiagnosis: (illness) => `您这是${illness}。我给您开点药。明白了吗？`,
    diagnosed: '多休息。去药房拿药吧。',
    illnesses: { cold: '感冒', flu: '流感', 'food-poisoning': '食物中毒', 'hay-fever': '花粉过敏' },
    pharmacyGreeting: (medicine, price) => `您好。${medicine}，${price}。对吗？`,
    noPrescription: '不好意思，没有处方我不能给您药。',
    dispensed: '给您。祝您早日康复！',
    billGreeting: (owed) => `您还欠医院${owed}。一次付清，还是分期付款？`,
    all: ['全部', '一次', '付清'],
    readBackAll: (owed) => `好的，一次付清${owed}，对吗？`,
    readBackWeeks: (weeks) => `好的，分${weeks}周付，每周交房租那天扣款，对吗？`,
    settled: '好的，谢谢您。多保重！',
    clarifyBill: '您想一次付清，还是分期？',
    cannotAfford: '不好意思，您的钱好像不够。也可以分期付。',
    resume: '让您久等了。请说吧。',
  },
  en: {
    receptionGreeting: 'Hello there. What brings you in today?',
    unwell: ['doctor', 'unwell', 'ill', 'poorly', 'appointment'],
    readBackCheckIn: "Right, you'd like to see the doctor about that. Shall I check you in?",
    checkedIn: "You're checked in. Take a seat in the waiting room, and the doctor will call your name.",
    clarifyCheckIn: 'What brings you in today?',
    doctorGreeting: 'Come in, have a seat. What seems to be the trouble?',
    askSymptoms: 'What symptoms have you got?',
    readBackDiagnosis: (illness) => `It sounds like ${illness}. I'll write you a prescription. Does that make sense?`,
    diagnosed: 'Take care. Pick your medicine up at the pharmacy.',
    illnesses: { cold: 'a cold', flu: 'flu', 'food-poisoning': 'food poisoning', 'hay-fever': 'hay fever' },
    pharmacyGreeting: (medicine, price) => `Hello. ${medicine}, that's ${price}. Is that right?`,
    noPrescription: "Sorry, I can't give you anything without a prescription.",
    dispensed: 'Here you are. Hope you feel better soon!',
    billGreeting: (owed) => `You owe the hospital ${owed}. Would you like to pay it all now, or in weekly instalments?`,
    all: ['all', 'in full', 'everything'],
    readBackAll: (owed) => `So that's ${owed}, all paid now. Is that right?`,
    readBackWeeks: (weeks) => `So that's ${weeks} weekly instalments, taken on rent day. Is that right?`,
    settled: 'Thank you. Take care!',
    clarifyBill: 'Would you like to pay it all now, or in weekly instalments?',
    cannotAfford: "Sorry, it looks like that's not enough. You could pay in instalments.",
    resume: 'Sorry about that. Go on.',
  },
  de: {
    receptionGreeting: 'Guten Tag. Was führt Sie zu uns?',
    unwell: ['arzt', 'ärztin', 'krank', 'termin'],
    readBackCheckIn: 'Sie möchten also zum Arzt. Soll ich Sie anmelden?',
    checkedIn: 'Sie sind angemeldet. Bitte nehmen Sie im Wartezimmer Platz, wir rufen Sie auf.',
    clarifyCheckIn: 'Was führt Sie zu uns?',
    doctorGreeting: 'Kommen Sie herein, setzen Sie sich. Was fehlt Ihnen?',
    askSymptoms: 'Welche Beschwerden haben Sie?',
    readBackDiagnosis: (illness) => `Das klingt nach ${illness}. Ich schreibe Ihnen ein Rezept. Haben Sie das verstanden?`,
    diagnosed: 'Gute Besserung! Das Medikament bekommen Sie in der Apotheke.',
    illnesses: { cold: 'einer Erkältung', flu: 'einer Grippe', 'food-poisoning': 'einer Lebensmittelvergiftung', 'hay-fever': 'Heuschnupfen' },
    pharmacyGreeting: (medicine, price) => `Guten Tag. ${medicine} für ${price}, richtig?`,
    noPrescription: 'Tut mir leid, ohne Rezept kann ich Ihnen nichts geben.',
    dispensed: 'Bitte schön. Gute Besserung!',
    billGreeting: (owed) => `Sie schulden dem Krankenhaus ${owed}. Möchten Sie alles sofort zahlen oder in Wochenraten?`,
    all: ['alles', 'sofort', 'komplett'],
    readBackAll: (owed) => `Also ${owed}, alles sofort bezahlt, richtig?`,
    readBackWeeks: (weeks) => `Also ${weeks} Wochenraten, jeweils am Miettag abgebucht, richtig?`,
    settled: 'Vielen Dank. Gute Besserung!',
    clarifyBill: 'Möchten Sie alles sofort zahlen oder in Wochenraten?',
    cannotAfford: 'Oh, das reicht leider nicht. Sie können auch in Raten zahlen.',
    resume: 'Entschuldigung! Bitte sprechen Sie weiter.',
  },
};

/** #12: hears why the Player has come (a symptom, or wanting the doctor), reads it back and checks them in on a yes. */
function receptionNpc(script: ClinicScript, common: OrderScript, packId: LanguageCode, act: Act): Npc {
  let reason: string | null = null;
  const { yes, no, known } = common.words;
  return {
    ...common,
    greeting: script.receptionGreeting,
    resume: script.resume,
    hear: (line) => {
      const symptoms = symptomsIn(line, packId);
      if (symptoms.length > 0 || mentions(line, script.unwell)) {
        reason = symptoms.length > 0 ? symptoms.map((id) => id.replaceAll('-', ' ')).join(', ') : 'feeling unwell';
        return act.say(script.readBackCheckIn);
      }
      if (reason && mentions(line, no)) {
        reason = null;
        return act.say(script.clarifyCheckIn);
      }
      if (reason && mentions(line, yes)) {
        const args = { reason };
        reason = null;
        return act.call(REGISTER_PATIENT, args, (response) => act.say(response.result === 'done' ? script.checkedIn : script.clarifyCheckIn));
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(reason ? script.readBackCheckIn : script.clarifyCheckIn);
      act.notUnderstood();
    },
  };
}

/** #13: hears symptoms, names the Illness most of them fit, and diagnoses it once the Player says they've understood. */
function doctorNpc(script: ClinicScript, common: OrderScript, packId: LanguageCode, act: Act): Npc {
  let found: IllnessId | null = null;
  const { yes, no, known } = common.words;
  return {
    ...common,
    greeting: script.doctorGreeting,
    resume: script.resume,
    hear: (line) => {
      const symptoms = symptomsIn(line, packId);
      if (symptoms.length > 0) {
        const fits = (id: IllnessId) => ILLNESSES[id].symptoms.filter((symptom) => symptoms.includes(symptom)).length;
        found = ILLNESS_IDS.reduce((best, id) => (fits(id) > fits(best) ? id : best));
        return act.say(script.readBackDiagnosis(script.illnesses[found]));
      }
      if (found && mentions(line, no)) {
        found = null;
        return act.say(script.askSymptoms);
      }
      if (found && mentions(line, yes)) {
        const args = { illness: found };
        found = null;
        return act.call(DIAGNOSE, args, (response) => act.say(response.result === 'done' ? script.diagnosed : script.askSymptoms));
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(found ? script.readBackDiagnosis(script.illnesses[found]) : script.askSymptoms);
      act.notUnderstood();
    },
  };
}

/** #14: reads back the prescription in FACTS as it greets, and dispenses it on a yes. With none, it can only say so. */
function pharmacyNpc(script: ClinicScript, common: OrderScript, systemInstruction: string, packId: LanguageCode, act: Act): Npc {
  const prescription = readPrescription(systemInstruction);
  const { yes, no, known } = common.words;
  const medicine = prescription && { name: CULTURE_PACKS[packId].goods[prescription].name, price: common.price(localPrice(ITEMS[prescription].priceInShifts, packId)) };
  const readBack = medicine ? script.pharmacyGreeting(medicine.name, medicine.price) : script.noPrescription;
  return {
    ...common,
    greeting: readBack,
    resume: script.resume,
    hear: (line) => {
      if (prescription && mentions(line, yes) && !mentions(line, no)) {
        return act.call(DISPENSE, { medicine: prescription }, (response) => {
          if (response.result === 'served') act.say(script.dispensed);
          else if (response.result === 'cannot_afford') act.say(common.cannotAfford);
          else act.say(readBack);
        });
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(readBack);
      act.notUnderstood();
    },
  };
}

/** #15: says what is owed as it greets, hears "all now" or a number of weeks, reads it back and settles it on a yes. */
function hospitalBillNpc(script: ClinicScript, common: OrderScript, systemInstruction: string, act: Act): Npc {
  const owed = readHospitalOwed(systemInstruction) ?? '';
  let weeks: number | null = null;
  const { yes, no, known } = common.words;
  const readBack = (n: number) => (n === 0 ? script.readBackAll(owed) : script.readBackWeeks(n));
  return {
    ...common,
    greeting: script.billGreeting(owed),
    resume: script.resume,
    hear: (line) => {
      const inWeeks = Number(/\d+/.exec(line)?.[0] ?? NaN);
      if (inWeeks >= 1 && inWeeks <= ECONOMY.maxPaymentPlanWeeks) {
        weeks = inWeeks;
        return act.say(readBack(weeks));
      }
      if (mentions(line, script.all)) {
        weeks = 0;
        return act.say(readBack(weeks));
      }
      if (weeks !== null && mentions(line, no)) {
        weeks = null;
        return act.say(script.clarifyBill);
      }
      if (weeks !== null && mentions(line, yes)) {
        const args = { weeks };
        weeks = null;
        return act.call(SET_PAYMENT_PLAN, args, (response) => {
          if (response.result === 'done') act.say(script.settled);
          else if (response.result === 'cannot_afford') act.say(script.cannotAfford);
          else act.say(script.clarifyBill);
        });
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(weeks === null ? script.clarifyBill : readBack(weeks));
      act.notUnderstood();
    },
  };
}

function tillNpc(script: TillScript, common: OrderScript, systemInstruction: string, act: Act): Npc {
  let bag: boolean | null = null;
  let card: boolean | null = null;
  // The total from FACTS, until a scene says something was put back.
  let total = readBasketTotal(systemInstruction) ?? '';
  const { yes, no, known } = script.words;
  /** Asks again whatever is still to be answered, or reads everything back. */
  const currentQuestion = () => (bag === null ? script.askBag : card === null ? script.askCard : script.readBack(total, bag, card));
  return {
    ...common,
    ...script,
    hear: (line) => {
      const newTotal = line.startsWith('[SCENE:') ? readBasketTotal(line) : null;
      if (newTotal) {
        total = newTotal;
        return act.say(currentQuestion());
      }
      // "No" first: "不要" holds "要", and "no thanks" holds "thanks".
      const answer = mentions(line, no) ? false : mentions(line, yes) ? true : null;
      if (answer === null) return mentions(line, known) ? act.say(currentQuestion()) : act.notUnderstood();
      if (bag === null) {
        bag = answer;
        return act.say(script.askCard);
      }
      if (card === null) {
        card = answer;
        return act.say(script.readBack(total, bag, card));
      }
      if (!answer) {
        [bag, card] = [null, null];
        return act.say(script.greeting);
      }
      const choices = { bag, card };
      [bag, card] = [null, null];
      act.call(COMPLETE_PURCHASE, choices, (response) => {
        if (response.result === 'served') return act.say(script.paid);
        if (response.result !== 'cannot_afford') return act.say(script.greeting);
        // The choices stand while the customer puts something back.
        ({ bag, card } = choices);
        act.say(script.cannotAfford);
      });
    },
  };
}

function shelvesNpc(script: ShelvesScript, common: OrderScript, shelves: ItemId[], packId: LanguageCode, act: Act): Npc {
  let readBack: ItemId | null = null;
  const name = (item: ItemId) => CULTURE_PACKS[packId].goods[item].name;
  const { yes, no, known } = common.words;
  return {
    ...common,
    ...script,
    hear: (line) => {
      const item = shelves.find((id) => mentions(line, ITEM_WORDS[packId][id]));
      if (item) {
        readBack = item;
        return act.say(script.readBack(name(item)));
      }
      const sellsElsewhere = (Object.keys(ITEM_WORDS[packId]) as ItemId[]).some((id) => mentions(line, ITEM_WORDS[packId][id]));
      if (sellsElsewhere) return act.say(script.notSold);
      if (readBack && mentions(line, no)) {
        readBack = null;
        return act.say(script.ask);
      }
      if (readBack && mentions(line, yes)) {
        const shown = readBack;
        readBack = null;
        return act.call(POINT_TO, { item: shown }, (response) => act.say(response.result === 'done' ? script.shown(name(shown)) : script.ask));
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(script.ask);
      act.notUnderstood();
    },
  };
}

function wardNpc(ward: WardScript, act: Act): Npc {
  return {
    ...ward,
    hear: (line) => {
      const { unwell, well, known } = ward.words;
      const feeling = mentions(line, unwell) ? 'unwell' : mentions(line, well) ? 'well' : null;
      if (feeling) return act.call(DISCHARGE_PATIENT, { feeling }, (response) => act.say(response.result === 'done' ? ward.goodbye : ward.ask));
      if (mentions(line, known)) return act.say(ward.ask);
      act.notUnderstood();
    },
  };
}

/** The server seating a guest: asks how many, then where, reads both back and seats them on a yes. */
function tableNpc(script: ServerScript, common: OrderScript, act: Act): Npc {
  let party: number | null = null;
  let seating: Seating | null = null;
  const { yes, no, known } = common.words;
  /** Asks again whatever is still to be answered, or reads everything back. */
  const currentQuestion = () =>
    party === null ? script.askParty : seating === null ? script.askSeating : script.readBackTable(party, script.seating[seating].said);
  return {
    ...common,
    greeting: script.welcome,
    resume: script.askParty,
    hear: (line) => {
      const heardParty = PARTY_SIZES.find((size) => mentions(line, script.party[size])) ?? null;
      const heardSeating = SEATING.find((seat) => mentions(line, script.seating[seat].words)) ?? null;
      if (heardParty !== null || heardSeating !== null) {
        party = heardParty ?? party;
        seating = heardSeating ?? seating;
        return act.say(currentQuestion());
      }
      if (party !== null && seating !== null && mentions(line, no)) {
        [party, seating] = [null, null];
        return act.say(script.askParty);
      }
      if (party !== null && seating !== null && mentions(line, yes)) {
        return act.call(SEAT_GUEST, { party, seating }, (response) => act.say(response.result === 'done' ? script.seated : script.askParty));
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(currentQuestion());
      act.notUnderstood();
    },
  };
}

/**
 * The server recommending a dish: asks what the guest doesn't eat, recommends the first dish that keeps to it, and
 * serves it on a yes. A dish the guest names is read back instead. If the game says it breaks the need, they
 * recommend one that keeps to it.
 */
function recommendNpc(script: ServerScript, common: OrderScript, menu: ItemId[], packId: LanguageCode, act: Act): Npc {
  let restriction: DietaryNoteId | null = null;
  let dish: ItemId | null = null;
  const { yes, no, known } = common.words;
  const name = (item: ItemId) => CULTURE_PACKS[packId].goods[item].name;
  const price = (item: ItemId) => common.price(localPrice(ITEMS[item].priceInShifts, packId));
  const dishes = menu.filter(isDish);
  const recommend = (note: DietaryNoteId, say: ServerScript['recommend']) => {
    dish = dishes.find((id) => dishFits(id, note)) ?? null;
    act.say(dish ? say(name(dish), price(dish)) : script.askDiet);
  };
  return {
    ...common,
    greeting: script.welcomeToRecommend,
    resume: script.askDiet,
    hear: (line) => {
      const diet = DIETS_HEARD.find((note) => mentions(line, script.diets[note])) ?? null;
      const named = dishes.find((id) => mentions(line, ITEM_WORDS[packId][id])) ?? null;
      if (diet && !named) {
        restriction = diet;
        return recommend(diet, script.recommend);
      }
      if (restriction === null) return named || mentions(line, [...yes, ...no, ...known]) ? act.say(script.askDiet) : act.notUnderstood();
      if (named) {
        dish = named;
        return act.say(common.readBack(name(named), price(named)));
      }
      if (dish && mentions(line, no)) {
        dish = null;
        return act.say(common.askAgain);
      }
      if (dish && mentions(line, yes)) {
        const kept = restriction;
        return act.call(SERVE_ORDER, { items: [{ item: dish, quantity: 1 }], restriction: kept }, (response) => {
          if (response.result === 'served') act.say(common.served);
          else if (response.result === 'cannot_afford') act.say(common.cannotAfford);
          else recommend(kept, script.notThatOne);
        });
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(dish ? script.recommend(name(dish), price(dish)) : common.askAgain);
      act.notUnderstood();
    },
  };
}

/** The server taking the bill: says the total from FACTS, asks how the guest pays, reads both back and settles on a yes. */
function billNpc(script: ServerScript, common: OrderScript, systemInstruction: string, act: Act): Npc {
  const total = readBillTotal(systemInstruction) ?? '';
  let method: BillMethod | null = null;
  const { yes, no, known } = common.words;
  return {
    ...common,
    greeting: script.billTotal(total),
    resume: script.billTotal(total),
    hear: (line) => {
      const heard = BILL_METHODS.find((how) => mentions(line, script.methods[how].words)) ?? null;
      if (heard) {
        method = heard;
        return act.say(script.readBackBill(total, script.methods[heard].said));
      }
      if (method && mentions(line, no)) {
        method = null;
        return act.say(script.askMethod);
      }
      if (method && mentions(line, yes)) {
        return act.call(SETTLE_BILL, { method }, (response) => {
          if (response.result === 'done') act.say(script.paid);
          else if (response.result === 'cannot_afford') act.say(script.cannotPay);
          else act.say(script.askMethod);
        });
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(script.askMethod);
      act.notUnderstood();
    },
  };
}

/** The landlord taking rent: all that is owed, on a yes. Caught in the hallway, the greeting is a reminder. */
function rentNpc(script: LandlordScript, words: Words, session: NpcSession, act: Act): Npc {
  const owed = readRentOwed(session.systemInstruction);
  const caught = session.openingScene.includes('hallway');
  const { yes, no, known } = words;
  return {
    ...script,
    greeting: !owed ? script.nothingOwed : caught ? script.reminder(owed.money) : script.payGreeting(owed.money),
    hear: (line) => {
      // "No" first: "不要" holds "要".
      if (owed && mentions(line, no)) return act.say(script.later);
      if (owed && mentions(line, yes)) {
        return act.call(ACCEPT_RENT, { amount: owed.amount }, (response) =>
          act.say(response.result === 'done' ? script.paid : response.result === 'cannot_afford' ? script.cannotAfford : script.later),
        );
      }
      if (mentions(line, known)) return act.say(owed ? script.payGreeting(owed.money) : script.nothingOwed);
      act.notUnderstood();
    },
  };
}

/** The landlord giving more time: offers three days for any line it understands, and gives them on a yes. */
function extensionNpc(script: LandlordScript, words: Words, act: Act): Npc {
  let offered = false;
  const { yes, no, known } = words;
  return {
    ...script,
    greeting: script.askTime,
    hear: (line) => {
      if (offered && mentions(line, no)) {
        offered = false;
        return act.say(script.askTime);
      }
      if (offered && mentions(line, yes)) {
        offered = false;
        return act.call(GRANT_EXTENSION, { days: EXTENSION_DAYS }, () => act.say(script.timeGiven));
      }
      if (mentions(line, [...yes, ...no, ...known])) {
        offered = true;
        return act.say(script.readBackTime(EXTENSION_DAYS));
      }
      act.notUnderstood();
    },
  };
}

/** The landlord's news of the new weekly rent, finished once the tenant answers. */
function rentNewsNpc(script: LandlordScript, words: Words, session: NpcSession, act: Act): Npc {
  const news = script.news(readNewWeeklyRent(session.systemInstruction) ?? '');
  const { yes, no, known } = words;
  return {
    ...script,
    greeting: news,
    hear: (line) => {
      if (mentions(line, no)) return act.say(news);
      if (mentions(line, [...yes, ...known])) return act.call(FINISH_RENT_NEWS, { understood: true }, () => act.say(script.newsDone));
      act.notUnderstood();
    },
  };
}

/** The name in a line: its first sentence, without the words said around a name. */
function nameIn(line: string, introductions: readonly string[]): string {
  let name = line.split(/[。．.!！?？,，、]/u)[0]!;
  for (const words of introductions) name = name.replace(new RegExp(words.replace(/'/g, "['’]"), 'giu'), ' ');
  return name.replace(/\s+/g, ' ').trim();
}

/** The barista hiring: on a request for work, asks the name, then when they can start, reads both back and hires on a yes. */
function hiringNpc(script: HiringScript, common: OrderScript, act: Act): Npc {
  let asked = false;
  let name: string | null = null;
  let start: StartWhen | null = null;
  const { yes, no, known } = common.words;
  const nextQuestion = () =>
    name === null ? script.askName : start === null ? script.askStart(name) : script.readBack(name, script.starts[start].said);
  return {
    ...common,
    hear: (line) => {
      if (!asked) {
        if (!mentions(line, script.work)) return mentions(line, [...yes, ...no, ...known]) ? act.say(common.clarify[0]!) : act.notUnderstood();
        asked = true;
        return act.say(script.askName);
      }
      if (name === null) {
        name = nameIn(line, script.introductions) || null;
        return name === null ? act.notUnderstood() : act.say(nextQuestion());
      }
      if (start === null) {
        start = START_WHEN.find((when) => mentions(line, script.starts[when].words)) ?? null;
        return start || mentions(line, [...yes, ...no, ...known]) ? act.say(nextQuestion()) : act.notUnderstood();
      }
      if (mentions(line, no)) {
        [name, start] = [null, null];
        return act.say(script.askName);
      }
      if (!mentions(line, yes)) return act.say(nextQuestion());
      act.call(HIRE_APPLICANT, { name, start }, (response) => {
        if (response.result === 'done') return act.say(script.hired);
        // Misheard: the start stands, and the name is asked again.
        name = null;
        act.say(script.nameAgain);
      });
    },
  };
}

/** The fake NPC in Small Talk: chats back about anything it understands, learns a name it's told, and says goodbye when told to wrap up. */
type SmallTalkScript = {
  greeting: string;
  resume: string;
  /** Said in turn to each line it understood. */
  replies: string[];
  goodbye: string;
  niceToMeet: (name: string) => string;
  nameAgain: string;
  notUnderstood: string;
  outOfPatience: string;
  /** Said before a name ("my name is"): only a line with one of these gives a name. */
  naming: string[];
  /** Words it understands. A line with none of them is gibberish to it. */
  words: string[];
};

const SMALL_TALK_SCRIPT: Record<LanguageCode, SmallTalkScript> = {
  ja: {
    greeting: 'こんにちは！今日はいい天気ですね。',
    resume: 'ごめんなさい、お待たせしました。',
    replies: ['そうなんですね！', 'いいですね。最近どうですか？', 'へえ、それは楽しそう！'],
    goodbye: 'あ、そろそろ行かないと。じゃあ、またね！',
    niceToMeet: (name) => `${name}さん、よろしくお願いします！`,
    nameAgain: 'ごめんなさい、お名前をもう一度お願いします。',
    notUnderstood: 'すみません、よくわかりませんでした。',
    outOfPatience: 'ごめんなさい、そろそろ行かないと。またね！',
    naming: ['私の名前は', 'わたしのなまえは', '名前は', 'なまえは'],
    words: ['天気', 'てんき', 'はい', 'いいえ', 'こんにちは', '元気', 'げんき', '好き', 'すき', '今日', 'きょう', '公園', 'いい', 'そう', '名前'],
  },
  zh: {
    greeting: '你好！今天天气真不错啊。',
    resume: '不好意思，让你久等了。',
    replies: ['是吗！', '真好。你最近怎么样？', '哇，听起来很有意思！'],
    goodbye: '哎呀，我得走了。下次再聊，再见！',
    niceToMeet: (name) => `${name}，很高兴认识你！`,
    nameAgain: '不好意思，请再说一遍你的名字。',
    notUnderstood: '不好意思，我没听懂。',
    outOfPatience: '不好意思，我得走了。再见！',
    naming: ['我叫', '我的名字是', '我的名字叫'],
    words: ['天气', '你好', '是', '对', '好', '喜欢', '今天', '公园', '最近', '名字'],
  },
  en: {
    greeting: "Hello there! Lovely weather today, isn't it?",
    resume: 'Sorry about that! Where were we?',
    replies: ['Oh, really?', 'How nice. How have you been lately?', 'That sounds lovely!'],
    goodbye: "Oh, look at the time. I'd better get going. See you soon!",
    niceToMeet: (name) => `Nice to meet you, ${name}!`,
    nameAgain: 'Sorry, what was your name again?',
    notUnderstood: "Sorry, I didn't quite catch that.",
    outOfPatience: "Sorry, I'd better be off. Bye!",
    naming: ['my name is', "my name's", 'call me'],
    words: ['yes', 'no', 'hello', 'hi', 'weather', 'nice', 'good', 'fine', 'like', 'today', 'park', 'name', 'lovely', 'sunny'],
  },
  de: {
    greeting: 'Hallo! Schönes Wetter heute, oder?',
    resume: 'Entschuldigung! Wo waren wir?',
    replies: ['Ach, wirklich?', 'Schön. Wie geht es dir so?', 'Das klingt toll!'],
    goodbye: 'Oh, ich muss jetzt weiter. Bis bald, tschüss!',
    niceToMeet: (name) => `Freut mich, ${name}!`,
    nameAgain: 'Entschuldigung, wie war dein Name noch mal?',
    notUnderstood: 'Entschuldigung, das habe ich nicht verstanden.',
    outOfPatience: 'Entschuldigung, ich muss los. Tschüss!',
    naming: ['ich heiße', 'mein name ist'],
    words: ['ja', 'nein', 'hallo', 'wetter', 'schön', 'gut', 'gern', 'heute', 'park', 'name', 'danke'],
  },
};

/** How a regular is asked whether they'll have their usual. */
const USUAL_GREETING: Record<LanguageCode, string> = {
  ja: 'いらっしゃいませ！いつものでいいですか？',
  zh: '欢迎光临！还是老样子吗？',
  en: 'Hiya! The usual?',
  de: 'Hallo! Wie immer?',
};

/** The Character's usual, as the session's "You and this person" block names it, or null if the NPC doesn't offer one. */
function readUsual(systemInstruction: string): { items: Record<string, unknown>[]; allergen?: string } | null {
  const usual = /their usual: (.+)\.$/m.exec(systemInstruction)?.[1];
  if (!usual) return null;
  const items = [...usual.matchAll(/(\d+) × [^(]+ \(menu id "([a-z-]+)"([^)]*)\)/g)].map(([, quantity, item, made = '']) => {
    const size = /size "([a-z]+)"/.exec(made)?.[1];
    const temperature = /temperature "([a-z]+)"/.exec(made)?.[1];
    const extras = [...(/extras ((?:"[a-z-]+"(?:, )?)+)/.exec(made)?.[1]?.matchAll(/"([a-z-]+)"/g) ?? [])].map(([, extra]) => extra);
    // A drink made to order says how it's made; anything else is just the item.
    return { item: item!, quantity: Number(quantity), ...(temperature && { size, temperature, extras }) };
  });
  const allergen = /\(allergen "([a-z]+)"\)/.exec(systemInstruction)?.[1];
  return { items, ...(allergen && { allergen }) };
}

/**
 * A regular's order: the NPC greets them with "the usual?" and serves it on a yes, completing with `toolName`. Anything
 * else is an order taken as usual by `npc`.
 */
function offeringTheUsual(npc: Npc, usual: ReturnType<typeof readUsual>, script: OrderScript, packId: LanguageCode, act: Act, toolName = SERVE_ORDER): Npc {
  if (!usual) return npc;
  let offered = true;
  return {
    ...npc,
    greeting: USUAL_GREETING[packId],
    hear: (line) => {
      const { yes, no } = script.words;
      const accepted = offered && mentions(line, yes) && !mentions(line, no);
      offered = false;
      if (!accepted) return npc.hear(line);
      act.call(toolName, usual, (response) => {
        if (response.result === 'served') act.say(script.served);
        else if (response.result === 'cannot_afford') act.say(script.cannotAfford);
        else act.say(script.askAgain);
      });
    },
  };
}

/** Small Talk: a reply to each line it understands, in turn; a name it's told goes to learn_name. */
function smallTalkNpc(script: SmallTalkScript, introductions: readonly string[], act: Act): Npc {
  let replies = 0;
  return {
    ...script,
    hear: (line) => {
      if (line === WRAP_UP_SCENE) return act.say(script.goodbye);
      if (mentions(line, script.naming)) {
        const name = nameIn(line, [...script.naming, ...introductions]);
        if (name) return act.call(LEARN_NAME_TOOL, { name }, (response) => act.say(response.result === 'learned' ? script.niceToMeet(name) : script.nameAgain));
      }
      if (mentions(line, script.words)) return act.say(script.replies[replies++ % script.replies.length]!);
      act.notUnderstood();
    },
  };
}

/** Any Named NPC, whatever the conversation: thanks for a gift, and their favourite told when asked. */
type GivenGiftScript = {
  thanks: string;
  /** For a gift that came only days after the last one. */
  shouldntHave: string;
  /** For the gift they would love most. */
  delighted: string;
  /** Tells the Character their favourite, by the pack's local name. */
  favourite: (gift: string) => string;
  /** What asks them which gift they would like: about gifts only, so a question in a Goal Interaction isn't taken for it. */
  asked: string[];
};

const GIVEN_GIFT_SCRIPT: Record<LanguageCode, GivenGiftScript> = {
  ja: {
    thanks: 'わあ、ありがとうございます！',
    shouldntHave: 'え、この前もいただいたのに…気をつかわないでくださいね。ありがとう！',
    delighted: 'えっ、これ大好きなんです！本当にありがとう！',
    favourite: (gift) => `プレゼントなら、${gift}が一番うれしいです！`,
    asked: ['好きなプレゼント', 'ほしいプレゼント'],
  },
  zh: {
    thanks: '哇，谢谢你！',
    shouldntHave: '你前几天才送过我礼物，太客气了！谢谢！',
    delighted: '天哪，这是我最喜欢的！太谢谢你了！',
    favourite: (gift) => `礼物的话，我最喜欢${gift}！`,
    asked: ['喜欢的礼物', '喜欢什么礼物'],
  },
  en: {
    thanks: 'Oh, thank you so much!',
    shouldntHave: "Oh, you really shouldn't have, not again so soon! Thank you!",
    delighted: 'Oh, I love these! How did you know? Thank you!',
    favourite: (gift) => `My favourite? ${gift}, every time!`,
    asked: ['favourite gift', 'favorite gift'],
  },
  de: {
    thanks: 'Oh, vielen Dank!',
    shouldntHave: 'Oh, das wäre doch nicht nötig gewesen, schon wieder! Danke!',
    delighted: 'Oh, die liebe ich! Woher wusstest du das? Danke!',
    favourite: (gift) => `Am liebsten? ${gift}, immer!`,
    asked: ['lieblingsgeschenk'],
  },
};

/**
 * What any Named NPC answers, whatever else they are doing: a gift scene is thanked for, and asked their favourite,
 * they call reveal_favourite and say it. Returns whether the line was one of these.
 */
function heardAsAnyNamedNpc(session: NpcSession, line: string, act: Act): boolean {
  if (!('npcId' in session.voice) || !session.tools.some((tool) => tool.name === REVEAL_FAVOURITE_TOOL)) return false;
  const packId = session.voice.targetLanguage;
  const script = GIVEN_GIFT_SCRIPT[packId];
  const gift = readGiftScene(line);
  if (gift) {
    act.say(gift.favourite ? script.delighted : gift.counted ? script.thanks : script.shouldntHave);
    return true;
  }
  if (!mentions(line, script.asked)) return false;
  const favourite = CULTURE_PACKS[packId].goods[NAMED_NPCS[session.voice.npcId].favouriteGift].name;
  act.call(REVEAL_FAVOURITE_TOOL, { gift: favourite }, () => act.say(script.favourite(favourite)));
  return true;
}

/** The fake Shift Customer: orders their drink, says it again when asked, and reacts to what they are handed. */
type CustomerScript = {
  order: (items: string) => string;
  /** Says the order again, for a line it understood. */
  again: (items: string) => string;
  /** Changes their mind: they want this instead. */
  change: (items: string) => string;
  thanks: string;
  wrongOrder: string;
  /** Words that ask the customer to repeat or clarify. */
  repeat: string[];
};

const CUSTOMER_SCRIPT: Record<LanguageCode, CustomerScript> = {
  ja: {
    order: (items) => `こんにちは。${items}をひとつください。`,
    again: (items) => `${items}をひとつお願いします。`,
    change: (items) => `あ、すみません！やっぱり${items}にしてください。`,
    thanks: 'ありがとうございます！',
    wrongOrder: 'あの、これは注文したものと違います…。じゃあ、いいです。',
    repeat: ['もう一度', 'もういちど', 'なん', '何', 'えっ', 'え？'],
  },
  zh: {
    order: (items) => `你好，我要一杯${items}。`,
    again: (items) => `一杯${items}，谢谢。`,
    change: (items) => `啊，不好意思！我改成${items}吧。`,
    thanks: '谢谢！',
    wrongOrder: '这不是我点的……算了，再见。',
    repeat: ['再说一遍', '什么', '请再说'],
  },
  en: {
    order: (items) => `Hi! Could I get a ${items}, please?`,
    again: (items) => `A ${items}, please.`,
    change: (items) => `Oh, sorry! Actually, could I have a ${items} instead?`,
    thanks: 'Lovely, thanks!',
    wrongOrder: "Sorry, that's not what I ordered… never mind. Bye.",
    repeat: ['sorry', 'again', 'pardon', 'what'],
  },
  de: {
    order: (items) => `Hallo! Einen ${items}, bitte.`,
    again: (items) => `Einen ${items}, bitte.`,
    change: (items) => `Ach, Entschuldigung! Doch lieber einen ${items}.`,
    thanks: 'Danke schön!',
    wrongOrder: 'Das habe ich nicht bestellt… na ja, tschüss.',
    repeat: ['nochmal', 'noch mal', 'wie bitte', 'was'],
  },
};

/** The fake Shift Customer at the till: says everything the cashier needs to hear at once, and again when asked. */
type TillCustomerScript = {
  /** What goes between sentences: nothing in ja and zh. */
  between: string;
  hello: string;
  bag: { yes: string; no: string };
  pointsCard: { yes: string; no: string };
  behind: (item: string) => string;
  cash: (amount: string) => string;
  byCard: string;
  thanks: string;
  wrong: string;
};

const TILL_CUSTOMER_SCRIPT: Record<LanguageCode, TillCustomerScript> = {
  ja: {
    between: '',
    hello: 'こんにちは。',
    bag: { yes: '袋をお願いします。', no: '袋はいりません。' },
    pointsCard: { yes: 'ポイントカードあります。', no: 'ポイントカードはないです。' },
    behind: (item) => `あと、${item}をひとつください。`,
    cash: (amount) => `${amount}でお願いします。`,
    byCard: 'カードで払います。',
    thanks: 'どうも、ありがとうございます！',
    wrong: 'あの、ちょっと違うみたいです…。まあ、いいです。',
  },
  zh: {
    between: '',
    hello: '你好！',
    bag: { yes: '要一个袋子。', no: '不要袋子。' },
    pointsCard: { yes: '我有积分卡。', no: '我没有积分卡。' },
    behind: (item) => `还要一份${item}。`,
    cash: (amount) => `给你${amount}。`,
    byCard: '我刷卡。',
    thanks: '谢谢！',
    wrong: '好像不太对……算了，再见。',
  },
  en: {
    between: ' ',
    hello: 'Hi there!',
    bag: { yes: "I'd like a bag, please.", no: 'No bag, thanks.' },
    pointsCard: { yes: "Here's my points card.", no: "I haven't got a points card." },
    behind: (item) => `And could I have ${item} from behind the counter?`,
    cash: (amount) => `Here's ${amount}.`,
    byCard: "I'll pay by card.",
    thanks: 'Lovely, thanks!',
    wrong: "Hmm, that's not quite right… never mind. Bye.",
  },
  de: {
    between: ' ',
    hello: 'Hallo!',
    bag: { yes: 'Eine Tüte, bitte.', no: 'Keine Tüte, danke.' },
    pointsCard: { yes: 'Hier ist meine Punktekarte.', no: 'Ich habe keine Punktekarte.' },
    behind: (item) => `Und dazu ${item} von hinten, bitte.`,
    cash: (amount) => `Hier sind ${amount}.`,
    byCard: 'Ich zahle mit Karte.',
    thanks: 'Danke schön!',
    wrong: 'Das stimmt nicht ganz… na ja, tschüss.',
  },
};

/** A Shift Customer at the till: says whether they want a bag, have a points card, anything from behind the counter and how they pay. */
function tillCustomerNpc(script: TillCustomerScript, common: OrderScript, repeat: string[], wants: CheckoutSaid, act: Act): Npc {
  const all = [
    script.hello,
    wants.bag ? script.bag.yes : script.bag.no,
    wants.pointsCard ? script.pointsCard.yes : script.pointsCard.no,
    ...(wants.fromBehindTheCounter ? [script.behind(wants.fromBehindTheCounter)] : []),
    wants.cashHanded ? script.cash(wants.cashHanded) : script.byCard,
  ].join(script.between);
  const { yes, no, known } = common.words;
  return {
    ...common,
    greeting: all,
    resume: all,
    hear: (line) => {
      const servedRight = readServedScene(line);
      if (servedRight !== null) return act.say(servedRight ? script.thanks : script.wrong);
      if (mentions(line, [...repeat, ...yes, ...no, ...known])) return act.say(all);
      act.notUnderstood();
    },
  };
}

/** The fake Shift Customer at a restaurant table: orders for everyone at once, saying who has what, and again when asked. */
type TableCustomerScript = {
  /** What goes between sentences: nothing in ja and zh. */
  between: string;
  hello: string;
  /** What one diner wants (`i` 0 is the customer speaking), with their dietary need if they have one. */
  diner: (i: number, dish: string, drink: string, note: string | null) => string;
  thanks: string;
  wrong: string;
};

const TABLE_CUSTOMER_SCRIPT: Record<LanguageCode, TableCustomerScript> = {
  ja: {
    between: '',
    hello: 'すみません、注文お願いします。',
    diner: (i, dish, drink, note) => `${['私', '友達', 'もう一人の友達'][i] ?? '友達'}は${dish}と${drink}を${note ? `、${note}で` : ''}お願いします。`,
    thanks: 'はい、それでお願いします。ありがとうございます！',
    wrong: 'あの、ちょっと違うみたいです…。まあ、いいです。',
  },
  zh: {
    between: '',
    hello: '服务员，点菜。',
    diner: (i, dish, drink, note) => `${['我', '我朋友', '另一个朋友'][i] ?? '我朋友'}要${dish}和${drink}${note ? `，${note}` : ''}。`,
    thanks: '好，就这些，谢谢！',
    wrong: '好像不太对……算了。',
  },
  en: {
    between: ' ',
    hello: "Hi, we're ready to order.",
    diner: (i, dish, drink, note) =>
      `${['I', 'My friend', 'My other friend'][i] ?? 'My friend'}'ll have the ${dish} and a ${drink}${note ? ` (${note}, please)` : ''}.`,
    thanks: 'Perfect, thanks!',
    wrong: "Hmm, that's not quite right… never mind.",
  },
  de: {
    between: ' ',
    hello: 'Hallo, wir möchten bestellen.',
    diner: (i, dish, drink, note) =>
      `${['Ich nehme', 'Meine Freundin nimmt', 'Meine andere Freundin nimmt'][i] ?? 'Meine Freundin nimmt'} ${dish} und ${drink}${note ? ` (${note}, bitte)` : ''}.`,
    thanks: 'Super, danke!',
    wrong: 'Das stimmt nicht ganz… na ja.',
  },
};

/** A Shift Customer at a restaurant table: orders every diner's dish and drink at once, with the dietary need. */
function tableCustomerNpc(script: TableCustomerScript, common: OrderScript, repeat: string[], diners: DinerSaid[], act: Act): Npc {
  const all = [script.hello, ...diners.map(({ dish, drink, note }, i) => script.diner(i, dish, drink, note))].join(script.between);
  const { yes, no, known } = common.words;
  return {
    ...common,
    greeting: all,
    resume: all,
    hear: (line) => {
      const servedRight = readServedScene(line);
      if (servedRight !== null) return act.say(servedRight ? script.thanks : script.wrong);
      if (mentions(line, [...repeat, ...yes, ...no, ...known])) return act.say(all);
      act.notUnderstood();
    },
  };
}

/**
 * A Shift Customer, ordering what the instruction holds by the items' local names ("1 × ラテ" is said as "ラテ"). One
 * who changes their mind wants what the instruction says instead once the barista has started on it.
 */
function customerNpc(script: CustomerScript, common: OrderScript, systemInstruction: string, act: Act): Npc {
  const said = (order: string | null) => (order ?? '').replace(/\d+ × /g, '');
  let items = said(readShiftOrder(systemInstruction));
  const changedTo = readChangedOrder(systemInstruction);
  const { yes, no, known } = common.words;
  return {
    ...common,
    greeting: script.order(items),
    get resume() {
      return script.again(items);
    },
    hear: (line) => {
      const servedRight = readServedScene(line);
      if (servedRight !== null) return act.say(servedRight ? script.thanks : script.wrongOrder);
      if (readChangeScene(line) && changedTo) {
        items = said(changedTo);
        return act.say(script.change(items));
      }
      if (mentions(line, [...script.repeat, ...yes, ...no, ...known])) return act.say(script.again(items));
      act.notUnderstood();
    },
  };
}

/**
 * The barista taking an order with options (#2), and one avoiding an allergen (#3): first asking about allergies, then
 * asking the size and hot or iced of each drink made to order, reading the whole order back with its total.
 */
type CafeScript = {
  greeting: string;
  /** Avoiding an allergen, the greeting asks about allergies first. */
  allergyGreeting: string;
  askAllergy: string;
  askWhichAllergy: string;
  /** The allergy heard, by its local name, or null for none, then what they would like. */
  noted: (allergen: string | null) => string;
  askSize: (drink: string) => string;
  askTemperature: (drink: string) => string;
  /** A drink with how it's made, by the options' local names. */
  made: (drink: string, options: string[]) => string;
  readBack: (order: string[], total: string) => string;
  hasAllergen: (item: string, allergen: string) => string;
  /** How each option and allergen might be said, and saying there's no allergy. */
  options: Record<DrinkOptionId, string[]>;
  allergens: Record<Allergen, string[]>;
  noAllergy: string[];
};

const CAFE_SCRIPT: Record<LanguageCode, CafeScript> = {
  ja: {
    greeting: 'いらっしゃいませ！お飲み物はサイズとホット・アイスをお選びいただけます。ご注文をどうぞ。',
    allergyGreeting: 'いらっしゃいませ！ご注文の前に、食物アレルギーはございますか？',
    askAllergy: '食物アレルギーはございますか？',
    askWhichAllergy: '何のアレルギーでしょうか？',
    noted: (allergen) => (allergen ? `${allergen}のアレルギーですね。かしこまりました。ご注文をどうぞ。` : 'かしこまりました。ご注文をどうぞ。'),
    askSize: (drink) => `${drink}のサイズはS、M、Lのどれになさいますか？`,
    askTemperature: (drink) => `${drink}はホットとアイス、どちらになさいますか？`,
    made: (drink, options) => `${drink}（${options.join('、')}）`,
    readBack: (order, total) => `${order.join('と')}ですね。合計${total}です。よろしいですか？`,
    hasAllergen: (item, allergen) => `申し訳ございません、${item}には${allergen}が入っております。ほかのものになさいますか？`,
    // Lower case "s", "m" and "l": `mentions` lowercases the line.
    options: {
      small: ['sサイズ', 'スモール', '小さい'],
      medium: ['mサイズ', 'ミディアム', '普通'],
      large: ['lサイズ', 'ラージ', '大きい'],
      hot: ['ホット', '温かい'],
      iced: ['アイス', '冷たい'],
      milk: ['ミルク', '牛乳'],
      sugar: ['砂糖', 'さとう'],
      'extra-shot': ['ショット'],
      lemon: ['レモン'],
    },
    allergens: { milk: ['乳', 'ミルク'], egg: ['卵', 'たまご'], wheat: ['小麦', 'こむぎ', 'グルテン'] },
    noAllergy: ['ありません', 'ないです', '大丈夫', 'いいえ'],
  },
  zh: {
    greeting: '欢迎光临！饮料有小杯、中杯、大杯，可以做热的或冰的。您想点什么？',
    allergyGreeting: '欢迎光临！点单之前想问一下，您有什么食物过敏吗？',
    askAllergy: '您有什么食物过敏吗？',
    askWhichAllergy: '请问您对什么过敏？',
    noted: (allergen) => (allergen ? `好的，您对${allergen}过敏。您想点什么？` : '好的。您想点什么？'),
    askSize: (drink) => `${drink}要小杯、中杯还是大杯？`,
    askTemperature: (drink) => `${drink}要热的还是冰的？`,
    made: (drink, options) => `${drink}（${options.join('，')}）`,
    readBack: (order, total) => `${order.join('和')}，一共${total}。对吗？`,
    hasAllergen: (item, allergen) => `不好意思，${item}里有${allergen}。要换别的吗？`,
    options: {
      small: ['小杯'],
      medium: ['中杯'],
      large: ['大杯'],
      hot: ['热的'],
      iced: ['冰的', '加冰'],
      milk: ['加奶', '牛奶'],
      sugar: ['加糖', '糖'],
      'extra-shot': ['浓缩'],
      lemon: ['柠檬'],
    },
    allergens: { milk: ['牛奶', '奶'], egg: ['鸡蛋'], wheat: ['小麦', '面粉', '麸质'] },
    noAllergy: ['没有', '不过敏'],
  },
  en: {
    greeting: 'Hiya! What can I get you? Drinks come small, medium or large, hot or iced.',
    allergyGreeting: 'Hiya! Before you order, do you have any food allergies?',
    askAllergy: 'Do you have any food allergies?',
    askWhichAllergy: 'What are you allergic to?',
    noted: (allergen) => (allergen ? `${allergen} allergy, got it. What can I get you?` : 'Lovely. What can I get you?'),
    askSize: (drink) => `What size would you like the ${drink.toLowerCase()}: small, medium or large?`,
    askTemperature: (drink) => `Would you like the ${drink.toLowerCase()} hot or iced?`,
    made: (drink, options) => `${drink} (${options.join(', ')})`,
    readBack: (order, total) => `So that's ${order.join(' and ')}, ${total} altogether. Is that right?`,
    hasAllergen: (item, allergen) => `Sorry, the ${item.toLowerCase()} has ${allergen.toLowerCase()} in it. Would you like something else?`,
    options: {
      small: ['small'],
      medium: ['medium', 'regular'],
      large: ['large', 'big'],
      hot: ['hot'],
      iced: ['iced', 'cold'],
      milk: ['milk'],
      sugar: ['sugar'],
      'extra-shot': ['extra shot', 'double'],
      lemon: ['lemon'],
    },
    allergens: { milk: ['milk', 'dairy', 'lactose'], egg: ['egg', 'eggs'], wheat: ['wheat', 'gluten', 'flour'] },
    noAllergy: ['no allergies', 'none', 'no'],
  },
  de: {
    greeting: 'Hallo! Was darf’s sein? Getränke gibt es klein, mittel oder groß, heiß oder mit Eis.',
    allergyGreeting: 'Hallo! Bevor Sie bestellen: Haben Sie eine Lebensmittelallergie?',
    askAllergy: 'Haben Sie eine Lebensmittelallergie?',
    askWhichAllergy: 'Wogegen sind Sie allergisch?',
    noted: (allergen) => (allergen ? `Also nichts mit ${allergen}, alles klar. Was darf’s sein?` : 'Alles klar. Was darf’s sein?'),
    askSize: (drink) => `Welche Größe für ${drink}: klein, mittel oder groß?`,
    askTemperature: (drink) => `${drink} heiß oder mit Eis?`,
    made: (drink, options) => `${drink} (${options.join(', ')})`,
    readBack: (order, total) => `Also ${order.join(' und ')}, zusammen ${total}, richtig?`,
    hasAllergen: (item, allergen) => `Tut mir leid, in ${item} ist ${allergen}. Möchten Sie etwas anderes?`,
    options: {
      small: ['klein', 'kleinen', 'kleine', 'kleiner'],
      medium: ['mittel', 'mittleren', 'mittlere', 'normal'],
      large: ['groß', 'großen', 'große', 'großer'],
      hot: ['heiß', 'heißen', 'warm'],
      iced: ['mit eis', 'eiskalt', 'kalt'],
      milk: ['milch'],
      sugar: ['zucker'],
      'extra-shot': ['extra shot', 'doppelt'],
      lemon: ['zitrone'],
    },
    allergens: { milk: ['milch', 'laktose'], egg: ['ei', 'eier'], wheat: ['weizen', 'gluten', 'mehl'] },
    noAllergy: ['keine', 'nein', 'nichts'],
  },
};

/** One line of a café order as the fake barista takes it: one of an item, and for a drink made to order, how it's made. */
type CafeLine = { item: ItemId; size?: DrinkSize; temperature?: DrinkTemperature; extras: DrinkExtra[] };

/** The line's completion arguments: how it's made only for a drink made to order. */
function cafeLineArgs({ item, size, temperature, extras }: CafeLine) {
  return isMadeToOrder(item) ? { item, quantity: 1, size, temperature, extras } : { item, quantity: 1 };
}

/**
 * The barista taking a café order with options, and with `avoidingAllergen`, first asking what the customer is allergic
 * to. Items and options can come in any order and all at once; a drink made to order is asked its size, then hot or
 * iced. The whole order is read back with its total and served on a yes. Like the server, it reads back anything the
 * customer names: if the game rejects it, it says what has the allergen in it and takes the rest of the order on.
 */
function cafeNpc(script: CafeScript, common: OrderScript, menu: ItemId[], packId: LanguageCode, avoidingAllergen: boolean, act: Act): Npc {
  const { goods, drinkOptions, allergens } = CULTURE_PACKS[packId];
  const { yes, no, known } = common.words;
  let allergen: Allergen | 'none' | null = avoidingAllergen ? null : 'none';
  let order: CafeLine[] = [];
  let readBack = false;

  const said = (line: CafeLine) => {
    const options = [line.size, line.temperature, ...line.extras].filter((option) => option !== undefined);
    return options.length > 0 ? script.made(goods[line.item].name, options.map((option) => drinkOptions[option].name)) : goods[line.item].name;
  };
  /** The next thing to ask: how a drink is made, or the read-back of the whole order. */
  const nextQuestion = () => {
    const unmade = order.find((line) => isMadeToOrder(line.item) && (!line.size || !line.temperature));
    if (unmade) return unmade.size ? script.askTemperature(goods[unmade.item].name) : script.askSize(goods[unmade.item].name);
    readBack = order.length > 0;
    const total = order.reduce((sum, { item }) => sum + menuPrice(item, packId), 0);
    return readBack ? script.readBack(order.map(said), formatLocalMoney(total, packId)) : common.askAgain;
  };
  const heardOption = <Option extends DrinkOptionId>(line: string, options: readonly Option[]) =>
    options.find((option) => mentions(line, script.options[option]));
  const serve = () => {
    const kept = allergen;
    const args = { items: order.map(cafeLineArgs), ...(avoidingAllergen && { allergen: kept }) };
    return act.call(SERVE_ORDER, args, (response) => {
      if (response.result === 'served') return act.say(common.served);
      if (response.result === 'cannot_afford') return act.say(common.cannotAfford);
      const allergic = kept === 'none' || kept === null ? null : kept;
      const has = allergic && order.find((line) => cafeAllergensIn(line.item, line.extras, packId).includes(allergic));
      if (!allergic || !has) {
        order = [];
        return act.say(common.askAgain);
      }
      order = order.filter((line) => line !== has);
      act.say(script.hasAllergen(goods[has.item].name, allergens[allergic].name));
    });
  };

  return {
    ...common,
    greeting: avoidingAllergen ? script.allergyGreeting : script.greeting,
    resume: avoidingAllergen ? script.askAllergy : script.greeting,
    hear: (line) => {
      if (allergen === null) {
        const heard = ALLERGENS.find((id) => mentions(line, script.allergens[id]));
        if (heard) {
          allergen = heard;
          return act.say(script.noted(allergens[heard].name));
        }
        if (mentions(line, script.noAllergy)) {
          allergen = 'none';
          return act.say(script.noted(null));
        }
        if (mentions(line, yes)) return act.say(script.askWhichAllergy);
        return mentions(line, [...no, ...known]) || menu.some((id) => mentions(line, ITEM_WORDS[packId][id])) ? act.say(script.askAllergy) : act.notUnderstood();
      }
      const items = menu.filter((id) => mentions(line, ITEM_WORDS[packId][id]));
      const size = heardOption(line, DRINK_SIZES);
      const temperature = heardOption(line, DRINK_TEMPERATURES);
      const extras = DRINK_EXTRAS.filter((extra) => mentions(line, script.options[extra]));
      if (items.length > 0 || size || temperature || extras.length > 0) {
        order.push(...items.map((item) => ({ item, extras: [] })));
        // How a drink is made goes to the drink made to order still being made, or else the last one ordered.
        const drink = order.find((l) => isMadeToOrder(l.item) && (!l.size || !l.temperature)) ?? order.findLast((l) => isMadeToOrder(l.item));
        if (drink) {
          drink.size = size ?? drink.size;
          drink.temperature = temperature ?? drink.temperature;
          drink.extras = [...new Set([...drink.extras, ...extras.filter((extra) => MADE_TO_ORDER_EXTRAS[drink.item]!.includes(extra))])];
        }
        return act.say(nextQuestion());
      }
      if (readBack && mentions(line, no)) {
        [order, readBack] = [[], false];
        return act.say(common.askAgain);
      }
      if (readBack && mentions(line, yes)) {
        readBack = false;
        return serve();
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(nextQuestion());
      act.notUnderstood();
    },
  };
}

/** The cashier taking something back (#6): finds out which item and what is wrong with it, and reads back the refund. */
type ReturnScript = {
  greeting: string;
  resume: string;
  askWhich: string;
  askWhy: string;
  readBack: (item: string, price: string) => string;
  refunded: string;
  cantRefund: string;
  /** Words that say something is wrong with an item. */
  faults: string[];
};

const RETURN_SCRIPT: Record<LanguageCode, ReturnScript> = {
  ja: {
    greeting: 'いらっしゃいませ。返品でしょうか？',
    resume: 'お待たせしました。返品の件ですね。',
    askWhich: 'どちらの商品でしょうか？',
    askWhy: 'どこか問題がございましたか？',
    readBack: (item, price) => `${item}ですね。${price}を返金いたします。よろしいですか？`,
    refunded: '大変失礼いたしました。こちら、返金でございます。',
    cantRefund: '申し訳ございません、こちらは返金できかねます。',
    faults: ['割れ', '壊れ', '傷', '腐', '悪', '破', '不良', 'へん', '変'],
  },
  zh: {
    greeting: '您好！是要退货吗？',
    resume: '让您久等了。您是要退货吧？',
    askWhich: '是哪个商品？',
    askWhy: '这个有什么问题吗？',
    readBack: (item, price) => `${item}，退您${price}，可以吗？`,
    refunded: '真抱歉。这是退给您的钱。',
    cantRefund: '不好意思，这个不能退。',
    faults: ['坏', '破', '裂', '臭', '问题', '过期'],
  },
  en: {
    greeting: 'Hiya! Are you returning something?',
    resume: 'Sorry about that! You were returning something?',
    askWhich: 'Which item is it?',
    askWhy: "Oh dear, what's wrong with it?",
    readBack: (item, price) => `${item}, so that's ${price} back to you. Is that right?`,
    refunded: 'So sorry about that. Here’s your money back.',
    cantRefund: "Sorry, I'm afraid I can't refund that.",
    faults: ['broken', 'cracked', 'bad', 'off', 'damaged', 'faulty', 'mouldy', 'stale', 'rotten', 'smashed'],
  },
  de: {
    greeting: 'Hallo! Möchten Sie etwas zurückgeben?',
    resume: 'Entschuldigung! Sie wollten etwas zurückgeben?',
    askWhich: 'Um welchen Artikel geht es?',
    askWhy: 'Was stimmt denn damit nicht?',
    readBack: (item, price) => `${item}, dann bekommen Sie ${price} zurück. Richtig?`,
    refunded: 'Das tut mir leid. Hier ist Ihr Geld zurück.',
    cantRefund: 'Tut mir leid, das kann ich leider nicht erstatten.',
    faults: ['kaputt', 'gebrochen', 'schlecht', 'beschädigt', 'defekt', 'verdorben', 'zerbrochen', 'abgelaufen'],
  },
};

/** #6: hears the item and what is wrong with it (in one line or two), reads back the refund, and refunds on a yes. */
function returnNpc(script: ReturnScript, common: OrderScript, items: ItemId[], packId: LanguageCode, act: Act): Npc {
  let item: ItemId | null = null;
  let faulty = false;
  let readBack = false;
  const { yes, no, known } = common.words;
  const startAgain = () => {
    [item, faulty, readBack] = [null, false, false];
  };
  return {
    ...common,
    ...script,
    hear: (line) => {
      const named = items.find((id) => mentions(line, ITEM_WORDS[packId][id]));
      const fault = mentions(line, script.faults);
      if (named || fault) {
        item = named ?? item;
        faulty ||= fault;
        readBack = item !== null && faulty;
        if (!item) return act.say(script.askWhich);
        if (!faulty) return act.say(script.askWhy);
        return act.say(script.readBack(CULTURE_PACKS[packId].goods[item].name, common.price(localPrice(ITEMS[item].priceInShifts, packId))));
      }
      if (readBack && mentions(line, no)) {
        startAgain();
        return act.say(script.askWhich);
      }
      if (readBack && item && mentions(line, yes)) {
        readBack = false;
        return act.call(REFUND, { item, reason: 'faulty' }, (response) => {
          if (response.result === 'done') return act.say(script.refunded);
          startAgain();
          act.say(script.cantRefund);
        });
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(item ? script.askWhy : script.askWhich);
      act.notUnderstood();
    },
  };
}

/** The town office's clerk registering an address (#23): the name, the address and the nationality, one at a time. */
type RegisterScript = {
  greeting: string;
  resume: string;
  askName: string;
  askAddress: string;
  askNationality: string;
  readBack: (name: string, address: string, nationality: string) => string;
  registered: string;
  nameAgain: string;
};

const REGISTER_SCRIPT: Record<LanguageCode, RegisterScript> = {
  ja: {
    greeting: 'こんにちは。住所の届け出ですね。お名前をお願いします。',
    resume: 'お待たせしました。届け出の続きをしましょう。',
    askName: 'お名前をお願いします。',
    askAddress: 'ご住所はどちらですか？',
    askNationality: 'ご国籍はどちらですか？',
    readBack: (name, address, nationality) => `お名前は${name}様、ご住所は${address}、ご国籍は${nationality}ですね。よろしいですか？`,
    registered: '登録が完了しました。ありがとうございました。',
    nameAgain: '失礼しました。もう一度お名前をお願いできますか？',
  },
  zh: {
    greeting: '您好，是来登记住址的吧？请问您叫什么名字？',
    resume: '让您久等了，我们继续登记吧。',
    askName: '请问您叫什么名字？',
    askAddress: '您的住址是哪里？',
    askNationality: '您的国籍是？',
    readBack: (name, address, nationality) => `名字${name}，住址${address}，国籍${nationality}，对吗？`,
    registered: '登记好了，谢谢！',
    nameAgain: '不好意思，我没听清您的名字。请再说一遍？',
  },
  en: {
    greeting: 'Hello! Registering your address? Can I take your full name?',
    resume: "Sorry about that! Let's carry on with the form.",
    askName: 'Can I take your full name?',
    askAddress: "And what's your address?",
    askNationality: 'And your nationality?',
    readBack: (name, address, nationality) => `So that's ${name}, living at ${address}, nationality ${nationality}. Is that right?`,
    registered: "Lovely, you're registered. Welcome to town!",
    nameAgain: 'Sorry, I think I misheard your name. Could you say it again?',
  },
  de: {
    greeting: 'Guten Tag! Sie möchten sich anmelden? Ihr vollständiger Name, bitte.',
    resume: 'Entschuldigung! Machen wir mit dem Formular weiter.',
    askName: 'Ihr vollständiger Name, bitte.',
    askAddress: 'Und Ihre Adresse?',
    askNationality: 'Und Ihre Staatsangehörigkeit?',
    readBack: (name, address, nationality) => `Also: ${name}, wohnhaft ${address}, Staatsangehörigkeit ${nationality}. Richtig?`,
    registered: 'Sie sind jetzt angemeldet. Willkommen!',
    nameAgain: 'Entschuldigung, ich habe Ihren Namen falsch verstanden. Noch einmal, bitte?',
  },
};

/** #23: takes each field of the form in turn, reads it back and registers on a yes, asking the name again if it was misheard. */
function registerNpc(script: RegisterScript, common: OrderScript, introductions: readonly string[], act: Act): Npc {
  let name: string | null = null;
  let address: string | null = null;
  let nationality: string | null = null;
  const { yes, no } = common.words;
  const nextQuestion = () => {
    if (name === null) return script.askName;
    if (address === null) return script.askAddress;
    return nationality === null ? script.askNationality : script.readBack(name, address, nationality);
  };
  return {
    ...common,
    ...script,
    hear: (line) => {
      // Each field is whatever was said, without the words said around it.
      const said = nameIn(line, introductions) || null;
      if (name === null || address === null || nationality === null) {
        if (said === null) return act.notUnderstood();
        if (name === null) name = said;
        else if (address === null) address = said;
        else nationality = said;
        return act.say(nextQuestion());
      }
      if (mentions(line, no)) {
        [name, address, nationality] = [null, null, null];
        return act.say(script.askName);
      }
      if (!mentions(line, yes)) return act.say(nextQuestion());
      act.call(REGISTER_RESIDENT, { fields: { name, address, nationality } }, (response) => {
        if (response.result === 'done') return act.say(script.registered);
        // Misheard: the rest of the form stands, and the name is asked again.
        name = null;
        act.say(script.nameAgain);
      });
    },
  };
}

/** The post office counter sending a parcel (#24): where to, how, and the price. */
type ParcelScript = {
  greeting: string;
  resume: string;
  askSpeed: string;
  readBack: (destination: string, speed: string, price: string) => string;
  sent: string;
  cannotAfford: string;
  /** Words said around a destination. */
  to: string[];
  speeds: Record<ShippingSpeed, { said: string; words: string[] }>;
};

const PARCEL_SCRIPT: Record<LanguageCode, ParcelScript> = {
  ja: {
    greeting: 'いらっしゃいませ。小包ですか？どちらまで送りますか？',
    resume: 'お待たせしました。小包の続きですね。',
    askSpeed: '船便、航空便、EMSがございます。どれになさいますか？',
    readBack: (destination, speed, price) => `${destination}まで${speed}で、${price}です。よろしいですか？`,
    sent: 'かしこまりました。お預かりします。',
    cannotAfford: '申し訳ございません、お支払いが足りないようです。ほかの送り方になさいますか？',
    to: ['に送りたいです', 'まで', 'です'],
    speeds: {
      sea: { said: '船便', words: ['船', 'ふなびん'] },
      air: { said: '航空便', words: ['航空', 'こうくう', '飛行機'] },
      express: { said: 'EMS', words: ['速達', 'そくたつ', 'EMS', '急ぎ'] },
    },
  },
  zh: {
    greeting: '您好！要寄包裹吗？寄到哪里？',
    resume: '让您久等了。您要寄包裹吧？',
    askSpeed: '海运、空运还是特快专递？',
    readBack: (destination, speed, price) => `寄到${destination}，${speed}，${price}。可以吗？`,
    sent: '好的，包裹收下了。',
    cannotAfford: '不好意思，您的钱好像不够。要换便宜一点的方式吗？',
    to: ['我要寄到', '寄到', '寄往'],
    speeds: {
      sea: { said: '海运', words: ['海运', '船'] },
      air: { said: '空运', words: ['空运', '航空', '飞机'] },
      express: { said: '特快专递', words: ['快递', '特快', 'EMS', '加急'] },
    },
  },
  en: {
    greeting: "Hiya! Sending a parcel? Where's it going?",
    resume: 'Sorry about that! You were sending a parcel?',
    askSpeed: 'By sea, by air or express?',
    readBack: (destination, speed, price) => `To ${destination}, ${speed}: that's ${price}. Is that right?`,
    sent: "Lovely, that's on its way. Bye now!",
    cannotAfford: "Sorry, it looks like that's not enough. Would you like a cheaper way?",
    to: ['send it to ', 'please'],
    speeds: {
      sea: { said: 'by sea', words: ['sea', 'surface', 'boat'] },
      air: { said: 'by air', words: ['air', 'airmail', 'plane'] },
      express: { said: 'express', words: ['express', 'fast', 'fastest', 'quick'] },
    },
  },
  de: {
    greeting: 'Hallo! Ein Paket? Wohin soll es gehen?',
    resume: 'Entschuldigung! Sie wollten ein Paket schicken?',
    askSpeed: 'Per Schiff, per Luftpost oder per Express?',
    readBack: (destination, speed, price) => `Nach ${destination}, ${speed}, das macht ${price}. Richtig?`,
    sent: 'Alles klar, das Paket geht raus. Tschüss!',
    cannotAfford: 'Oh, das reicht leider nicht. Möchten Sie es günstiger verschicken?',
    to: ['nach ', 'bitte'],
    speeds: {
      sea: { said: 'per Schiff', words: ['schiff', 'seeweg', 'see'] },
      air: { said: 'per Luftpost', words: ['luftpost', 'flugzeug', 'luft'] },
      express: { said: 'per Express', words: ['express', 'schnell', 'eilig'] },
    },
  },
};

/** #24: hears where the parcel is going, then how, reads back the postage and sends it on a yes. */
function parcelNpc(script: ParcelScript, common: OrderScript, packId: LanguageCode, act: Act): Npc {
  let destination: string | null = null;
  let speed: ShippingSpeed | null = null;
  const { yes, no, known } = common.words;
  const postage = (s: ShippingSpeed) => formatLocalMoney(chargeInShifts(ECONOMY.postageInShifts[s], packId), packId);
  const nextQuestion = () => {
    if (destination === null) return script.greeting;
    return speed === null ? script.askSpeed : script.readBack(destination, script.speeds[speed].said, postage(speed));
  };
  return {
    ...common,
    ...script,
    hear: (line) => {
      const heardSpeed = SHIPPING_SPEEDS.find((s) => mentions(line, script.speeds[s].words)) ?? null;
      if (destination === null) {
        destination = nameIn(line, script.to) || null;
        if (destination === null) return act.notUnderstood();
        speed = heardSpeed;
        return act.say(nextQuestion());
      }
      if (heardSpeed) {
        speed = heardSpeed;
        return act.say(nextQuestion());
      }
      if (speed === null) return mentions(line, [...yes, ...no, ...known]) ? act.say(script.askSpeed) : act.notUnderstood();
      if (mentions(line, no)) {
        speed = null;
        return act.say(script.askSpeed);
      }
      if (!mentions(line, yes)) return act.say(nextQuestion());
      act.call(SHIP, { destination, speed }, (response) => {
        if (response.result === 'done') return act.say(script.sent);
        speed = null;
        act.say(response.result === 'cannot_afford' ? script.cannotAfford : script.askSpeed);
      });
    },
  };
}

/** A passer-by at a tram stop (#25): hears where the Player wants to go, and names the stop to get off at. */
type PasserByScript = {
  greeting: string;
  resume: string;
  askWhere: string;
  getOff: (stop: string) => string;
  goodbye: string;
  /** How a Player might name each place, besides its local name. */
  places: Partial<Record<PlaceId, string[]>>;
};

const PASSER_BY_SCRIPT: Record<LanguageCode, PasserByScript> = {
  ja: {
    greeting: 'はい？どうしましたか？',
    resume: 'すみません、何でしたっけ？',
    askWhere: 'どこに行きたいですか？',
    getOff: (stop) => `${stop}で降りてください。わかりましたか？`,
    goodbye: 'いってらっしゃい！',
    places: {
      cafe: ['カフェ', '喫茶'],
      supermarket: ['スーパー'],
      'convenience-store': ['コンビニ'],
      restaurant: ['レストラン'],
      clinic: ['病院', 'クリニック', '薬局'],
      park: ['公園'],
      bookshop: ['本屋', '書店'],
      bathhouse: ['銭湯', 'お風呂', 'ジム'],
      'town-office': ['役場', '郵便局', '市役所'],
      home: ['アパート'],
    },
  },
  zh: {
    greeting: '你好！有什么事吗？',
    resume: '不好意思，你刚才说什么？',
    askWhere: '你想去哪儿？',
    getOff: (stop) => `在${stop}下车。明白了吗？`,
    goodbye: '一路顺风！',
    places: {
      cafe: ['咖啡馆', '咖啡店'],
      supermarket: ['超市'],
      'convenience-store': ['便利店'],
      restaurant: ['餐厅', '饭店'],
      clinic: ['医院', '诊所', '药房'],
      park: ['公园'],
      bookshop: ['书店'],
      bathhouse: ['澡堂', '浴室', '健身房'],
      'town-office': ['办事处', '邮局'],
      home: ['公寓'],
    },
  },
  en: {
    greeting: 'Hiya! You alright? Need a hand?',
    resume: 'Sorry, where were we?',
    askWhere: 'Where are you trying to get to?',
    getOff: (stop) => `Get off at ${stop}. Got that?`,
    goodbye: 'No worries. Have a good trip!',
    places: {
      cafe: ['cafe', 'café', 'coffee shop'],
      supermarket: ['supermarket'],
      'convenience-store': ['corner shop', 'convenience store'],
      restaurant: ['restaurant'],
      clinic: ['hospital', 'clinic', 'doctor', 'pharmacy'],
      park: ['park'],
      bookshop: ['bookshop', 'book shop'],
      bathhouse: ['baths', 'bathhouse', 'gym', 'pool'],
      'town-office': ['town hall', 'post office', 'council'],
      home: ['flat', 'apartment'],
    },
  },
  de: {
    greeting: 'Hallo! Kann ich Ihnen helfen?',
    resume: 'Entschuldigung, wo waren wir?',
    askWhere: 'Wohin möchten Sie denn?',
    getOff: (stop) => `Steigen Sie an der Haltestelle ${stop} aus. Alles klar?`,
    goodbye: 'Gern geschehen. Gute Fahrt!',
    places: {
      cafe: ['café', 'cafe'],
      supermarket: ['supermarkt'],
      'convenience-store': ['kiosk', 'späti'],
      restaurant: ['restaurant', 'gasthaus'],
      clinic: ['krankenhaus', 'klinik', 'arzt', 'apotheke'],
      park: ['park'],
      bookshop: ['buchhandlung', 'bücher'],
      bathhouse: ['bad', 'schwimmbad', 'fitnessstudio'],
      'town-office': ['bürgeramt', 'rathaus', 'post'],
      home: ['wohnung'],
    },
  },
};

/** #25: names the stop to get off at for the place it hears, and calls give_directions once the Player says they've got it. */
function passerByNpc(script: PasserByScript, common: OrderScript, packId: LanguageCode, act: Act): Npc {
  let stop: TramStopId | null = null;
  const { yes, no, known } = common.words;
  const { tramStops } = CULTURE_PACKS[packId];
  const places = Object.keys(script.places) as PlaceId[];
  return {
    ...common,
    ...script,
    hear: (line) => {
      const place = places.find((id) => mentions(line, [...script.places[id]!, localPlaceName(id, packId)]));
      if (place) {
        stop = TRAM_LINE.find((id) => STOP_PLACES[id].includes(place))!;
        return act.say(script.getOff(tramStops[stop].name));
      }
      if (stop && mentions(line, yes)) {
        const directed = stop;
        stop = null;
        return act.call(GIVE_DIRECTIONS, { stop: directed }, () => act.say(script.goodbye));
      }
      if (stop && mentions(line, no)) {
        stop = null;
        return act.say(script.askWhere);
      }
      if (mentions(line, [...yes, ...no, ...known])) return act.say(script.askWhere);
      act.notUnderstood();
    },
  };
}

/** Which fake NPC plays this session, read from the completion it offers. */
function castNpc(session: NpcSession, act: Act): Npc {
  const packId = session.voice.targetLanguage;
  const offers = (name: string) => session.tools.some((tool) => tool.name === name);
  // A passer-by borrows a Shift Customer's voice, but asks no order.
  if (offers(GIVE_DIRECTIONS)) return passerByNpc(PASSER_BY_SCRIPT[packId], SCRIPT[packId], packId, act);
  if ('shiftCustomerVoice' in session.voice) {
    const atTheTill = readCheckout(session.systemInstruction);
    if (atTheTill) return tillCustomerNpc(TILL_CUSTOMER_SCRIPT[packId], SCRIPT[packId], CUSTOMER_SCRIPT[packId].repeat, atTheTill, act);
    const atTheTable = readTable(session.systemInstruction);
    if (atTheTable) return tableCustomerNpc(TABLE_CUSTOMER_SCRIPT[packId], SCRIPT[packId], CUSTOMER_SCRIPT[packId].repeat, atTheTable, act);
    return customerNpc(CUSTOMER_SCRIPT[packId], SCRIPT[packId], session.systemInstruction, act);
  }
  // Small Talk has no completion function: only learn_name, reveal_favourite and not_understood.
  if (session.tools.every((tool) => [LEARN_NAME_TOOL, REVEAL_FAVOURITE_TOOL, NOT_UNDERSTOOD_TOOL].includes(tool.name))) {
    return smallTalkNpc(SMALL_TALK_SCRIPT[packId], HIRING_SCRIPT[packId].introductions, act);
  }
  if (offers(DISCHARGE_PATIENT)) return wardNpc(WARD_SCRIPT[packId], act);
  const isShopkeeper = 'npcId' in session.voice && session.voice.npcId === 'shopkeeper';
  const usual = readUsual(session.systemInstruction);
  const { words } = SCRIPT[packId];
  if (offers(ACCEPT_RENT)) return rentNpc(LANDLORD_SCRIPT[packId], words, session, act);
  if (offers(GRANT_EXTENSION)) return extensionNpc(LANDLORD_SCRIPT[packId], words, act);
  if (offers(FINISH_RENT_NEWS)) return rentNewsNpc(LANDLORD_SCRIPT[packId], words, session, act);
  if (offers(HIRE_APPLICANT)) return hiringNpc(HIRING_SCRIPT[packId], SCRIPT[packId], act);
  if (offers(SEAT_GUEST)) return tableNpc(SERVER_SCRIPT[packId], SCRIPT[packId], act);
  if (offers(SETTLE_BILL)) return billNpc(SERVER_SCRIPT[packId], SCRIPT[packId], session.systemInstruction, act);
  if (offers(ADMIT)) return bathNpc(ATTENDANT_SCRIPT[packId], SCRIPT[packId], packId, act);
  if (offers(REGISTER_PATIENT)) return receptionNpc(CLINIC_SCRIPT[packId], SCRIPT[packId], packId, act);
  if (offers(DIAGNOSE)) return doctorNpc(CLINIC_SCRIPT[packId], SCRIPT[packId], packId, act);
  if (offers(DISPENSE)) return pharmacyNpc(CLINIC_SCRIPT[packId], SCRIPT[packId], session.systemInstruction, packId, act);
  if (offers(SET_PAYMENT_PLAN)) return hospitalBillNpc(CLINIC_SCRIPT[packId], SCRIPT[packId], session.systemInstruction, act);
  if (offers(REFUND)) return returnNpc(RETURN_SCRIPT[packId], SCRIPT[packId], itemsIn(session, REFUND), packId, act);
  if (offers(REGISTER_RESIDENT)) return registerNpc(REGISTER_SCRIPT[packId], SCRIPT[packId], HIRING_SCRIPT[packId].introductions, act);
  if (offers(SHIP)) return parcelNpc(PARCEL_SCRIPT[packId], SCRIPT[packId], packId, act);
  if (offers(REGISTER_MEMBER)) {
    const renewing = session.systemInstruction.includes(INTERACTIONS.renewGymMembership.goal);
    return memberNpc(ATTENDANT_SCRIPT[packId], SCRIPT[packId], packId, renewing, act);
  }
  if ('npcId' in session.voice && session.voice.npcId === 'server') {
    const recommending = session.tools.find((tool) => tool.name === SERVE_ORDER)?.parameters?.properties?.restriction !== undefined;
    const menu = itemsIn(session, SERVE_ORDER);
    if (recommending) return recommendNpc(SERVER_SCRIPT[packId], SERVER_ORDER_SCRIPT[packId], menu, packId, act);
    return offeringTheUsual(orderNpc(SERVER_ORDER_SCRIPT[packId], menu, packId, act), usual, SERVER_ORDER_SCRIPT[packId], packId, act);
  }
  if (isShopkeeper && offers(COMPLETE_PURCHASE)) {
    const items = itemsIn(session, COMPLETE_PURCHASE);
    const wraps = session.tools.find((tool) => tool.name === COMPLETE_PURCHASE)?.parameters?.properties?.wrap !== undefined;
    if (wraps) return giftNpc(GIFT_SCRIPT[packId], SCRIPT[packId], items, packId, act);
    const bookshop = orderNpc(BOOKSHOP_SCRIPT[packId], items, packId, act, COMPLETE_PURCHASE);
    return offeringTheUsual(bookshop, usual, BOOKSHOP_SCRIPT[packId], packId, act, COMPLETE_PURCHASE);
  }
  if (offers(COMPLETE_PURCHASE)) return tillNpc(TILL_SCRIPT[packId], SCRIPT[packId], session.systemInstruction, act);
  if (offers(POINT_TO)) return shelvesNpc(SHELVES_SCRIPT[packId], SCRIPT[packId], itemsIn(session, POINT_TO), packId, act);
  // The barista's order with options, and avoiding an allergen, say how each line is made.
  const orderLine = session.tools.find((tool) => tool.name === SERVE_ORDER)?.parameters;
  if (orderLine?.properties?.items?.items?.properties?.size) {
    const cafe = cafeNpc(CAFE_SCRIPT[packId], SCRIPT[packId], itemsIn(session, SERVE_ORDER), packId, orderLine.properties.allergen !== undefined, act);
    return offeringTheUsual(cafe, usual, SCRIPT[packId], packId, act);
  }
  const script = 'npcId' in session.voice && session.voice.npcId === 'convenience-clerk' ? CLERK_SCRIPT[packId] : SCRIPT[packId];
  return offeringTheUsual(orderNpc(script, itemsIn(session, SERVE_ORDER), packId, act), usual, script, packId, act);
}

/**
 * The mock-mode NPC: a scripted fake that speaks first and answers every typed
 * line in the Target Language, after a short delay. Which one it plays comes from
 * the session: the barista or the convenience store clerk reads an order back and
 * calls serve_order only once the Player confirms; the cashier at the till asks
 * about a bag and a points card, reads them back with the total and calls
 * complete_purchase, reading back again when something is put back; the
 * cashier by the shelves checks which item and calls point_to; the shopkeeper reads back a book with its price
 * and calls complete_purchase on a yes, or for a gift, asks whether to wrap it first and reads both back; the nurse on the
 * ward lets the patient go home once they say how they feel; the landlord takes
 * all that is owed on a yes, offers three more days, or tells the tenant their
 * new rent; the barista asked for work takes a name and a start, reads them
 * back and hires on a yes, asking the name again if the sim says it's wrong; a Shift Customer orders
 * the drink in its instruction, says it again when asked, and thanks the barista or says it's the wrong
 * one when a scene says what it was handed; one at the till says all the cashier needs to hear at once
 * (bag, points card, anything from behind the counter, the cash it hands over); one at a restaurant table orders
 * for everyone at once, saying who has what and the dietary need. The server hiring is the barista's. The server
 * asks how many and where to sit and seats the guest, takes a meal order the barista's way, recommends a dish that
 * keeps to what the guest doesn't eat, and says the bill total and asks how they pay. The bathhouse attendant asks
 * whether a bather wants a towel and reads back the bath with its price before calling admit, and reads back gym
 * membership and its price before calling register_member (renewing, it reads it back as it greets). The cashier taking
 * something back hears the item and what is wrong with it and reads back the refund before calling refund. The town
 * office's clerk takes the name, address and nationality one at a time and reads the form back before calling
 * register_resident (asking the name again if it was misheard), or asks where a parcel is going and how, and reads back
 * the postage before calling ship. A passer-by at a tram stop names the stop to get off at for the place the Player
 * names, and calls give_directions once they say they've got it. Taking a regular's order, it
 * greets them with "the usual?" and serves it on a yes. In Small Talk it
 * chats back, calls learn_name when told a name, and says goodbye when a scene tells it to wrap up. Any Named NPC,
 * in any conversation, thanks the Character for a gift (more warmly for their favourite), and asked what gift they
 * would like, calls reveal_favourite and says their favourite by its local name. Each calls
 * not_understood for a line with no word it knows. It has no audio, so
 * push-to-talk does nothing. Replacing a dropped session, it picks up again
 * but has forgotten any read-back.
 */
export const openMockVoiceSession: OpenVoiceSession = (
  session: NpcSession,
  events: VoiceSessionEvents,
  options: VoiceSessionOptions = {},
) => {
  const pending = new Set<ReturnType<typeof setTimeout>>();
  const awaitingAnswer = new Map<string, (response: ToolResponse) => void>();
  let calls = 0;
  let closed = false;

  const later = (act: () => void) => {
    const timer = setTimeout(() => {
      pending.delete(timer);
      act();
    }, REPLY_DELAY_MS);
    pending.add(timer);
  };

  const say = (line: string) =>
    later(() => {
      events.onOutputTranscript(line);
      events.onTurnComplete();
    });

  const call = (name: string, args: unknown, onAnswer: (response: ToolResponse) => void) =>
    later(() => {
      const id = `mock-call-${++calls}`;
      awaitingAnswer.set(id, onAnswer);
      events.onToolCall({ id, name, args });
    });

  const close = () => {
    closed = true;
    for (const timer of pending) clearTimeout(timer);
    pending.clear();
    awaitingAnswer.clear();
  };

  const drop = () =>
    later(() => {
      close();
      events.onDisconnect();
    });

  const act: Act = {
    say,
    call,
    drop,
    notUnderstood: () =>
      call(NOT_UNDERSTOOD_TOOL, { reason: 'unintelligible' }, (response) =>
        say(response.result === 'out_of_patience' ? npc.outOfPatience : npc.notUnderstood),
      ),
  };
  const npc: Npc = castNpc(session, act);

  const hear = (line: string) => {
    if (line === OUT_OF_PATIENCE_SCENE) return say(npc.outOfPatience);
    if (line === MOCK_DROP_LINE) return drop();
    if (heardAsAnyNamedNpc(session, line, act)) return;
    npc.hear(line);
  };

  return {
    connect: async () => {
      if (!closed) say(options.resumeFrom?.length ? npc.resume : npc.greeting);
    },
    startTalking: () => {},
    stopTalking: () => {},
    sendText: (text) => {
      if (!closed) hear(text);
    },
    sendToolResponse: (id, response) => {
      const onAnswer = awaitingAnswer.get(id);
      awaitingAnswer.delete(id);
      if (!closed && onAnswer) onAnswer(response);
    },
    close,
  };
};
