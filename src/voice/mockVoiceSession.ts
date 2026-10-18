import { NOT_UNDERSTOOD_TOOL, OUT_OF_PATIENCE_SCENE, type NpcSession, type ToolResponse } from '../ai/index.ts';
import {
  ALLERGENS,
  cafeAllergensIn,
  CULTURE_PACKS,
  DRINK_EXTRAS,
  DRINK_SIZES,
  DRINK_TEMPERATURES,
  formatLocalMoney,
  INTERACTIONS,
  isMadeToOrder,
  ITEMS,
  localPrice,
  MADE_TO_ORDER_EXTRAS,
  menuPrice,
  type Allergen,
  type DrinkExtra,
  type DrinkOptionId,
  type DrinkSize,
  type DrinkTemperature,
  type ItemId,
} from '../content/index.ts';
import type { LanguageCode } from '../sim/index.ts';
import type { VoiceSession, VoiceSessionEvents, VoiceSessionOptions } from './voiceSession.ts';

/** Roughly how long the real NPC takes to start answering: the delay when the gateway names none. */
const DEFAULT_REPLY_DELAY_MS = 600;

// The completion the fake knows how to script: an order over a counter.
const SERVE_ORDER = INTERACTIONS.orderDrink.completion.name;

/**
 * Typed to the fake NPC, this makes its connection drop, so a network failure
 * can be tried on purpose. It only exists in mock mode.
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
    vegetables: ['キャベツ', 'きゃべつ', '野菜', 'やさい'],
    eggs: ['卵', 'たまご', '玉子', 'egg'],
    noodles: ['うどん', 'udon'],
    'pork-dish': ['ポークソテー', 'ぽーくそてー', 'ポーク'],
    'chicken-dish': ['チキン南蛮', 'ちきんなんばん', 'チキン'],
    'fish-dish': ['焼き鮭', '鮭', 'さけ', 'しゃけ'],
    'veggie-dish': ['パスタ', 'ぱすた', 'pasta'],
    juice: ['ジュース', 'じゅーす', 'juice'],
    cola: ['コーラ', 'こーら', 'cola'],
    cake: ['ケーキ', 'けーき', 'cake'],
    'special-drink': ['クリームソーダ', 'くりーむそーだ', 'ソーダ'],
  },
  zh: {
    latte: ['拿铁', 'latte'],
    coffee: ['咖啡', 'coffee'],
    tea: ['红茶', '茶', 'tea'],
    pastry: ['蛋挞'],
    vegetables: ['青菜', '蔬菜'],
    eggs: ['鸡蛋'],
    noodles: ['挂面', '面条'],
    'pork-dish': ['糖醋里脊', '里脊'],
    'chicken-dish': ['宫保鸡丁', '鸡丁'],
    'fish-dish': ['清蒸鱼', '鱼'],
    'veggie-dish': ['地三鲜'],
    juice: ['橙汁', '果汁', 'juice'],
    cola: ['可乐', 'cola'],
    cake: ['提拉米苏', '蛋糕'],
    'special-drink': ['芒果冰沙', '冰沙'],
  },
  en: {
    latte: ['latte'],
    coffee: ['coffee', 'americano'],
    tea: ['tea', 'cuppa'],
    pastry: ['scone'],
    vegetables: ['carrots', 'carrot', 'vegetables'],
    eggs: ['eggs', 'egg'],
    noodles: ['spaghetti', 'pasta'],
    'pork-dish': ['sausage and mash', 'bangers'],
    'chicken-dish': ['chicken pie'],
    'fish-dish': ['fish and chips', 'fish'],
    'veggie-dish': ['veggie burger', 'burger'],
    juice: ['orange juice', 'juice'],
    cola: ['cola', 'coke'],
    cake: ['victoria sponge', 'sponge', 'cake'],
    'special-drink': ['hot chocolate', 'chocolate'],
  },
  de: {
    latte: ['latte', 'milchkaffee'],
    coffee: ['kaffee', 'coffee'],
    tea: ['tee', 'tea'],
    pastry: ['brezel', 'breze'],
    vegetables: ['kartoffeln', 'kartoffel'],
    eggs: ['eier', 'ei'],
    noodles: ['spätzle', 'nudeln'],
    'pork-dish': ['schnitzel'],
    'chicken-dish': ['geschnetzeltes', 'hähnchen'],
    'fish-dish': ['lachs', 'fisch'],
    'veggie-dish': ['käsespätzle'],
    juice: ['orangensaft', 'saft'],
    cola: ['cola'],
    cake: ['käsekuchen', 'kuchen'],
    'special-drink': ['heiße schokolade', 'schokolade', 'kakao'],
  },
};

/** A fake NPC taking an order over a counter: the barista. */
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

/** An order read back and taken over a counter, completed with serve_order. */
function orderNpc(script: OrderScript, menu: ItemId[], packId: LanguageCode, act: Act): Npc {
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
        return act.call(SERVE_ORDER, order, (response) => {
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

/**
 * The barista taking an order with options, and one avoiding an allergen: first asking about allergies, then
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
 * iced. The whole order is read back with its total and served on a yes. It reads back anything the
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

/** Which fake NPC plays this session, read from the completion it offers. */
function castNpc(session: NpcSession, act: Act): Npc {
  const packId = session.voice.targetLanguage;
  // The barista's order with options, and avoiding an allergen, say how each line is made.
  const orderLine = session.tools.find((tool) => tool.name === SERVE_ORDER)?.parameters;
  if (orderLine?.properties?.items?.items?.properties?.size) {
    return cafeNpc(CAFE_SCRIPT[packId], SCRIPT[packId], itemsIn(session, SERVE_ORDER), packId, orderLine.properties.allergen !== undefined, act);
  }
  return orderNpc(SCRIPT[packId], itemsIn(session, SERVE_ORDER), packId, act);
}

/**
 * The mock-mode NPC: a scripted fake that speaks first and answers every typed
 * line in the Target Language, after a short delay. Which one it plays comes from
 * the session: the barista reads an order back and
 * calls serve_order only once the Player confirms. It calls
 * not_understood for a line with no word it knows. It has no audio, so
 * push-to-talk does nothing. Replacing a dropped session, it picks up again
 * but has forgotten any read-back. Every event waits `replyDelayMs`, from the gateway's
 * token, and comes from a timer even at 0, never from within the call that caused it.
 */
export const openMockVoiceSession = (
  session: NpcSession,
  events: VoiceSessionEvents,
  options: VoiceSessionOptions = {},
  replyDelayMs = DEFAULT_REPLY_DELAY_MS,
): VoiceSession => {
  const pending = new Set<ReturnType<typeof setTimeout>>();
  const awaitingAnswer = new Map<string, (response: ToolResponse) => void>();
  let calls = 0;
  let closed = false;

  const later = (act: () => void) => {
    const timer = setTimeout(() => {
      pending.delete(timer);
      act();
    }, replyDelayMs);
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
