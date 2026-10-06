import { npcCases } from '../schema.ts';

// Mandarin NPC cases. The noisy turns are as the voice prototype heard a learner: 一杯 as 一百 or "100", 小杯 as 小贝,
// and the half-heard "我要玩" and "老师，我要". A whole sentence in another language must cost Patience, so it's tagged gibberish.
// Scripts end with a spare confirmation, in case the NPC asks one more question before its read-back.

const served = (...items: [string, number][]) => ({
  outcome: 'completed' as const,
  args: { items: items.map(([item, quantity]) => ({ item, quantity })) },
});

export default npcCases([
  {
    id: 'zh-npc-latte-misheard',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'A1',
    turns: [
      { tag: 'noisy', text: '我要一百拿铁' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，谢谢', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'zh-npc-coffee-100',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'A1',
    turns: [
      { tag: 'noisy', text: '100 咖啡' },
      { tag: 'clean', text: '美式咖啡' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，谢谢', confirms: true },
    ],
    expected: served(['coffee', 1]),
  },
  {
    id: 'zh-npc-half-heard',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'A1',
    turns: [
      { tag: 'noisy', text: '我要玩' },
      { tag: 'noisy', text: '老师，我要' },
      { tag: 'clean', text: '一杯红茶' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，谢谢', confirms: true },
    ],
    expected: served(['tea', 1]),
  },
  {
    id: 'zh-npc-small-cup-misheard',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'A2',
    turns: [
      { tag: 'noisy', text: '我要一杯小贝拿铁' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，就这些', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'zh-npc-two-teas',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'A2',
    turns: [
      { tag: 'clean', text: '我要两杯红茶。' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，就这些', confirms: true },
    ],
    expected: served(['tea', 2]),
  },
  {
    id: 'zh-npc-tart-and-latte',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'B1',
    turns: [
      { tag: 'clean', text: '一个蛋挞，还有一杯热拿铁。' },
      { tag: 'clean', text: '对，就这些。', confirms: true },
      { tag: 'clean', text: '没错。', confirms: true },
    ],
    expected: served(['pastry', 1], ['latte', 1]),
  },
  {
    id: 'zh-npc-gibberish-then-order',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'A2',
    turns: [
      { tag: 'gibberish', text: '嗯嗯啊啊呃' },
      { tag: 'clean', text: '我要一杯拿铁' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，谢谢', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'zh-npc-english-sentence',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'A1',
    turns: [
      { tag: 'gibberish', text: 'Can I have a coffee, please?' },
      { tag: 'clean', text: '我要美式咖啡' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，谢谢', confirms: true },
    ],
    expected: served(['coffee', 1]),
  },
  {
    id: 'zh-npc-out-of-patience',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'C1',
    turns: [
      { tag: 'gibberish', text: '呃呃呃呃呃' },
      { tag: 'gibberish', text: 'blah blah blah' },
      { tag: 'clean', text: '我要一杯拿铁' },
    ],
    expected: { outcome: 'outOfPatience' },
  },
  {
    id: 'zh-npc-counter-food',
    interactionId: 'buy-counter-food',
    targetLanguage: 'zh',
    step: 'B1',
    turns: [
      { tag: 'clean', text: '我要一个盒饭，还有两个茶叶蛋。' },
      { tag: 'clean', text: '要热一下，谢谢。' },
      { tag: 'clean', text: '对。', confirms: true },
      { tag: 'clean', text: '对，就这些。', confirms: true },
    ],
    expected: served(['bento', 1], ['snack', 2]),
  },
  {
    id: 'zh-npc-find-eggs',
    interactionId: 'find-an-item',
    targetLanguage: 'zh',
    step: 'A2',
    turns: [
      { tag: 'clean', text: '请问，鸡蛋在哪儿？' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，谢谢', confirms: true },
    ],
    expected: { outcome: 'completed', args: { item: 'eggs' } },
  },
  {
    id: 'zh-npc-groceries-no-bag',
    interactionId: 'pay-for-groceries',
    targetLanguage: 'zh',
    step: 'A2',
    basket: [
      { itemId: 'eggs', quantity: 1 },
      { itemId: 'noodles', quantity: 1 },
    ],
    turns: [
      { tag: 'clean', text: '不要袋子。' },
      { tag: 'clean', text: '没有会员卡。' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，谢谢', confirms: true },
    ],
    expected: { outcome: 'completed', args: { bag: false, card: false } },
  },
  {
    id: 'zh-npc-hire-barista',
    interactionId: 'ask-barista-for-work',
    targetLanguage: 'zh',
    step: 'A2',
    characterName: 'Alex',
    turns: [
      { tag: 'clean', text: '你好！你们在招咖啡师吗？我想在这儿工作。' },
      { tag: 'clean', text: '我叫 Alex，A-L-E-X。' },
      { tag: 'clean', text: '我明天可以开始。' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，谢谢', confirms: true },
    ],
    expected: { outcome: 'completed', args: { start: 'tomorrow' } },
  },
  {
    id: 'zh-npc-ward',
    interactionId: 'wake-in-ward',
    targetLanguage: 'zh',
    step: 'A1',
    turns: [
      { tag: 'clean', text: '我好多了，谢谢。' },
      { tag: 'clean', text: '谢谢你。' },
    ],
    expected: { outcome: 'completed', args: { feeling: 'well' } },
  },
  {
    id: 'zh-npc-spoken-latte',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'A1',
    turns: [
      { tag: 'noisy', recording: 'zh-order-latte.wav' },
      { tag: 'clean', text: '对', confirms: true },
      { tag: 'clean', text: '对，谢谢', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'zh-npc-spoken-small-cup',
    interactionId: 'order-drink',
    targetLanguage: 'zh',
    step: 'A2',
    turns: [
      { tag: 'noisy', recording: 'zh-order-two-teas.wav' },
      { tag: 'noisy', recording: 'zh-confirm-dui.wav', confirms: true },
      { tag: 'clean', text: '对，就这些', confirms: true },
    ],
    expected: served(['tea', 2]),
  },
]);
