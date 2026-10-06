import { npcCases } from '../schema.ts';

// English NPC cases. The noisy turns are written the way live transcription hears a learner: "latte" as "later",
// "spaghetti" split up. A whole sentence in another language must cost Patience, so it's tagged gibberish.
// Scripts end with a spare confirmation, in case the NPC asks one more question before its read-back.

const served = (...items: [string, number][]) => ({
  outcome: 'completed' as const,
  args: { items: items.map(([item, quantity]) => ({ item, quantity })) },
});

export default npcCases([
  {
    id: 'en-npc-latte',
    interactionId: 'order-drink',
    targetLanguage: 'en',
    step: 'A1',
    turns: [
      { tag: 'clean', text: 'One latte, please.' },
      { tag: 'clean', text: 'Yes.', confirms: true },
      { tag: 'clean', text: 'Yes, thanks.', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'en-npc-latte-misheard',
    interactionId: 'order-drink',
    targetLanguage: 'en',
    step: 'A1',
    turns: [
      { tag: 'noisy', text: 'one later please' },
      { tag: 'clean', text: 'Yes.', confirms: true },
      { tag: 'clean', text: 'Yes, thanks.', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
  {
    id: 'en-npc-tea-and-scone',
    interactionId: 'order-drink',
    targetLanguage: 'en',
    step: 'B1',
    turns: [
      { tag: 'clean', text: 'Could I get a cup of tea and a scone?' },
      { tag: 'clean', text: "Yes, that's right.", confirms: true },
      { tag: 'clean', text: "That's all, thanks.", confirms: true },
    ],
    expected: served(['tea', 1], ['pastry', 1]),
  },
  {
    id: 'en-npc-out-of-patience',
    interactionId: 'order-drink',
    targetLanguage: 'en',
    step: 'C1',
    turns: [
      { tag: 'gibberish', text: 'mrmph blah' },
      { tag: 'gibberish', text: 'Ich möchte einen Kaffee, bitte.' },
      { tag: 'clean', text: 'A filter coffee, please.' },
    ],
    expected: { outcome: 'outOfPatience' },
  },
  {
    id: 'en-npc-sausage-rolls',
    interactionId: 'buy-counter-food',
    targetLanguage: 'en',
    step: 'B2',
    turns: [
      { tag: 'clean', text: "I'll have two sausage rolls, please." },
      { tag: 'clean', text: 'Yes, please.', confirms: true },
      { tag: 'clean', text: "That's everything.", confirms: true },
    ],
    expected: served(['snack', 2]),
  },
  {
    id: 'en-npc-find-spaghetti',
    interactionId: 'find-an-item',
    targetLanguage: 'en',
    step: 'A2',
    turns: [
      { tag: 'noisy', text: 'where is the spa getty' },
      { tag: 'clean', text: 'Yes.', confirms: true },
      { tag: 'clean', text: 'Yes, the spaghetti.', confirms: true },
    ],
    expected: { outcome: 'completed', args: { item: 'noodles' } },
  },
  {
    id: 'en-npc-hire-barista',
    interactionId: 'ask-barista-for-work',
    targetLanguage: 'en',
    step: 'B1',
    characterName: 'Mei Lin',
    turns: [
      { tag: 'clean', text: "Hi, I saw you're hiring. I'd like to work here as a barista." },
      { tag: 'clean', text: "My name's Mei Lin. M-E-I, L-I-N." },
      { tag: 'clean', text: 'I can start tomorrow.' },
      { tag: 'clean', text: 'Yes, that’s right.', confirms: true },
      { tag: 'clean', text: 'Yes.', confirms: true },
    ],
    expected: { outcome: 'completed', args: { start: 'tomorrow' } },
  },
  {
    id: 'en-npc-spoken-latte',
    interactionId: 'order-drink',
    targetLanguage: 'en',
    step: 'A1',
    turns: [
      { tag: 'noisy', recording: 'en-order-latte.wav' },
      { tag: 'clean', text: 'Yes.', confirms: true },
      { tag: 'clean', text: 'Yes, thanks.', confirms: true },
    ],
    expected: served(['latte', 1]),
  },
]);
