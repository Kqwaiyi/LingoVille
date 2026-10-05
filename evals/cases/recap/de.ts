import { recapCases } from '../schema.ts';

// German Recap cases.
export default recapCases([
  {
    id: 'de-order-basic',
    expectedStep: 'A1',
    request: {
      kind: 'goal',
      culturePackId: 'de',
      step: 'A1',
      nativeLanguage: 'en',
      conversation: {
        interactionId: 'order-drink',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: 'Hallo! Was darf es sein?' },
          { speaker: 'player', text: 'Ein Latte, bitte.' },
          { speaker: 'npc', text: 'Einen Latte, gern. Heiß oder kalt?' },
          { speaker: 'player', text: 'Heiß' },
          { speaker: 'npc', text: 'Ein heißer Latte, das macht drei Euro zwanzig. Passt das so?' },
          { speaker: 'player', text: 'Ja' },
        ],
        helpLog: [{ afterLine: 3, kind: 'translate', text: 'Einen Latte, gern. Heiß oder kalt?' }],
      },
    },
  },
  {
    id: 'de-groceries-chatty',
    expectedStep: 'B1',
    request: {
      kind: 'goal',
      culturePackId: 'de',
      step: 'B1',
      nativeLanguage: 'ja',
      conversation: {
        interactionId: 'pay-for-groceries',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: 'Hallo! Brauchen Sie eine Tüte?' },
          { speaker: 'player', text: 'Nein, danke, ich habe meine eigene Tasche dabei.' },
          { speaker: 'npc', text: 'Haben Sie eine Payback-Karte?' },
          { speaker: 'player', text: 'Nein, leider nicht. Kann ich mit Karte bezahlen? Ich habe nicht genug Bargeld.' },
          { speaker: 'npc', text: 'Natürlich. Das macht zwölf Euro vierzig.' },
          { speaker: 'player', text: 'Bitte schön. Schönen Tag noch!' },
        ],
        helpLog: [],
      },
    },
  },
]);
