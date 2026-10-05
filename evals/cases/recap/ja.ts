import { recapCases } from '../schema.ts';

// Japanese Recap cases.
export default recapCases([
  {
    id: 'ja-order-latte-short',
    expectedStep: 'A1',
    request: {
      kind: 'goal',
      culturePackId: 'ja',
      step: 'A1',
      nativeLanguage: 'en',
      conversation: {
        interactionId: 'order-drink',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: 'いらっしゃいませ！ご注文はお決まりですか？' },
          { speaker: 'player', text: 'ホットラテ ください' },
          { speaker: 'npc', text: 'ホットラテですね。サイズはいかがなさいますか？' },
          { speaker: 'player', text: 'えっと……S' },
          { speaker: 'npc', text: 'ホットラテのSサイズ、四百五十円です。よろしいですか？' },
          { speaker: 'player', text: 'はい' },
          { speaker: 'npc', text: 'ありがとうございます。少々お待ちください。' },
        ],
        helpLog: [{ afterLine: 3, kind: 'translate', text: 'ホットラテですね。サイズはいかがなさいますか？' }],
      },
    },
  },
  {
    id: 'ja-order-copied-hints',
    expectedStep: 'A1',
    request: {
      kind: 'goal',
      culturePackId: 'ja',
      step: 'A2',
      nativeLanguage: 'zh',
      conversation: {
        interactionId: 'order-drink',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: 'いらっしゃいませ！ご注文はお決まりですか？' },
          { speaker: 'player', text: 'ホットラテをください。', typed: true },
          { speaker: 'npc', text: 'かしこまりました。店内でお召し上がりですか？' },
          { speaker: 'player', text: '持ち帰りでお願いします。', typed: true },
          { speaker: 'npc', text: 'ホットラテ、お持ち帰りで四百五十円です。' },
          { speaker: 'player', text: 'はい' },
        ],
        helpLog: [
          { afterLine: 1, kind: 'hint', text: 'ホットラテをください。' },
          { afterLine: 3, kind: 'hint', text: '持ち帰りでお願いします。' },
        ],
      },
    },
  },
  {
    id: 'ja-groceries-fluent',
    expectedStep: 'B2',
    request: {
      kind: 'goal',
      culturePackId: 'ja',
      step: 'B1',
      nativeLanguage: 'en',
      conversation: {
        interactionId: 'pay-for-groceries',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: 'いらっしゃいませ。袋はご利用ですか？' },
          { speaker: 'player', text: 'いえ、エコバッグを持ってきたので大丈夫です。あ、ポイントカードも使えますか？' },
          { speaker: 'npc', text: 'はい、お預かりします。お会計は千二百三十円になります。' },
          {
            speaker: 'player',
            text: 'じゃあ、カードで払います。それと、この牛乳の賞味期限がちょっと短いみたいなんですが、新しいのはありますか？',
          },
          { speaker: 'npc', text: '申し訳ございません、本日はそちらが最後になります。' },
          { speaker: 'player', text: 'そうですか、じゃあこれで大丈夫です。ありがとうございます。' },
        ],
        helpLog: [],
      },
    },
  },
  {
    id: 'ja-counter-food-heated',
    expectedStep: 'A2',
    request: {
      kind: 'goal',
      culturePackId: 'ja',
      step: 'A2',
      nativeLanguage: 'de',
      conversation: {
        interactionId: 'buy-counter-food',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: 'いらっしゃいませ。' },
          { speaker: 'player', text: 'すみません、からあげと、このお弁当をください。' },
          { speaker: 'npc', text: 'お弁当は温めますか？' },
          { speaker: 'player', text: 'はい、お願いします。' },
          { speaker: 'npc', text: '全部で八百六十円です。' },
          { speaker: 'player', text: 'はっぴゃくろくじゅうえん……はい、どうぞ。' },
        ],
        helpLog: [],
      },
    },
  },
  {
    id: 'ja-small-talk-weekend',
    expectedStep: 'B1',
    request: {
      kind: 'smallTalk',
      culturePackId: 'ja',
      step: 'B1',
      nativeLanguage: 'en',
      npcId: 'barista',
      transcript: [
        { speaker: 'npc', text: '最近どうですか？週末は何かしましたか？' },
        { speaker: 'player', text: '土曜日に友達と山に行きました。ちょっと疲れたけど、景色がすごくきれいでした。' },
        { speaker: 'npc', text: 'いいですね！どこの山ですか？' },
        { speaker: 'player', text: '駅の近くの小さい山です。名前は忘れちゃいました。' },
      ],
      helpLog: [],
    },
  },
]);
