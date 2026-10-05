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
      culturePackId: 'en',
      step: 'B2',
      nativeLanguage: 'de',
      customers: [
        {
          interactionId: 'order-drink',
          outcome: 'success',
          transcript: [
            { speaker: 'npc', text: 'Morning! Could I get a flat white? And actually, do you have oat milk?' },
            { speaker: 'player', text: "Morning! We do, yeah. So that's a flat white with oat milk. Anything to eat with that?" },
            { speaker: 'npc', text: "No, that's all, thanks." },
            { speaker: 'player', text: "Lovely. That'll be three eighty. I'll bring it over to you in a minute." },
          ],
          helpLog: [],
        },
        {
          interactionId: 'order-drink',
          outcome: 'success',
          transcript: [
            { speaker: 'npc', text: "Hiya, I'll have a large cappuccino to take away, please." },
            { speaker: 'player', text: "Sure thing. One large cappuccino to go, that's four ten. Would you like chocolate on top?" },
            { speaker: 'npc', text: 'Go on then.' },
          ],
          helpLog: [],
        },
      ],
    },
  },
]);
