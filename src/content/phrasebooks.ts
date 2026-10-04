import { z } from 'zod';
import { LANGUAGE_CODES, type LanguageCode, type PlaceId } from '../sim/index.ts';

// Each place's phrasebook, authored per Culture Pack: useful phrases in the
// Target Language, with a gloss in each of the other three Native Languages.
// Ticket 13 authors the rest of the town.

/** Target Languages whose phrases carry a reading: hiragana for Japanese, pinyin with tone marks for Chinese. */
const HAS_READING: readonly LanguageCode[] = ['ja', 'zh'];

/** The schema a place phrasebook in this pack must pass. */
export function placePhrasebookSchema(packId: LanguageCode) {
  const others = LANGUAGE_CODES.filter((language) => language !== packId);
  const phrase = z.object({
    text: z.string().trim().min(1),
    reading: HAS_READING.includes(packId) ? z.string().trim().min(1) : z.string(),
    glosses: z.strictObject(Object.fromEntries(others.map((language) => [language, z.string().trim().min(1)]))),
  });
  return z.array(phrase).refine((phrases) => new Set(phrases.map((p) => p.text)).size === phrases.length, {
    message: 'A phrase appears twice in one phrasebook.',
  });
}

/** One phrase in a place's phrasebook. Glosses are keyed by Native Language. */
export type PlacePhrase = { text: string; reading: string; glosses: Partial<Record<LanguageCode, string>> };

