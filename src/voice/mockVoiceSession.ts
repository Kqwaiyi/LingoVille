import {
  NOT_UNDERSTOOD_TOOL,
  OUT_OF_PATIENCE_SCENE,
  readChangedOrder,
  readChangeScene,
  readCheckout,
  readServedScene,
  readShiftOrder,
  readTable,
  type CheckoutSaid,
  type DinerSaid,
  type NpcSession,
  type ToolResponse,
} from '../ai/index.ts';
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
  START_WHEN,
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

// The completions the fake knows how to script: an order over a counter, and the barista hiring.
const SERVE_ORDER = INTERACTIONS.orderDrink.completion.name;
const HIRE_APPLICANT = INTERACTIONS.askBaristaForWork.completion.name;

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
  },
  zh: {
    latte: ['拿铁', 'latte'],
    coffee: ['咖啡', 'coffee'],
    tea: ['红茶', '茶', 'tea'],
    pastry: ['蛋挞'],
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
  },
  en: {
    latte: ['latte'],
    coffee: ['coffee', 'americano'],
    tea: ['tea', 'cuppa'],
    pastry: ['scone'],
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
  },
  de: {
    latte: ['latte', 'milchkaffee'],
    coffee: ['kaffee', 'coffee'],
    tea: ['tee', 'tea'],
    pastry: ['brezel', 'breze'],
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
  const offers = (name: string) => session.tools.some((tool) => tool.name === name);
  if ('shiftCustomerVoice' in session.voice) {
    const atTheTill = readCheckout(session.systemInstruction);
    if (atTheTill) return tillCustomerNpc(TILL_CUSTOMER_SCRIPT[packId], SCRIPT[packId], CUSTOMER_SCRIPT[packId].repeat, atTheTill, act);
    const atTheTable = readTable(session.systemInstruction);
    if (atTheTable) return tableCustomerNpc(TABLE_CUSTOMER_SCRIPT[packId], SCRIPT[packId], CUSTOMER_SCRIPT[packId].repeat, atTheTable, act);
    return customerNpc(CUSTOMER_SCRIPT[packId], SCRIPT[packId], session.systemInstruction, act);
  }
  if (offers(HIRE_APPLICANT)) return hiringNpc(HIRING_SCRIPT[packId], SCRIPT[packId], act);
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
 * calls serve_order only once the Player confirms; the barista asked for work takes a name and a start, reads them
 * back and hires on a yes, asking the name again if the sim says it's wrong; a Shift Customer orders
 * the drink in its instruction, says it again when asked, and thanks the barista or says it's the wrong
 * one when a scene says what it was handed; one at the till says all the cashier needs to hear at once
 * (bag, points card, anything from behind the counter, the cash it hands over); one at a restaurant table orders
 * for everyone at once, saying who has what and the dietary need. The server hiring is the barista's. Each calls
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
