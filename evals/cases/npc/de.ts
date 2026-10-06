import { npcCases } from '../schema.ts';

// German NPC cases. The noisy turns are written the way live transcription hears a learner: "bitte" as "bitter",
// "Kaffee" short, "Kartoffeln" with one f. A whole sentence in another language must cost Patience, so it's tagged gibberish.
// Scripts end with a spare confirmation, in case the NPC asks one more question before its read-back.

const served = (...items: [string, number][]) => ({
  outcome: 'completed' as const,
  args: { items: items.map(([item, quantity]) => ({ item, quantity })) },
});

export default npcCases([
  {
    id: 'de-npc-latte',
    interactionId: 'order-drink',
    targetLanguage: 'de',
    step: 'A1',
    turns: [
      { tag: 'clean', text: 'Einen Latte macchiato, bitte.' },
      { tag: 'clean', text: 'Ja.', confirms: true },
      { tag: 'clean', text: 'Ja, danke.', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'de-npc-coffee-misheard',
    interactionId: 'order-drink',
    targetLanguage: 'de',
    step: 'A1',
    turns: [
      { tag: 'noisy', text: 'ein filter kaffe bitter' },
      { tag: 'clean', text: 'Ja.', confirms: true },
      { tag: 'clean', text: 'Ja, danke.', confirms: true },
    ],
    expected: served(['coffee', 1]),
  },
  {
    id: 'de-npc-pretzel-and-tea',
    interactionId: 'order-drink',
    targetLanguage: 'de',
    step: 'B1',
    turns: [
      { tag: 'clean', text: 'Ich hätte gern eine Butterbrezel und einen Schwarztee.' },
      { tag: 'clean', text: 'Ja, genau.', confirms: true },
      { tag: 'clean', text: 'Das ist alles, danke.', confirms: true },
    ],
    expected: served(['pastry', 1], ['tea', 1]),
  },
  {
    id: 'de-npc-out-of-patience',
    interactionId: 'order-drink',
    targetLanguage: 'de',
    step: 'C1',
    turns: [
      { tag: 'gibberish', text: 'hmpf grmbl' },
      { tag: 'gibberish', text: 'Can I have a coffee, please?' },
      { tag: 'clean', text: 'Einen Filterkaffee, bitte.' },
    ],
    expected: { outcome: 'outOfPatience' },
  },
  {
    id: 'de-npc-bockwurst',
    interactionId: 'buy-counter-food',
    targetLanguage: 'de',
    step: 'B2',
    turns: [
      { tag: 'clean', text: 'Zwei Bockwurst, bitte.' },
      { tag: 'clean', text: 'Ja, bitte.', confirms: true },
      { tag: 'clean', text: 'Das wär’s.', confirms: true },
    ],
    expected: served(['snack', 2]),
  },
  {
    id: 'de-npc-find-potatoes',
    interactionId: 'find-an-item',
    targetLanguage: 'de',
    step: 'A2',
    turns: [
      { tag: 'noisy', text: 'wo sind die kartofeln' },
      { tag: 'clean', text: 'Ja.', confirms: true },
      { tag: 'clean', text: 'Ja, genau.', confirms: true },
    ],
    expected: { outcome: 'completed', args: { item: 'vegetables' } },
  },
  {
    id: 'de-npc-groceries-bag-and-card',
    interactionId: 'pay-for-groceries',
    targetLanguage: 'de',
    step: 'B1',
    basket: [{ itemId: 'eggs', quantity: 2 }],
    turns: [
      { tag: 'clean', text: 'Eine Tüte, bitte. Und ich habe eine Kundenkarte.' },
      { tag: 'clean', text: 'Ja.', confirms: true },
      { tag: 'clean', text: 'Ja, genau.', confirms: true },
    ],
    expected: { outcome: 'completed', args: { bag: true, card: true } },
  },
  {
    id: 'de-npc-spoken-latte',
    interactionId: 'order-drink',
    targetLanguage: 'de',
    step: 'A1',
    turns: [
      { tag: 'noisy', recording: 'de-order-latte.wav' },
      { tag: 'clean', text: 'Ja.', confirms: true },
      { tag: 'clean', text: 'Ja, danke.', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
]);
