import { recapCases } from '../schema.ts';

// Mandarin Recap cases. Misheard player lines are as the voice prototype heard them (一杯 as 一百, 小杯 as 小贝).
export default recapCases([
  {
    id: 'zh-order-latte-misheard',
    expectedStep: 'A1',
    request: {
      kind: 'goal',
      culturePackId: 'zh',
      step: 'A1',
      nativeLanguage: 'en',
      conversation: {
        interactionId: 'order-drink',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: '欢迎光临！您要点什么？' },
          { speaker: 'player', text: '我要一百拿铁' },
          { speaker: 'npc', text: '一杯拿铁，热的还是冰的？' },
          { speaker: 'player', text: '热的' },
          { speaker: 'npc', text: '一杯热拿铁，对吗？二十八块。' },
          { speaker: 'player', text: '对' },
          { speaker: 'npc', text: '好的，请拿好。慢走！' },
        ],
        helpLog: [],
      },
    },
  },
  {
    id: 'zh-order-copied-hint',
    expectedStep: 'A1',
    request: {
      kind: 'goal',
      culturePackId: 'zh',
      step: 'A1',
      nativeLanguage: 'de',
      conversation: {
        interactionId: 'order-drink',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: '欢迎光临！您要点什么？' },
          { speaker: 'player', text: '请给我一杯热拿铁。', typed: true },
          { speaker: 'npc', text: '好的，要小杯还是大杯？' },
          { speaker: 'player', text: '小贝' },
          { speaker: 'npc', text: '小杯热拿铁，对吗？二十五块。' },
          { speaker: 'player', text: '对' },
        ],
        helpLog: [
          { afterLine: 1, kind: 'hint', text: '请给我一杯热拿铁。' },
          { afterLine: 3, kind: 'translate', text: '好的，要小杯还是大杯？' },
        ],
      },
    },
  },
  {
    id: 'zh-groceries-confident',
    expectedStep: 'B1',
    request: {
      kind: 'goal',
      culturePackId: 'zh',
      step: 'B1',
      nativeLanguage: 'en',
      conversation: {
        interactionId: 'pay-for-groceries',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: '您好，一共四十二块五。需要袋子吗？' },
          { speaker: 'player', text: '不用了，我自己带了袋子。对了，我有会员卡，可以用吗？' },
          { speaker: 'npc', text: '可以，请给我看一下。' },
          { speaker: 'player', text: '给你。我能用手机付款吗？' },
          { speaker: 'npc', text: '可以，请扫这个码。' },
          { speaker: 'player', text: '好了，付完了。谢谢你！' },
          { speaker: 'npc', text: '谢谢，欢迎下次再来！' },
        ],
        helpLog: [],
      },
    },
  },
  {
    id: 'zh-find-item-translated',
    expectedStep: 'A2',
    request: {
      kind: 'goal',
      culturePackId: 'zh',
      step: 'A2',
      nativeLanguage: 'ja',
      conversation: {
        interactionId: 'find-an-item',
        outcome: 'success',
        transcript: [
          { speaker: 'npc', text: '您好，需要帮忙吗？' },
          { speaker: 'player', text: '你好，请问酸奶在哪里？' },
          { speaker: 'npc', text: '酸奶在冷柜那边，饮料的左边。' },
          { speaker: 'player', text: '冷柜……左边，好的。谢谢！' },
          { speaker: 'npc', text: '不客气。' },
        ],
        helpLog: [{ afterLine: 3, kind: 'translate', text: '酸奶在冷柜那边，饮料的左边。' }],
      },
    },
  },
  {
    id: 'zh-counter-food-failed',
    expectedStep: 'A1',
    request: {
      kind: 'goal',
      culturePackId: 'zh',
      step: 'A1',
      nativeLanguage: 'en',
      conversation: {
        interactionId: 'buy-counter-food',
        outcome: 'failure',
        transcript: [
          { speaker: 'npc', text: '您好，要点什么？' },
          { speaker: 'player', text: 'Chao Pe' },
          { speaker: 'npc', text: '不好意思，您说什么？' },
          { speaker: 'player', text: '这个' },
          { speaker: 'npc', text: '这个便当吗？要加热吗？' },
          { speaker: 'player', text: '嗯……100' },
          { speaker: 'npc', text: '不好意思，我没听懂。' },
        ],
        helpLog: [],
      },
    },
  },
]);
