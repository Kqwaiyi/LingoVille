import { NOT_UNDERSTOOD_TOOL, OUT_OF_PATIENCE_SCENE, type ToolResponse } from '../ai/index.ts';
import { CAFE_ITEM_IDS, CAFE_ITEMS, CULTURE_PACKS, INTERACTIONS, toLocalMoney, type CafeItemId } from '../content/index.ts';
import type { LanguageCode } from '../sim/index.ts';
import type { OpenVoiceSession } from './voiceSession.ts';

/** Roughly how long the real NPC takes to start answering. */
const REPLY_DELAY_MS = 600;

// The café order is the only completion the fake knows how to script.
const SERVE_ORDER = INTERACTIONS.orderDrink.completion.name;

/**
 * Typed to the fake NPC, this makes its connection drop, so the smoke tests can
 * script a network failure. It only exists in mock mode.
 */
export const MOCK_DROP_LINE = '#drop';

type Script = {
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
  /** The words it recognises. A line with none of them is gibberish to it. */
  words: { items: Record<CafeItemId, string[]>; yes: string[]; no: string[]; known: string[] };
};

const SCRIPT: Record<LanguageCode, Script> = {
  ja: {
    greeting: 'いらっしゃいませ！ご注文はお決まりですか？',
    resume: '大変お待たせしました。ご注文をどうぞ。',
    clarify: ['ご注文は何になさいますか？', 'ラテ、コーヒー、紅茶がございます。どれにしますか？'],
    readBack: (item, price) => `${item}ですね。${price}です。よろしいですか？`,
    served: 'ありがとうございます！こちら、どうぞ。またお越しくださいませ。',
    cannotAfford: '申し訳ございません、お支払いが足りないようです。ほかのものになさいますか？',
    askAgain: '失礼しました。ご注文は何になさいますか？',
    notUnderstood: 'すみません、よくわかりませんでした。',
    outOfPatience: '申し訳ございません…。またのお越しをお待ちしております。',
    price: (amount) => `${amount}円`,
    words: {
      items: { latte: ['ラテ', 'らて', 'latte'], coffee: ['コーヒー', 'こーひー', 'coffee'], tea: ['紅茶', 'こうちゃ', 'tea'] },
      yes: ['はい', 'ええ', 'うん', 'お願いします', 'おねがいします', 'yes', 'ok'],
      no: ['いいえ', 'いや', 'ちがいます', '違います', 'no'],
      known: ['ください', 'こんにちは', 'おはよう', 'すみません', 'ありがとう', 'メニュー', 'hello'],
    },
  },
  zh: {
    greeting: '欢迎光临！您想喝点什么？',
    resume: '让您久等了。您想喝点什么？',
    clarify: ['您想喝点什么？', '我们有拿铁、咖啡和红茶。您要哪个？'],
    readBack: (item, price) => `一杯${item}，${price}。对吗？`,
    served: '好的，这是您的饮料。欢迎下次光临！',
    cannotAfford: '不好意思，您的钱好像不够。要换别的吗？',
    askAgain: '不好意思。您要点什么？',
    notUnderstood: '不好意思，我没听懂。',
    outOfPatience: '真不好意思……欢迎下次再来。',
    price: (amount) => `${amount}元`,
    words: {
      items: { latte: ['拿铁', 'latte'], coffee: ['咖啡', 'coffee'], tea: ['红茶', '茶', 'tea'] },
      yes: ['好', '对', '是', '可以', 'yes', 'ok'],
      no: ['不', 'no'],
      known: ['你好', '请', '谢谢', '菜单', '要', 'hello'],
    },
  },
  en: {
    greeting: 'Hiya! What can I get you?',
    resume: 'Sorry about that! What can I get you?',
    clarify: ['What would you like?', "We've got lattes, coffee and tea. Which one?"],
    readBack: (item, price) => `One ${item.toLowerCase()}, that's ${price}. Is that right?`,
    served: 'Lovely, here you go. Have a nice day!',
    cannotAfford: "Sorry, it looks like that's not enough. Would you like something else?",
    askAgain: 'Sorry! What would you like?',
    notUnderstood: "Sorry, I didn't catch that.",
    outOfPatience: "I'm so sorry, I can't quite help. Maybe another time!",
    price: (amount) => `£${amount.toFixed(2)}`,
    words: {
      items: { latte: ['latte'], coffee: ['coffee', 'americano'], tea: ['tea', 'cuppa'] },
      yes: ['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'right', 'correct'],
      no: ['no', 'nope', 'wrong'],
      known: ['hello', 'hi', 'hiya', 'please', 'thanks', 'thank you', 'menu', 'morning'],
    },
  },
  de: {
    greeting: 'Hallo! Was darf’s sein?',
    resume: 'Entschuldigung! Was darf’s sein?',
    clarify: ['Was möchten Sie trinken?', 'Wir haben Latte, Kaffee und Tee. Was darf’s sein?'],
    readBack: (item, price) => `Einmal ${item} für ${price}, richtig?`,
    served: 'Bitte schön! Einen schönen Tag noch!',
    cannotAfford: 'Oh, das reicht leider nicht. Möchten Sie etwas anderes?',
    askAgain: 'Entschuldigung! Was möchten Sie?',
    notUnderstood: 'Entschuldigung, das habe ich nicht verstanden.',
    outOfPatience: 'Tut mir leid… Vielleicht ein anderes Mal. Tschüss!',
    price: (amount) => `${amount.toFixed(2).replace('.', ',')} €`,
    words: {
      items: { latte: ['latte', 'milchkaffee'], coffee: ['kaffee', 'coffee'], tea: ['tee', 'tea'] },
      yes: ['ja', 'genau', 'gerne', 'okay', 'ok', 'richtig', 'stimmt'],
      no: ['nein', 'nee', 'falsch'],
      known: ['hallo', 'guten', 'bitte', 'danke', 'karte', 'moin', 'hello'],
    },
  },
};

const LATIN = /^[\p{Script=Latin}\s']+$/u;

/** Whole words for Latin-script words ("no" isn't in "know"); anywhere in the line otherwise. */
function mentions(line: string, words: string[]) {
  const lower = line.toLowerCase();
  return words.some((word) =>
    LATIN.test(word) ? new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, 'iu').test(lower) : lower.includes(word),
  );
}

/**
 * The mock-mode NPC: a scripted fake barista that greets first and answers
 * every typed line in the Target Language, after a short delay. It reads an
 * order back and calls serve_order only once the Player confirms, and calls
 * not_understood for a line with no word it knows. It has no audio, so
 * push-to-talk does nothing. Replacing a dropped session, it picks up again
 * but has forgotten any read-back.
 */
export const openMockVoiceSession: OpenVoiceSession = (session, events, options = {}) => {
  const packId = session.voice.targetLanguage;
  const script = SCRIPT[packId];
  const takesOrders = session.tools.some((tool) => tool.name === SERVE_ORDER);
  const pending = new Set<ReturnType<typeof setTimeout>>();
  const awaitingAnswer = new Map<string, (response: ToolResponse) => void>();
  let clarifications = 0;
  let calls = 0;
  let readBack: CafeItemId | null = null;
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

  const drop = () =>
    later(() => {
      close();
      events.onDisconnect();
    });

  const hear = (line: string) => {
    if (line === OUT_OF_PATIENCE_SCENE) return say(script.outOfPatience);
    if (line === MOCK_DROP_LINE) return drop();

    const item = takesOrders ? CAFE_ITEM_IDS.find((id) => mentions(line, script.words.items[id])) : undefined;
    if (item) {
      readBack = item;
      const { amount } = toLocalMoney(CAFE_ITEMS[item].priceInShifts, packId);
      return say(script.readBack(CULTURE_PACKS[packId].cafe.menu[item], script.price(amount)));
    }
    if (readBack && mentions(line, script.words.no)) {
      readBack = null;
      return say(script.askAgain);
    }
    if (readBack && mentions(line, script.words.yes)) {
      const order = { items: [{ item: readBack, quantity: 1 }] };
      readBack = null;
      return call(SERVE_ORDER, order, (response) => {
        if (response.result === 'served') say(script.served);
        else if (response.result === 'cannot_afford') say(script.cannotAfford);
        else say(script.askAgain);
      });
    }
    const { yes, no, known } = script.words;
    if (mentions(line, [...yes, ...no, ...known])) return say(script.clarify[clarifications++ % script.clarify.length]!);

    call(NOT_UNDERSTOOD_TOOL, { reason: 'unintelligible' }, (response) =>
      say(response.result === 'out_of_patience' ? script.outOfPatience : script.notUnderstood),
    );
  };

  const close = () => {
    closed = true;
    for (const timer of pending) clearTimeout(timer);
    pending.clear();
    awaitingAnswer.clear();
  };

  return {
    connect: async () => {
      if (!closed) say(options.resumeFrom?.length ? script.resume : script.greeting);
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
