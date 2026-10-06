import { npcCases } from '../schema.ts';

// Japanese NPC cases. The noisy turns are written the way live transcription hears a learner's Japanese: long vowels
// and small っ dropped or added (こちゃ for こうちゃ, ラッテ for ラテ), and particles missing.
// A whole sentence in another language must cost Patience, so it's tagged gibberish.
// Scripts end with a spare confirmation, in case the NPC asks one more question before its read-back.

const served = (...items: [string, number][]) => ({
  outcome: 'completed' as const,
  args: { items: items.map(([item, quantity]) => ({ item, quantity })) },
});

export default npcCases([
  {
    id: 'ja-npc-latte',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'A1',
    turns: [
      { tag: 'clean', text: 'ホットラテをひとつください。' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、お願いします', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'ja-npc-latte-misheard',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'A1',
    turns: [
      { tag: 'noisy', text: 'ホット ラッテ ひとつ' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、お願いします', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'ja-npc-two-teas-misheard',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'A1',
    turns: [
      { tag: 'noisy', text: 'こちゃ、ふたつ、ください' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、それで', confirms: true },
    ],
    expected: served(['tea', 2]),
  },
  {
    id: 'ja-npc-two-lattes-dialect',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'A2',
    turns: [
      { tag: 'noisy', text: 'ラテ ふたっつ' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、お願いします', confirms: true },
    ],
    expected: served(['latte', 2]),
  },
  {
    id: 'ja-npc-coffee',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'A2',
    turns: [
      { tag: 'clean', text: 'ブレンドコーヒーを一つお願いします。' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、以上です', confirms: true },
    ],
    expected: served(['coffee', 1]),
  },
  {
    id: 'ja-npc-melon-and-tea',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'B1',
    turns: [
      { tag: 'clean', text: 'メロンパンと紅茶を一つずつください。' },
      { tag: 'clean', text: 'はい、以上です。', confirms: true },
      { tag: 'clean', text: 'はい。', confirms: true },
    ],
    expected: served(['pastry', 1], ['tea', 1]),
  },
  {
    id: 'ja-npc-gibberish-then-order',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'A2',
    turns: [
      { tag: 'gibberish', text: 'あうあうえお' },
      { tag: 'clean', text: 'ホットラテをください。' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、お願いします', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'ja-npc-english-sentence',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'A1',
    turns: [
      { tag: 'gibberish', text: 'Could I get a cup of black tea, please?' },
      { tag: 'clean', text: '紅茶をください。' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、お願いします', confirms: true },
    ],
    expected: served(['tea', 1]),
  },
  {
    id: 'ja-npc-out-of-patience',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'C1',
    turns: [
      { tag: 'gibberish', text: 'ぬぬぬぬぬ' },
      { tag: 'gibberish', text: 'blorf glib' },
      { tag: 'clean', text: 'ラテをください。' },
    ],
    expected: { outcome: 'outOfPatience' },
  },
  {
    id: 'ja-npc-counter-food',
    interactionId: 'buy-counter-food',
    targetLanguage: 'ja',
    step: 'B1',
    turns: [
      { tag: 'clean', text: 'のり弁当とからあげを一つずつください。' },
      { tag: 'clean', text: '温めてください。' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、以上です', confirms: true },
    ],
    expected: served(['bento', 1], ['snack', 1]),
  },
  {
    id: 'ja-npc-find-udon',
    interactionId: 'find-an-item',
    targetLanguage: 'ja',
    step: 'A2',
    turns: [
      { tag: 'noisy', text: 'すみません うどん どこ' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、そうです', confirms: true },
    ],
    expected: { outcome: 'completed', args: { item: 'noodles' } },
  },
  {
    id: 'ja-npc-groceries-card',
    interactionId: 'pay-for-groceries',
    targetLanguage: 'ja',
    step: 'B1',
    basket: [
      { itemId: 'vegetables', quantity: 1 },
      { itemId: 'eggs', quantity: 1 },
    ],
    turns: [
      { tag: 'clean', text: '袋はいりません。ポイントカードはあります。' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、お願いします', confirms: true },
    ],
    expected: { outcome: 'completed', args: { bag: false, card: true } },
  },
  {
    id: 'ja-npc-hire-barista',
    interactionId: 'ask-barista-for-work',
    targetLanguage: 'ja',
    step: 'A2',
    characterName: 'Alex',
    turns: [
      { tag: 'clean', text: 'すみません、ここで働きたいです。バリスタを募集していますか。' },
      { tag: 'clean', text: '名前はアレックスです。A、L、E、X です。' },
      { tag: 'clean', text: '明日から働けます。' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、よろしくお願いします', confirms: true },
    ],
    expected: { outcome: 'completed', args: { start: 'tomorrow' } },
  },
  {
    id: 'ja-npc-ward',
    interactionId: 'wake-in-ward',
    targetLanguage: 'ja',
    step: 'A1',
    turns: [
      { tag: 'clean', text: 'だいぶ良くなりました。' },
      { tag: 'clean', text: 'ありがとうございます。' },
    ],
    expected: { outcome: 'completed', args: { feeling: 'well' } },
  },
  {
    id: 'ja-npc-spoken-latte',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'A1',
    turns: [
      { tag: 'noisy', recording: 'ja-order-latte.wav' },
      { tag: 'clean', text: 'はい', confirms: true },
      { tag: 'clean', text: 'はい、お願いします', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'ja-npc-spoken-melon',
    interactionId: 'order-drink',
    targetLanguage: 'ja',
    step: 'A2',
    turns: [
      { tag: 'noisy', recording: 'ja-order-melon-bread.wav' },
      { tag: 'noisy', recording: 'ja-confirm-hai.wav', confirms: true },
      { tag: 'clean', text: 'はい、以上です', confirms: true },
    ],
    expected: served(['pastry', 1]),
  },
]);
