import { NOT_UNDERSTOOD_TOOL, OUT_OF_PATIENCE_SCENE, type NpcSession, type ToolResponse } from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, ITEMS, localPrice, readBasketTotal, type ItemId } from '../content/index.ts';
import type { LanguageCode } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents, VoiceSessionOptions } from './voiceSession.ts';

/** Roughly how long the real NPC takes to start answering. */
const REPLY_DELAY_MS = 600;

// The completions the fake knows how to script: an order over a counter, paying at the till,
// pointing to an item on the shelves, and the nurse letting the patient go home.
const SERVE_ORDER = INTERACTIONS.orderDrink.completion.name;
const COMPLETE_PURCHASE = INTERACTIONS.payForGroceries.completion.name;
const POINT_TO = INTERACTIONS.findAnItem.completion.name;
const DISCHARGE_PATIENT = INTERACTIONS.wakeInWard.completion.name;

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

/** Which fake NPC plays this session, read from the completion it offers. */
function castNpc(session: NpcSession, act: Act): Npc {
  const packId = session.voice.targetLanguage;
  const offers = (name: string) => session.tools.some((tool) => tool.name === name);
  if (offers(DISCHARGE_PATIENT)) return wardNpc(WARD_SCRIPT[packId], act);
  if (offers(COMPLETE_PURCHASE)) return tillNpc(TILL_SCRIPT[packId], SCRIPT[packId], session.systemInstruction, act);
  if (offers(POINT_TO)) return shelvesNpc(SHELVES_SCRIPT[packId], SCRIPT[packId], itemsIn(session, POINT_TO), packId, act);
  const script = session.voice.npcId === 'convenience-clerk' ? CLERK_SCRIPT[packId] : SCRIPT[packId];
  return orderNpc(script, itemsIn(session, SERVE_ORDER), packId, act);
}

/**
 * The mock-mode NPC: a scripted fake that speaks first and answers every typed
 * line in the Target Language, after a short delay. Which one it plays comes from
 * the session: the barista or the convenience store clerk reads an order back and
 * calls serve_order only once the Player confirms; the cashier at the till asks
 * about a bag and a points card, reads them back with the total and calls
 * complete_purchase, reading back again when something is put back; the
 * cashier by the shelves checks which item and calls point_to; the nurse on the
 * ward lets the patient go home once they say how they feel. Each calls
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

  const npc: Npc = castNpc(session, {
    say,
    call,
    drop,
    notUnderstood: () =>
      call(NOT_UNDERSTOOD_TOOL, { reason: 'unintelligible' }, (response) =>
        say(response.result === 'out_of_patience' ? npc.outOfPatience : npc.notUnderstood),
      ),
  });

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
