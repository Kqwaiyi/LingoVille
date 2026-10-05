import { recapCases } from '../schema.ts';

// English Recap cases.
export default recapCases([
  {
    id: 'en-order-basic',
    expectedStep: 'A2',
    request: {
      kind: 'goal',
      culturePackId: 'en',
      step: 'A2',
      nativeLanguage: 'zh',
      conversation: {
        interactionId: 'order-drink',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: 'Hi there! What can I get you?' },
          { speaker: 'player', text: 'I want one latte hot please' },
          { speaker: 'npc', text: 'One hot latte. Small or large?' },
          { speaker: 'player', text: 'Small please' },
          { speaker: 'npc', text: "That's a small hot latte, three twenty. Is that right?" },
          { speaker: 'player', text: 'Yes' },
        ],
        helpLog: [
          { afterLine: 1, kind: 'hint', text: 'Could I have a hot latte, please?' },
          { afterLine: 3, kind: 'translate', text: 'One hot latte. Small or large?' },
        ],
      },
    },
  },
  {
    id: 'en-shift-two-customers',
    expectedStep: 'B2',
    request: {
      kind: 'shift',
      jobId: 'barista',
      culturePackId: 'en',
      step: 'B2',
      nativeLanguage: 'de',
      customers: [
        {
          order: [{ itemId: 'latte', quantity: 1 }],
          result: 'served',
          served: [{ itemId: 'latte', quantity: 1 }],
          transcript: [
            { speaker: 'npc', text: 'Morning! Could I get a latte? And actually, is it very strong?' },
            { speaker: 'player', text: "Morning! Not really, it's mostly milk. So that's one latte. Anything to eat with that?" },
            { speaker: 'npc', text: "No, that's all, thanks." },
            { speaker: 'player', text: "Lovely. I'll bring it over to you in a minute." },
          ],
          helpLog: [],
        },
        {
          order: [{ itemId: 'tea', quantity: 1 }],
          result: 'served',
          served: [{ itemId: 'tea', quantity: 1 }],
          transcript: [
            { speaker: 'npc', text: "Hiya, I'll have a cup of tea to take away, please." },
            { speaker: 'player', text: 'Sure thing. One cup of tea to go. Would you like milk in it?' },
            { speaker: 'npc', text: 'Go on then.' },
          ],
          helpLog: [],
        },
      ],
    },
  },
]);
