import { z } from 'zod';
import { LANGUAGE_CODES, type LanguageCode, type PlaceId } from '../sim/index.ts';

// Each place's phrasebook, authored per Culture Pack: useful phrases in the
// Target Language, with a gloss in each of the other three Native Languages.
// Ticket 11 authors the rest of the packs; ticket 13 the rest of the town.

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
  zh: {},
  en: {},
  de: {},
};

/** The phrasebook for a place in a pack, or none if it has none yet. */
export function placePhrasebook(packId: LanguageCode, placeId: PlaceId): PlacePhrase[] {
  return PLACE_PHRASEBOOKS[packId][placeId] ?? [];
}