export const PLACE_PHRASEBOOKS: Record<LanguageCode, Partial<Record<PlaceId, PlacePhrase[]>>> = {
  ja: {
    cafe: [
      {
        text: 'メニューをください。',
        reading: 'めにゅーをください。',
        glosses: { zh: '请给我菜单。', en: 'The menu, please.', de: 'Die Karte, bitte.' },
      },
      {
        text: 'ホットラテをください。',
        reading: 'ほっとらてをください。',
        glosses: { zh: '请给我一杯热拿铁。', en: 'A hot latte, please.', de: 'Einen heißen Latte, bitte.' },
      },
      {
        text: 'おすすめは何ですか？',
        reading: 'おすすめはなんですか？',
        glosses: { zh: '你们推荐什么？', en: 'What do you recommend?', de: 'Was empfehlen Sie?' },
      },
      {
        text: 'これをお願いします。',
        reading: 'これをおねがいします。',
        glosses: { zh: '我要这个。', en: 'This one, please.', de: 'Das hier, bitte.' },
      },
      {
        text: '店内で。',
        reading: 'てんないで。',
        glosses: { zh: '在这里喝。', en: 'For here.', de: 'Zum Hiertrinken.' },
      },
      {
        text: '持ち帰りで。',
        reading: 'もちかえりで。',
        glosses: { zh: '带走。', en: 'To take away.', de: 'Zum Mitnehmen.' },
      },
      {
        text: 'カードで払えますか？',
        reading: 'かーどではらえますか？',
        glosses: { zh: '可以刷卡吗？', en: 'Can I pay by card?', de: 'Kann ich mit Karte zahlen?' },
      },
      {
        text: 'トイレはどこですか？',
        reading: 'といれはどこですか？',
        glosses: { zh: '洗手间在哪里？', en: 'Where is the toilet?', de: 'Wo ist die Toilette?' },
      },
      {
        text: 'もう一度お願いします。',
        reading: 'もういちどおねがいします。',
        glosses: { zh: '请再说一遍。', en: 'Once more, please.', de: 'Noch einmal, bitte.' },
      },
      {
        text: 'ゆっくりお願いします。',
        reading: 'ゆっくりおねがいします。',
        glosses: { zh: '请说慢一点。', en: 'More slowly, please.', de: 'Langsamer, bitte.' },
      },
      {
        text: 'ありがとうございます。',
        reading: 'ありがとうございます。',
        glosses: { zh: '谢谢。', en: 'Thank you.', de: 'Danke schön.' },
      },
    ],
  },
  zh: {
    cafe: [
      {
        text: '请给我看一下菜单。',
        reading: 'qǐng gěi wǒ kàn yí xià càidān。',
        glosses: { ja: 'メニューを見せてください。', en: 'Can I see the menu, please?', de: 'Kann ich bitte die Karte sehen?' },
      },
      {
        text: '我要一杯热拿铁。',
        reading: 'wǒ yào yì bēi rè nátiě。',
        glosses: { ja: 'ホットラテを一つください。', en: 'A hot latte, please.', de: 'Einen heißen Latte, bitte.' },
      },
      {
        text: '你们有什么推荐的？',
        reading: 'nǐmen yǒu shénme tuījiàn de？',
        glosses: { ja: 'おすすめは何ですか？', en: 'What do you recommend?', de: 'Was empfehlen Sie?' },
      },
      {
        text: '我要这个。',
        reading: 'wǒ yào zhège。',
        glosses: { ja: 'これをください。', en: 'This one, please.', de: 'Das hier, bitte.' },
      },
      {
        text: '在这儿喝。',
        reading: 'zài zhèr hē。',
        glosses: { ja: '店内で飲みます。', en: 'For here.', de: 'Zum Hiertrinken.' },
      },
      {
        text: '打包带走。',
        reading: 'dǎbāo dài zǒu。',
        glosses: { ja: '持ち帰りで。', en: 'To take away.', de: 'Zum Mitnehmen.' },
      },
      {
        text: '可以用微信付款吗？',
        reading: 'kěyǐ yòng Wēixìn fùkuǎn ma？',
        glosses: { ja: 'WeChatで払えますか？', en: 'Can I pay with WeChat?', de: 'Kann ich mit WeChat bezahlen?' },
      },
      {
        text: '洗手间在哪里？',
        reading: 'xǐshǒujiān zài nǎlǐ？',
        glosses: { ja: 'トイレはどこですか？', en: 'Where is the toilet?', de: 'Wo ist die Toilette?' },
      },
      {
        text: '请再说一遍。',
        reading: 'qǐng zài shuō yí biàn。',
        glosses: { ja: 'もう一度お願いします。', en: 'Once more, please.', de: 'Noch einmal, bitte.' },
      },
      {
        text: '请说慢一点。',
        reading: 'qǐng shuō màn yìdiǎn。',
        glosses: { ja: 'ゆっくりお願いします。', en: 'More slowly, please.', de: 'Langsamer, bitte.' },
      },
      {
        text: '谢谢！',
        reading: 'xièxie！',
        glosses: { ja: 'ありがとう！', en: 'Thank you!', de: 'Danke!' },
      },
    ],
  },
  en: {
    cafe: [
      {
        text: 'Could I see the menu, please?',
        reading: '',
        glosses: { ja: 'メニューを見せてもらえますか？', zh: '可以看一下菜单吗？', de: 'Könnte ich bitte die Karte sehen?' },
      },
      {
        text: 'Could I get a latte, please?',
        reading: '',
        glosses: { ja: 'ラテをお願いできますか？', zh: '可以给我一杯拿铁吗？', de: 'Könnte ich einen Latte bekommen?' },
      },
      {
        text: 'What would you recommend?',
        reading: '',
        glosses: { ja: '何がおすすめですか？', zh: '你推荐什么？', de: 'Was würden Sie empfehlen?' },
      },
      {
        text: "I'll have this one, please.",
        reading: '',
        glosses: { ja: 'これをお願いします。', zh: '我要这个。', de: 'Ich nehme das hier, bitte.' },
      },
      {
        text: 'To have in, please.',
        reading: '',
        glosses: { ja: '店内でお願いします。', zh: '在这里吃喝。', de: 'Zum Hieressen, bitte.' },
      },
      {
        text: 'To take away, please.',
        reading: '',
        glosses: { ja: '持ち帰りでお願いします。', zh: '请打包带走。', de: 'Zum Mitnehmen, bitte.' },
      },
      {
        text: 'Can I pay by card?',
        reading: '',
        glosses: { ja: 'カードで払えますか？', zh: '可以刷卡吗？', de: 'Kann ich mit Karte zahlen?' },
      },
      {
        text: 'Where are the toilets, please?',
        reading: '',
        glosses: { ja: 'トイレはどこですか？', zh: '请问洗手间在哪里？', de: 'Wo sind bitte die Toiletten?' },
      },
      {
        text: 'Sorry, could you say that again?',
        reading: '',
        glosses: { ja: 'すみません、もう一度言ってもらえますか？', zh: '不好意思，能再说一遍吗？', de: 'Entschuldigung, könnten Sie das wiederholen?' },
      },
      {
        text: 'Could you speak a bit more slowly?',
        reading: '',
        glosses: { ja: 'もう少しゆっくり話してもらえますか？', zh: '能说慢一点吗？', de: 'Könnten Sie etwas langsamer sprechen?' },
      },
      {
        text: 'Cheers!',
        reading: '',
        glosses: { ja: 'どうも！（ありがとう）', zh: '谢啦！', de: 'Danke!' },
      },
    ],
  },
  de: {
    cafe: [
      {
        text: 'Kann ich bitte die Karte haben?',
        reading: '',
        glosses: { ja: 'メニューをもらえますか？', zh: '可以给我菜单吗？', en: 'Could I have the menu, please?' },
      },
      {
        text: 'Einen Latte macchiato, bitte.',
        reading: '',
        glosses: { ja: 'ラテ・マキアートを一つください。', zh: '请来一杯拿铁玛奇朵。', en: 'A latte macchiato, please.' },
      },
      {
        text: 'Was können Sie empfehlen?',
        reading: '',
        glosses: { ja: '何がおすすめですか？', zh: '您推荐什么？', en: 'What can you recommend?' },
      },
      {
        text: 'Ich nehme das hier.',
        reading: '',
        glosses: { ja: 'これにします。', zh: '我要这个。', en: "I'll take this one." },
      },
      {
        text: 'Zum Hiertrinken.',
        reading: '',
        glosses: { ja: '店内で飲みます。', zh: '在这里喝。', en: 'For here.' },
      },
      {
        text: 'Zum Mitnehmen, bitte.',
        reading: '',
        glosses: { ja: '持ち帰りでお願いします。', zh: '请打包带走。', en: 'To take away, please.' },
      },
      {
        text: 'Kann ich mit Karte zahlen?',
        reading: '',
        glosses: { ja: 'カードで払えますか？', zh: '可以刷卡吗？', en: 'Can I pay by card?' },
      },
      {
        text: 'Wo ist die Toilette?',
        reading: '',
        glosses: { ja: 'トイレはどこですか？', zh: '洗手间在哪里？', en: 'Where is the toilet?' },
      },
      {
        text: 'Noch einmal, bitte.',
        reading: '',
        glosses: { ja: 'もう一度お願いします。', zh: '请再说一遍。', en: 'Once more, please.' },
      },
      {
        text: 'Etwas langsamer, bitte.',
        reading: '',
        glosses: { ja: 'もう少しゆっくりお願いします。', zh: '请说慢一点。', en: 'A bit more slowly, please.' },
      },
      {
        text: 'Danke schön!',
        reading: '',
        glosses: { ja: 'ありがとうございます！', zh: '谢谢！', en: 'Thank you!' },
      },
    ],
  },
};

/** The phrasebook for a place in a pack, or none if it has none yet. */
export function placePhrasebook(packId: LanguageCode, placeId: PlaceId): PlacePhrase[] {
  return PLACE_PHRASEBOOKS[packId][placeId] ?? [];
}
