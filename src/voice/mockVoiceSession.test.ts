import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  basketChangedScene,
  buildNpcSession,
  buildShiftCustomerSession,
  buildSmallTalkSession,
  giftScene,
  OUT_OF_PATIENCE_SCENE,
  REVEAL_FAVOURITE_TOOL,
  shiftCustomerChangeScene,
  shiftCustomerServedScene,
  tableServedScene,
  WRAP_UP_SCENE,
  type ToolResponse,
} from '../ai/index.ts';
import { CULTURE_PACKS, formatLocalAmount, formatLocalMoney, INTERACTIONS, menuPrice, NAMED_NPCS, type Interaction, type MedicineId } from '../content/index.ts';
import { FAMILIARITY, LANGUAGE_CODES, type ApproachId, type LanguageCode, type NpcMemory, type ShiftCustomer, type ShiftOrder } from '../sim/index.ts';
import { MOCK_DROP_LINE, openMockVoiceSession, type ToolCall, type VoiceSessionEvents } from './index.ts';

function npcSession(packId: LanguageCode) {
  return buildNpcSession(INTERACTIONS.orderDrink, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.barista, {
    clock: { day: 1, minuteOfDay: 420 },
  });
}

/** Records what the fake NPC says, one entry per finished turn, and the tools it calls. */
function listen() {
  const turns: string[] = [];
  const toolCalls: ToolCall[] = [];
  const dropped = { count: 0 };
  let current = '';
  const events: VoiceSessionEvents = {
    onOutputTranscript: (text) => (current += text),
    onInputTranscript: () => {},
    onTurnComplete: () => {
      turns.push(current);
      current = '';
    },
    onToolCall: (call) => toolCalls.push(call),
    onMicLevel: () => {},
    onUsage: () => {},
    onDisconnect: () => dropped.count++,
  };
  return { turns, toolCalls, dropped, events };
}

function nurseSession(packId: LanguageCode) {
  return buildNpcSession(INTERACTIONS.wakeInWard, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.nurse, {
    clock: { day: 2, minuteOfDay: 480 },
    approach: 'nurseOnWaking',
  });
}

/** A connected fake barista that has already greeted the Player, or with `nurse`, the fake nurse on the ward. */
async function atTheCounter(packId: LanguageCode = 'ja', { nurse = false } = {}) {
  const heard = listen();
  const session = openMockVoiceSession(nurse ? nurseSession(packId) : npcSession(packId), heard.events);
  await session.connect();
  await vi.runAllTimersAsync();
  const say = async (text: string) => {
    session.sendText(text);
    await vi.runAllTimersAsync();
  };
  const answer = async (response: ToolResponse) => {
    session.sendToolResponse(heard.toolCalls.at(-1)!.id, response);
    await vi.runAllTimersAsync();
  };
  return { ...heard, session, say, answer };
}

const { goods } = CULTURE_PACKS.ja;

describe('mock VoiceSession', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('speaks first once connected', async () => {
    const { turns, events } = listen();
    const session = openMockVoiceSession(npcSession('ja'), events);

    await session.connect();
    expect(turns).toEqual([]);
    await vi.runAllTimersAsync();

    expect(turns).toHaveLength(1);
  });

  it('answers each typed line with one turn', async () => {
    const { turns, events } = listen();
    const session = openMockVoiceSession(npcSession('ja'), events);
    await session.connect();
    await vi.runAllTimersAsync();

    session.sendText('コーヒー ください');
    await vi.runAllTimersAsync();
    session.sendText('いいえ');
    await vi.runAllTimersAsync();

    expect(turns).toHaveLength(3);
  });

  it.each([
    ['ja', 'ラテ', 'はい', /[ぁ-んァ-ン]/],
    ['zh', '拿铁', '好的', /[一-龯]/],
    ['en', 'a latte please', 'yes', /^[ -~’£…]+$/],
    ['de', 'Latte bitte', 'ja', /[A-Za-zäöüß]/],
  ] as const)('speaks only the Target Language (%s)', async (packId, order, yes, script) => {
    const { turns, say, answer } = await atTheCounter(packId);
    await say('hello');
    await say(order);
    await say(yes);
    await answer({ result: 'served' });

    expect(turns).toHaveLength(4);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it('reads an order back with its price and waits for confirmation before serving it', async () => {
    const { turns, toolCalls, say } = await atTheCounter();

    await say('ラテ ください');

    expect(turns.at(-1)).toContain(goods.latte.name);
    expect(turns.at(-1)).toContain('450');
    expect(toolCalls).toEqual([]);

    await say('はい');

    expect(toolCalls).toEqual([
      { id: expect.any(String), name: 'serve_order', args: { items: [{ item: 'latte', quantity: 1 }] } },
    ]);
  });

  it('asks again when the Player says the read-back is wrong', async () => {
    const { turns, toolCalls, say } = await atTheCounter();

    await say('コーヒー');
    await say('いいえ');
    await say('紅茶');
    await say('はい');

    // Greeting, read-back, asking again, read-back; the confirmation is a tool call, not a turn.
    expect(turns).toHaveLength(4);
    expect(toolCalls.map((call) => call.args)).toEqual([{ items: [{ item: 'tea', quantity: 1 }] }]);
  });

  it('says goodbye once the order is served', async () => {
    const { turns, say, answer } = await atTheCounter();
    await say('ラテ');
    await say('はい');
    const before = turns.length;

    await answer({ result: 'served' });

    expect(turns).toHaveLength(before + 1);
  });

  it('carries on when the Player cannot afford the order', async () => {
    const { turns, toolCalls, say, answer } = await atTheCounter();
    await say('ラテ');
    await say('はい');

    await answer({ result: 'cannot_afford' });
    await say('紅茶');
    await say('はい');

    // Greeting, read-back, "not enough", read-back.
    expect(turns).toHaveLength(4);
    expect(toolCalls.map((call) => call.args)).toEqual([
      { items: [{ item: 'latte', quantity: 1 }] },
      { items: [{ item: 'tea', quantity: 1 }] },
    ]);
  });

  it('calls not_understood for gibberish, and says so in the Target Language', async () => {
    const { turns, toolCalls, say, answer } = await atTheCounter();

    await say('asdf qwerty');

    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'not_understood', args: { reason: 'unintelligible' } }]);
    expect(turns).toHaveLength(1);

    await answer({ result: 'noted' });

    expect(turns).toHaveLength(2);
    expect(turns.at(-1)).toMatch(/[ぁ-んァ-ン]/);
  });

  it('never calls not_understood for a line it can make sense of', async () => {
    const { toolCalls, say } = await atTheCounter();

    await say('こんにちは');
    await say('メニュー');

    expect(toolCalls).toEqual([]);
  });

  it('ends politely when the game says it is out of patience', async () => {
    const outOfPatience = await atTheCounter();
    await outOfPatience.say('asdf');
    await outOfPatience.answer({ result: 'out_of_patience' });

    const scene = await atTheCounter();
    await scene.say(OUT_OF_PATIENCE_SCENE);

    expect(outOfPatience.turns.at(-1)).toBe(scene.turns.at(-1));
    expect(scene.toolCalls).toEqual([]);
  });

  it('says nothing more once closed, even mid-reply', async () => {
    const { turns, events } = listen();
    const session = openMockVoiceSession(npcSession('de'), events);
    await session.connect();
    await vi.runAllTimersAsync();

    session.sendText('Kaffee bitte');
    session.close();
    await vi.runAllTimersAsync();

    expect(turns).toHaveLength(1);
  });

  it('carries on without greeting again when it replaces a dropped session', async () => {
    const { turns, events } = listen();
    const session = openMockVoiceSession(npcSession('ja'), events, {
      resumeFrom: [{ speaker: 'npc', text: 'いらっしゃいませ！ご注文はお決まりですか？' }],
    });
    await session.connect();
    await vi.runAllTimersAsync();

    expect(turns).toHaveLength(1);
    expect(turns[0]).not.toBe('いらっしゃいませ！ご注文はお決まりですか？');
    expect(turns[0]).toMatch(/[ぁ-んァ-ン]/);
  });

  it('drops the connection when the Player types the scripted drop line, and says nothing after', async () => {
    const { turns, dropped, say } = await atTheCounter();

    await say(MOCK_DROP_LINE);
    await say('ラテ');

    expect(dropped.count).toBe(1);
    expect(turns).toHaveLength(1);
  });
});

describe('mock VoiceSession: the nurse on the ward', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('speaks first, as the nurse rather than the barista', async () => {
    const barista = await atTheCounter('en');
    const nurse = await atTheCounter('en', { nurse: true });

    expect(nurse.turns).toHaveLength(1);
    expect(nurse.turns[0]).not.toBe(barista.turns[0]);
  });

  it('lets the patient go home once they say how they feel, then says goodbye', async () => {
    const { turns, toolCalls, say, answer } = await atTheCounter('en', { nurse: true });

    await say("I'm fine, thanks");
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'discharge_patient', args: { feeling: 'well' } }]);

    await answer({ result: 'done' });
    expect(turns).toHaveLength(2);
  });

  it('hears a patient who still feels unwell', async () => {
    const { toolCalls, say } = await atTheCounter('de', { nurse: true });

    await say('Mir geht es nicht gut');

    expect(toolCalls.map((call) => call.args)).toEqual([{ feeling: 'unwell' }]);
  });

  it('asks again for a line that isn’t about how the patient feels, and calls not_understood for gibberish', async () => {
    const { turns, toolCalls, say } = await atTheCounter('ja', { nurse: true });

    await say('はい');
    expect(turns).toHaveLength(2);
    expect(toolCalls).toEqual([]);

    await say('xqzt');
    expect(toolCalls.map((call) => call.name)).toEqual(['not_understood']);
  });
});

/** A connected fake NPC for any session, which has already spoken first. */
async function open(session: ReturnType<typeof buildNpcSession>) {
  const heard = listen();
  const voice = openMockVoiceSession(session, heard.events);
  await voice.connect();
  await vi.runAllTimersAsync();
  const say = async (text: string) => {
    voice.sendText(text);
    await vi.runAllTimersAsync();
  };
  const answer = async (response: ToolResponse) => {
    voice.sendToolResponse(heard.toolCalls.at(-1)!.id, response);
    await vi.runAllTimersAsync();
  };
  return { ...heard, say, answer };
}

const CLOCK_10AM = { clock: { day: 2, minuteOfDay: 600 } };
const atTheTill = (packId: LanguageCode, eggs = 1) =>
  open(
    buildNpcSession(INTERACTIONS.payForGroceries, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.cashier, {
      ...CLOCK_10AM,
      basket: [{ itemId: 'eggs', quantity: eggs }],
    }),
  );
const byTheShelves = (packId: LanguageCode) =>
  open(buildNpcSession(INTERACTIONS.findAnItem, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.cashier, CLOCK_10AM));
const atTheCornerShop = (packId: LanguageCode) =>
  open(buildNpcSession(INTERACTIONS.buyCounterFood, CULTURE_PACKS[packId], 'A1', NAMED_NPCS['convenience-clerk'], CLOCK_10AM));

/** One box of eggs and two, in each pack's money. */
const EGGS_TOTAL = {
  ja: { one: '¥360', two: '¥720' },
  zh: { one: '14元', two: '28元' },
  en: { one: '£3.60', two: '£7.20' },
  // Intl puts a no-break space before the euro sign.
  de: { one: '3,60 €', two: '7,20 €' },
} as const;

/** What the Player types in each pack: yes, no, eggs and a bento. And what the NPC's lines are written in. */
const PLAYER = {
  ja: { yes: 'はい、お願いします', no: 'いいえ、いりません', eggs: '卵はどこですか', bento: 'のり弁当 ください', script: /[ぁ-んァ-ン]/ },
  zh: { yes: '好的，要', no: '不要', eggs: '鸡蛋在哪里', bento: '我要盒饭', script: /[一-龯]/ },
  en: { yes: 'yes please', no: 'no thanks', eggs: 'where are the eggs', bento: 'a lasagne please', script: /^[ -~’£…]+$/ },
  de: { yes: 'ja bitte', no: 'nein danke', eggs: 'wo sind die Eier', bento: 'ein Fertiggericht bitte', script: /[A-Za-zäöüß]/ },
} as const;

describe('mock VoiceSession: the cashier at the till (#4)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(LANGUAGE_CODES)('asks about a bag and a points card, reads them back, then takes payment (%s)', async (packId) => {
    const { yes, no, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheTill(packId);

    await say(yes);
    await say(no);
    expect(toolCalls).toEqual([]);
    // The read-back has the total, like the real cashier's.
    expect(turns.at(-1)).toContain(EGGS_TOTAL[packId].one);
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'complete_purchase', args: { bag: true, card: false } }]);
    await answer({ result: 'served' });

    // Greeting (and the bag question), the points card question, the read-back, goodbye.
    expect(turns).toHaveLength(4);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it.each(LANGUAGE_CODES)(
    'when the Player can’t afford it, waits for something to be put back, then reads back the new total (%s)',
    async (packId) => {
      const { yes, no, script } = PLAYER[packId];
      const { turns, toolCalls, say, answer } = await atTheTill(packId, 2);
      await say(yes);
      await say(no);
      expect(turns.at(-1)).toContain(EGGS_TOTAL[packId].two);
      await say(yes);
      await answer({ result: 'cannot_afford' });
      expect(turns.at(-1)).toMatch(script);

      await say(basketChangedScene([{ itemId: 'eggs', quantity: 1 }], packId));
      expect(turns.at(-1)).toContain(EGGS_TOTAL[packId].one);
      expect(turns.at(-1)).not.toContain(EGGS_TOTAL[packId].two);
      await say(yes);
      expect(toolCalls.map((call) => call.args)).toEqual([
        { bag: true, card: false },
        { bag: true, card: false },
      ]);
    },
  );

  it('carries on with the bag question, without greeting again, when something is put back before it is answered', async () => {
    const { turns, say } = await atTheTill('en', 2);
    await say(basketChangedScene([{ itemId: 'eggs', quantity: 1 }], 'en'));
    expect(turns.at(-1)).not.toBe(turns[0]);
    expect(turns.at(-1)).toMatch(/bag/);
    await say('no');
    await say('no');
    expect(turns.at(-1)).toContain(EGGS_TOTAL.en.one);
  });

  it('asks again from the bag when the read-back is wrong', async () => {
    const { toolCalls, say } = await atTheTill('en');
    await say('yes');
    await say('yes');
    await say('no');
    await say('no');
    await say('no');
    await say('yes');
    expect(toolCalls.map((call) => call.args)).toEqual([{ bag: false, card: false }]);
  });

  it('calls not_understood for gibberish', async () => {
    const { toolCalls, say } = await atTheTill('ja');
    await say('xqzt');
    expect(toolCalls.map((call) => call.name)).toEqual(['not_understood']);
  });
});

describe('mock VoiceSession: the cashier finding an item (#5)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(LANGUAGE_CODES)('checks which item, then points to it and says where it is (%s)', async (packId) => {
    const { yes, eggs, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await byTheShelves(packId);
    const name = CULTURE_PACKS[packId].goods.eggs.name;

    await say(eggs);
    expect(turns.at(-1)).toContain(name);
    expect(toolCalls).toEqual([]);
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'point_to', args: { item: 'eggs' } }]);
    await answer({ result: 'done' });

    expect(turns).toHaveLength(3);
    expect(turns.at(-1)).toContain(name);
    for (const turn of turns) expect(turn).toMatch(script);
  });
});

describe('mock VoiceSession: the clerk at the convenience store counter (#7)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(LANGUAGE_CODES)('reads back a bento with its price, then serves it (%s)', async (packId) => {
    const { yes, bento, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheCornerShop(packId);

    await say(bento);
    expect(turns.at(-1)!.toLowerCase()).toContain(CULTURE_PACKS[packId].goods.bento.name.toLowerCase());
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'serve_order', args: { items: [{ item: 'bento', quantity: 1 }] } }]);
    await answer({ result: 'served' });

    expect(turns).toHaveLength(3);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it('greets as the clerk, not as the barista', async () => {
    const barista = await atTheCounter('ja');
    const clerk = await atTheCornerShop('ja');
    expect(clerk.turns[0]).not.toBe(barista.turns[0]);
  });

  it('doesn’t sell what the café sells', async () => {
    const { turns, toolCalls, say } = await atTheCornerShop('en');
    await say('a latte please');
    await say('yes');
    expect(toolCalls).toEqual([]);
    expect(turns).toHaveLength(3);
  });
});

describe('mock VoiceSession: the landlord (#16, #17)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // A week at the A1 Newcomer Discount owed, due today, and 0.5 Shifts owed from before.
  const RENT = { today: 7, dueDay: 7, owedThisWeekInShifts: 1, debtInShifts: 0.5, weeklyRentInShifts: 1.2 };

  async function landlord(interaction: Interaction, packId: LanguageCode, approach?: ApproachId) {
    const heard = listen();
    const npcSession = buildNpcSession(interaction, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.landlord, {
      clock: { day: 7, minuteOfDay: 540 },
      rent: RENT,
      ...(approach && { approach }),
    });
    const session = openMockVoiceSession(npcSession, heard.events);
    await session.connect();
    await vi.runAllTimersAsync();
    const say = async (text: string) => {
      session.sendText(text);
      await vi.runAllTimersAsync();
    };
    const answer = async (response: ToolResponse) => {
      session.sendToolResponse(heard.toolCalls.at(-1)!.id, response);
      await vi.runAllTimersAsync();
    };
    return { ...heard, say, answer };
  }

  it('says what is owed, and takes it all once the tenant agrees', async () => {
    const { turns, toolCalls, say, answer } = await landlord(INTERACTIONS.payRent, 'ja');
    expect(turns[0]).toContain('¥9,000');

    await say('はい');
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'accept_rent', args: { amount: 9000 } }]);
    await answer({ result: 'done' });
    expect(turns).toHaveLength(2);
  });

  it('catches the tenant in the hallway with a reminder, and lets them go when they can’t pay', async () => {
    const pay = await landlord(INTERACTIONS.payRent, 'en');
    const { turns, toolCalls, say } = await landlord(INTERACTIONS.rentReminder, 'en', 'landlordRentDue');
    expect(turns[0]).not.toBe(pay.turns[0]);
    expect(turns[0]).toContain('£90');

    await say('No, sorry');
    expect(toolCalls).toEqual([]);
    expect(turns).toHaveLength(2);
  });

  it('agrees on three more days, and gives them once the tenant confirms', async () => {
    const { turns, toolCalls, say, answer } = await landlord(INTERACTIONS.askForMoreTime, 'de');

    await say('Bitte, mehr Zeit');
    expect(toolCalls).toEqual([]);
    await say('Ja');
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'grant_extension', args: { days: 3 } }]);
    await answer({ result: 'done' });
    expect(turns).toHaveLength(3);
  });

  it('tells the tenant the new weekly rent, and finishes once they answer', async () => {
    const { turns, toolCalls, say } = await landlord(INTERACTIONS.newcomerDiscountNews, 'zh', 'landlordDiscountStepDown');
    expect(turns[0]).toContain('288元');

    await say('好的');
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'finish_rent_news', args: { understood: true } }]);
  });

  it('calls not_understood for gibberish', async () => {
    const { toolCalls, say } = await landlord(INTERACTIONS.payRent, 'en');
    await say('xqzt');
    expect(toolCalls.map((call) => call.name)).toEqual(['not_understood']);
  });
});

describe('mock VoiceSession: asking the barista for work (#26)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function hiring(packId: LanguageCode, interaction = INTERACTIONS.askBaristaForWork) {
    const heard = listen();
    const npcSession = buildNpcSession(interaction, CULTURE_PACKS[packId], 'A1', NAMED_NPCS[interaction.npcId], {
      clock: { day: 2, minuteOfDay: 540 },
    });
    const session = openMockVoiceSession(npcSession, heard.events);
    await session.connect();
    await vi.runAllTimersAsync();
    const say = async (text: string) => {
      session.sendText(text);
      await vi.runAllTimersAsync();
    };
    const answer = async (response: ToolResponse) => {
      session.sendToolResponse(heard.toolCalls.at(-1)!.id, response);
      await vi.runAllTimersAsync();
    };
    return { ...heard, say, answer };
  }

  it('asks the name and when they can start, and hires them once they confirm the read-back', async () => {
    const { turns, toolCalls, say, answer } = await hiring('ja');

    await say('仕事はありますか？');
    await say('サムです。');
    expect(turns.at(-1)).toContain('サム');
    await say('明日から');
    expect(toolCalls).toEqual([]);
    await say('はい');

    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'hire_applicant', args: { name: 'サム', start: 'tomorrow' } }]);
    await answer({ result: 'done' });
    expect(turns).toHaveLength(5);
  });

  it('hires a cashier at the supermarket the same way', async () => {
    const { toolCalls, say } = await hiring('ja', INTERACTIONS.askCashierForWork);
    for (const line of ['仕事はありますか？', 'Samです。', '今週から', 'はい']) await say(line);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'hire_applicant', args: { name: 'Sam', start: 'this_week' } }]);
  });

  it.each([
    ['en', 'Do you have any work?', 'My name is Sam.', 'I can start today', 'Yes', 'today'],
    ['de', 'Haben Sie Arbeit?', 'Ich heiße Sam.', 'Nächste Woche', 'Ja', 'next_week'],
    ['zh', '你们有工作吗？', '我叫Sam。', '这个星期', '对', 'this_week'],
  ] as const)('hears the name and start in the %s pack', async (packId, ask, name, start, yes, startWhen) => {
    const { toolCalls, say } = await hiring(packId);
    for (const line of [ask, name, start, yes]) await say(line);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'hire_applicant', args: { name: 'Sam', start: startWhen } }]);
  });

  it('asks for the name again when it was misheard', async () => {
    const { turns, toolCalls, say, answer } = await hiring('en');
    for (const line of ['Any jobs?', 'Pam', 'Tomorrow', 'Yes']) await say(line);
    await answer({ result: 'wrong_name' });
    const askedAgain = turns.at(-1);

    await say("It's Sam");
    await say('Yes');

    expect(askedAgain).toMatch(/name/i);
    expect(toolCalls.at(-1)).toMatchObject({ name: 'hire_applicant', args: { name: 'Sam', start: 'tomorrow' } });
  });

  it('calls not_understood for gibberish', async () => {
    const { toolCalls, say } = await hiring('de');
    await say('xqzt');
    expect(toolCalls.map((call) => call.name)).toEqual(['not_understood']);
  });
});

const STRANGER: NpcMemory = {
  familiarity: 0,
  todaysGain: { day: 2, amount: 0 },
  timesMet: 0,
  knowsName: false,
  usualOrder: null,
  lastOrder: null,
  lastTopic: null,
  favouriteKnown: false,
  lastGiftDay: null,
  lastOnTheHouseDay: null,
  registerOffered: false,
};

describe('mock VoiceSession: Small Talk', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function chatting(packId: LanguageCode) {
    const heard = listen();
    const npcSession = buildSmallTalkSession(CULTURE_PACKS[packId], 'A1', NAMED_NPCS['park-regular-1'], {
      clock: { day: 2, minuteOfDay: 600 },
      relationship: { memory: STRANGER, characterName: 'Sam' },
    });
    const session = openMockVoiceSession(npcSession, heard.events);
    await session.connect();
    await vi.runAllTimersAsync();
    const say = async (text: string) => {
      session.sendText(text);
      await vi.runAllTimersAsync();
    };
    const answer = async (response: ToolResponse) => {
      session.sendToolResponse(heard.toolCalls.at(-1)!.id, response);
      await vi.runAllTimersAsync();
    };
    return { ...heard, say, answer };
  }

  it.each(LANGUAGE_CODES)('greets first and chats back about anything it understands in the %s pack', async (packId) => {
    const { turns, toolCalls, say } = await chatting(packId);
    const line = { ja: 'いい天気ですね', zh: '今天天气很好', en: 'Yes, lovely weather', de: 'Ja, schönes Wetter' }[packId];

    await say(line);
    await say(line);

    expect(turns).toHaveLength(3);
    expect(turns[1]).not.toBe(turns[2]);
    expect(toolCalls).toEqual([]);
  });

  it('calls learn_name with the name it heard, and greets them by it once it is right', async () => {
    const { turns, toolCalls, say, answer } = await chatting('en');

    await say('My name is Sam.');
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'learn_name', args: { name: 'Sam' } }]);
    await answer({ result: 'learned' });

    expect(turns.at(-1)).toContain('Sam');
  });

  it('asks the name again when the sim says it was misheard', async () => {
    const { turns, say, answer } = await chatting('ja');

    await say('私の名前はパムです');
    await answer({ result: 'wrong_name' });

    expect(turns.at(-1)).toMatch(/名前/);
  });

  it('says goodbye when a scene tells it to wrap up', async () => {
    const { turns, say } = await chatting('de');

    await say(WRAP_UP_SCENE);

    expect(turns.at(-1)).toMatch(/tschüss/i);
  });

  it('calls not_understood for gibberish', async () => {
    const { toolCalls, say } = await chatting('zh');
    await say('xqzt');
    expect(toolCalls.map((call) => call.name)).toEqual(['not_understood']);
  });
});

describe('mock VoiceSession: gifts and the favourite', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const FAVOURITE_ASKED: Record<LanguageCode, string> = {
    ja: '好きなプレゼントは何ですか',
    zh: '你最喜欢的礼物是什么？',
    en: "What's your favourite gift?",
    de: 'Was ist dein Lieblingsgeschenk?',
  };

  async function chatting(packId: LanguageCode) {
    const heard = listen();
    const npcSession = buildSmallTalkSession(CULTURE_PACKS[packId], 'A1', NAMED_NPCS['park-regular-1'], {
      clock: { day: 2, minuteOfDay: 600 },
      relationship: { memory: STRANGER, characterName: 'Sam' },
    });
    const session = openMockVoiceSession(npcSession, heard.events);
    await session.connect();
    await vi.runAllTimersAsync();
    const say = async (text: string) => {
      session.sendText(text);
      await vi.runAllTimersAsync();
    };
    const answer = async (response: ToolResponse) => {
      session.sendToolResponse(heard.toolCalls.at(-1)!.id, response);
      await vi.runAllTimersAsync();
    };
    return { ...heard, say, answer };
  }

  it.each(LANGUAGE_CODES)('tells its favourite gift when asked, by its local name, calling reveal_favourite, in the %s pack', async (packId) => {
    const { turns, toolCalls, say, answer } = await chatting(packId);
    const favourite = CULTURE_PACKS[packId].goods[NAMED_NPCS['park-regular-1'].favouriteGift].name;

    await say(FAVOURITE_ASKED[packId]);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: REVEAL_FAVOURITE_TOOL, args: { gift: favourite } }]);
    await answer({ result: 'remembered' });

    expect(turns.at(-1)).toContain(favourite);
  });

  it.each(LANGUAGE_CODES)('thanks the Character for a gift, more warmly for the favourite, in the %s pack', async (packId) => {
    const { turns, toolCalls, say } = await chatting(packId);
    const npc = NAMED_NPCS['park-regular-1'];
    const name = CULTURE_PACKS[packId].goods.chocolates.name;

    await say(giftScene(npc, name, { counted: true, favourite: false }));
    await say(giftScene(npc, name, { counted: false, favourite: false }));
    await say(giftScene(npc, name, { counted: true, favourite: true }));

    expect(toolCalls).toEqual([]);
    expect(new Set(turns.slice(1)).size).toBe(3);
  });

  it('thanks the Character for a gift in a Goal Interaction too', async () => {
    const { turns, toolCalls, say } = await atTheCounter('en');

    await say(giftScene(NAMED_NPCS.barista, 'Bunch of flowers', { counted: true, favourite: false }));

    expect(toolCalls).toEqual([]);
    expect(turns.at(-1)).toMatch(/thank/i);
  });
});

describe('mock VoiceSession: a Shift Customer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const WANTS_A_LATTE: ShiftCustomer = { templateId: 'barista-single-drink', order: [{ itemId: 'latte', quantity: 1 }], changedFrom: null, checkout: null, table: null, voiceSeed: 7 };
  const ICED_TEA: ShiftOrder = [{ itemId: 'tea', quantity: 1, modifiers: { size: 'large', temperature: 'iced', extras: ['lemon'] } }];
  const HOT_COFFEE: ShiftOrder = [{ itemId: 'coffee', quantity: 1, modifiers: { size: 'small', temperature: 'hot', extras: ['milk'] } }];

  /** A connected fake customer who has walked up and ordered (a latte, unless they're another customer). */
  async function customerAtTheCounter(packId: LanguageCode = 'ja', customer: ShiftCustomer = WANTS_A_LATTE) {
    const heard = listen();
    const session = openMockVoiceSession(
      buildShiftCustomerSession(customer, CULTURE_PACKS[packId], 'A1', { clock: { day: 3, minuteOfDay: 600 } }),
      heard.events,
    );
    await session.connect();
    await vi.runAllTimersAsync();
    const say = async (text: string) => {
      session.sendText(text);
      await vi.runAllTimersAsync();
    };
    return { ...heard, say };
  }

  it.each(LANGUAGE_CODES)('speaks first in the %s pack, ordering by the drink’s local name', async (packId) => {
    const { turns } = await customerAtTheCounter(packId);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toContain(CULTURE_PACKS[packId].goods.latte.name);
  });

  it('says the order again when asked, and calls not_understood for gibberish', async () => {
    const { turns, toolCalls, say } = await customerAtTheCounter();
    await say('すみません、もう一度お願いします');
    expect(turns.at(-1)).toContain(goods.latte.name);

    await say('qwzx');
    expect(toolCalls.at(-1)).toMatchObject({ name: 'not_understood' });
  });

  it('thanks the barista for the right drink, and says so for the wrong one', async () => {
    const right = await customerAtTheCounter();
    await right.say(shiftCustomerServedScene([{ itemId: 'latte', quantity: 1 }], true, CULTURE_PACKS.ja));
    const wrong = await customerAtTheCounter();
    await wrong.say(shiftCustomerServedScene([{ itemId: 'tea', quantity: 1 }], false, CULTURE_PACKS.ja));

    expect(right.turns.at(-1)).toBeTruthy();
    expect(wrong.turns.at(-1)).toBeTruthy();
    expect(right.turns.at(-1)).not.toBe(wrong.turns.at(-1));
    expect(right.toolCalls).toEqual([]);
  });

  it('says how a drink made to order is made', async () => {
    const { turns } = await customerAtTheCounter('ja', { ...WANTS_A_LATTE, order: ICED_TEA });
    const { drinkOptions } = CULTURE_PACKS.ja;
    for (const said of [goods.tea.name, drinkOptions.large.name, drinkOptions.iced.name, drinkOptions.lemon.name]) expect(turns[0]).toContain(said);
  });

  /** At the till: two eggs, a bag but no points card, and stamps from behind the counter, paying in cash. */
  const PAYS_CASH: ShiftCustomer = {
    templateId: 'cashier-pays-cash',
    order: [{ itemId: 'eggs', quantity: 2 }, { itemId: 'stamps', quantity: 1 }],
    changedFrom: null,
    checkout: { bag: true, pointsCard: false, fromBehindTheCounter: 'stamps', cashHanded: 1000, changeDue: 160 },
    table: null,
    voiceSeed: 7,
  };
  const PAYS_BY_CARD: ShiftCustomer = {
    ...PAYS_CASH,
    templateId: 'cashier-pays',
    order: [{ itemId: 'eggs', quantity: 2 }],
    checkout: { bag: false, pointsCard: true, fromBehindTheCounter: null, cashHanded: null, changeDue: null },
  };

  it.each(LANGUAGE_CODES)('says at the till, in the %s pack, whether they want a bag and have a points card, what they want from behind the counter, and the cash they hand over', async (packId) => {
    const pack = CULTURE_PACKS[packId];
    const cash = await customerAtTheCounter(packId, PAYS_CASH);
    expect(cash.turns).toHaveLength(1);
    expect(cash.turns[0]).toContain(pack.goods.stamps.name);
    expect(cash.turns[0]).toContain(formatLocalAmount(1000, packId));

    const card = await customerAtTheCounter(packId, PAYS_BY_CARD);
    expect(card.turns[0]).not.toContain(pack.goods.stamps.name);
    // Wanting a bag and not, a points card and not: each is said differently.
    expect(card.turns[0]).not.toBe(cash.turns[0]);
  });

  it('says it all again when asked, and reacts to what the cashier did', async () => {
    const { turns, say } = await customerAtTheCounter('ja', PAYS_CASH);
    await say('すみません、もう一度お願いします');
    expect(turns.at(-1)).toBe(turns[0]);

    await say(shiftCustomerServedScene(PAYS_CASH.order, true, CULTURE_PACKS.ja, { bag: true, pointsCard: false, change: 160 }));
    const thanks = turns.at(-1);
    const wrong = await customerAtTheCounter('ja', PAYS_CASH);
    await wrong.say(shiftCustomerServedScene(PAYS_CASH.order, false, CULTURE_PACKS.ja, { bag: false, pointsCard: false, change: 160 }));
    expect(wrong.turns.at(-1)).not.toBe(thanks);
  });

  /** At the restaurant: a table of two, the second diner vegetarian. */
  const TABLE_OF_TWO: ShiftCustomer = {
    templateId: 'server-table-dietary',
    order: [
      { itemId: 'pork-dish', quantity: 1 },
      { itemId: 'cola', quantity: 1 },
      { itemId: 'veggie-dish', quantity: 1 },
      { itemId: 'juice', quantity: 1 },
    ],
    changedFrom: null,
    checkout: null,
    table: [
      { dish: 'pork-dish', drink: 'cola', note: null },
      { dish: 'veggie-dish', drink: 'juice', note: 'vegetarian' },
    ],
    voiceSeed: 7,
  };

  it.each(LANGUAGE_CODES)('orders for the whole table at once in the %s pack: each diner’s dish and drink, and the dietary need', async (packId) => {
    const { goods, dietaryNotes } = CULTURE_PACKS[packId];
    const { turns } = await customerAtTheCounter(packId, TABLE_OF_TWO);
    expect(turns).toHaveLength(1);
    for (const said of [goods['pork-dish'].name, goods.cola.name, goods['veggie-dish'].name, goods.juice.name, dietaryNotes.vegetarian.name]) {
      expect(turns[0]).toContain(said);
    }
  });

  it('says the table’s order again when asked, and reacts to what the server wrote down', async () => {
    const { turns, say } = await customerAtTheCounter('ja', TABLE_OF_TWO);
    await say('すみません、もう一度お願いします');
    expect(turns.at(-1)).toBe(turns[0]);

    await say(tableServedScene(TABLE_OF_TWO.table!, true, CULTURE_PACKS.ja));
    const thanks = turns.at(-1);
    const wrong = await customerAtTheCounter('ja', TABLE_OF_TWO);
    await wrong.say(tableServedScene([], false, CULTURE_PACKS.ja));
    expect(wrong.turns.at(-1)).not.toBe(thanks);
    expect(thanks).not.toBe(turns[0]);
  });

  it('changes their mind once the barista has started on it, and says the new order when asked again', async () => {
    const { turns, say } = await customerAtTheCounter('ja', { ...WANTS_A_LATTE, order: ICED_TEA, changedFrom: HOT_COFFEE });
    expect(turns[0]).toContain(goods.coffee.name);

    await say(shiftCustomerChangeScene());
    expect(turns.at(-1)).toContain(goods.tea.name);
    expect(turns.at(-1)).toContain(CULTURE_PACKS.ja.drinkOptions.iced.name);

    await say('すみません、もう一度お願いします');
    expect(turns.at(-1)).toContain(goods.tea.name);
  });
});

const atTheBookshop = (packId: LanguageCode, interaction: Interaction = INTERACTIONS.buyABook, step: 'A1' | 'C1' = 'A1') =>
  open(buildNpcSession(interaction, CULTURE_PACKS[packId], step, NAMED_NPCS.shopkeeper, CLOCK_10AM));

/** What the Player asks for at the bookshop and the café's Comfort Purchases, in each pack. */
const COMFORTS_ASKED = {
  ja: { magazine: '雑誌をください', flowers: '花束をください', cake: 'ケーキをください' },
  zh: { magazine: '我要杂志', flowers: '我要买花', cake: '我要提拉米苏' },
  en: { magazine: 'a magazine please', flowers: 'some flowers please', cake: 'a slice of victoria sponge please' },
  de: { magazine: 'eine Zeitschrift bitte', flowers: 'einen Blumenstrauß bitte', cake: 'ein Stück Käsekuchen bitte' },
} as const;

describe('mock VoiceSession: the bookshop (#18, #19, #20)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(LANGUAGE_CODES)('reads back a magazine with its price, then sells it with complete_purchase (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheBookshop(packId);

    await say(COMFORTS_ASKED[packId].magazine);
    expect(turns.at(-1)!.toLowerCase()).toContain(CULTURE_PACKS[packId].goods.magazine.name.toLowerCase());
    expect(toolCalls).toEqual([]);
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'complete_purchase', args: { items: [{ item: 'magazine', quantity: 1 }] } }]);
    await answer({ result: 'served' });

    expect(turns).toHaveLength(3);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it('greets as the shopkeeper, not as the barista or the cashier', async () => {
    const barista = await atTheCounter('ja');
    const cashier = await atTheTill('ja');
    const shopkeeper = await atTheBookshop('ja');
    expect(shopkeeper.turns[0]).not.toBe(barista.turns[0]);
    expect(shopkeeper.turns[0]).not.toBe(cashier.turns[0]);
  });

  it('sells a book asked for by name when recommending, too (#20)', async () => {
    const { toolCalls, say } = await atTheBookshop('en', INTERACTIONS.recommendABook, 'C1');
    await say('a magazine please');
    await say('yes');
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'complete_purchase', args: { items: [{ item: 'magazine', quantity: 1 }] } }]);
  });

  it.each(LANGUAGE_CODES)('asks whether to wrap a gift, reads both back, then sells it wrapped (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheBookshop(packId, INTERACTIONS.buyAGift);

    await say(COMFORTS_ASKED[packId].flowers);
    await say(yes);
    expect(toolCalls).toEqual([]);
    expect(turns.at(-1)!.toLowerCase()).toContain(CULTURE_PACKS[packId].goods.flowers.name.toLowerCase());
    await say(yes);
    expect(toolCalls).toEqual([
      { id: expect.any(String), name: 'complete_purchase', args: { items: [{ item: 'flowers', quantity: 1 }], wrap: true } },
    ]);
    await answer({ result: 'served' });

    expect(turns).toHaveLength(4);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it('sells a gift unwrapped when the Player says no to wrapping', async () => {
    const { toolCalls, say } = await atTheBookshop('zh', INTERACTIONS.buyAGift);
    await say('我要买花');
    await say(PLAYER.zh.no);
    await say(PLAYER.zh.yes);
    expect(toolCalls.at(-1)!.args).toEqual({ items: [{ item: 'flowers', quantity: 1 }], wrap: false });
  });

  it.each(LANGUAGE_CODES)('the barista sells the café’s cake, a Comfort Purchase (%s)', async (packId) => {
    const { toolCalls, say } = await atTheCounter(packId);
    await say(COMFORTS_ASKED[packId].cake);
    await say(PLAYER[packId].yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'serve_order', args: { items: [{ item: 'cake', quantity: 1 }] } }]);
  });
});

const atTheBathhouse = (packId: LanguageCode, interaction: Interaction = INTERACTIONS.buyBathEntry) =>
  open(buildNpcSession(interaction, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.attendant, CLOCK_10AM));

/** What the Player asks the attendant for, in each pack: a bath, and to join the gym. */
const BATHHOUSE_ASKED = {
  ja: { bath: 'お風呂に入りたいです', gym: 'ジムに入会したいです' },
  zh: { bath: '我想洗澡', gym: '我想办健身卡' },
  en: { bath: 'one for the baths please', gym: 'I want to join the gym' },
  de: { bath: 'einmal ins Bad bitte', gym: 'ich möchte ins Fitnessstudio' },
} as const;

/** The local name of something the attendant sells, as the mock reads it back. */
const deskGoodName = (packId: LanguageCode, itemId: 'bath-entry' | 'gym-membership') => CULTURE_PACKS[packId].goods[itemId].name.toLowerCase();

describe('mock VoiceSession: the bathhouse (#21, #22)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(LANGUAGE_CODES)('asks about a towel, reads back the bath with its price, then calls admit (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheBathhouse(packId);

    await say(BATHHOUSE_ASKED[packId].bath);
    await say(yes);
    expect(toolCalls).toEqual([]);
    expect(turns.at(-1)!.toLowerCase()).toContain(deskGoodName(packId, 'bath-entry'));
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'admit', args: { options: ['towel'] } }]);
    await answer({ result: 'done' });

    expect(turns).toHaveLength(4);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it('lets the Player in without a towel when they say no to one', async () => {
    const { toolCalls, say } = await atTheBathhouse('zh');
    await say('我想洗澡');
    await say(PLAYER.zh.no);
    await say(PLAYER.zh.yes);
    expect(toolCalls.at(-1)!.args).toEqual({ options: [] });
  });

  it.each(LANGUAGE_CODES)('reads back gym membership with its price, then calls register_member to join (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheBathhouse(packId, INTERACTIONS.joinTheGym);

    await say(BATHHOUSE_ASKED[packId].gym);
    expect(toolCalls).toEqual([]);
    expect(turns.at(-1)!.toLowerCase()).toContain(deskGoodName(packId, 'gym-membership'));
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'register_member', args: { kind: 'join' } }]);
    await answer({ result: 'done' });

    expect(turns).toHaveLength(3);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it.each(LANGUAGE_CODES)('renews a membership that has run out in one yes: the greeting reads it back (%s)', async (packId) => {
    const { turns, toolCalls, say } = await atTheBathhouse(packId, INTERACTIONS.renewGymMembership);
    expect(turns[0]!.toLowerCase()).toContain(deskGoodName(packId, 'gym-membership'));

    await say(PLAYER[packId].yes);

    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'register_member', args: { kind: 'renew' } }]);
  });

  it('says so when the Player cannot afford it, and greets as the attendant, not the shopkeeper', async () => {
    const { turns, say, answer } = await atTheBathhouse('en', INTERACTIONS.renewGymMembership);
    await say('yes');
    await answer({ result: 'cannot_afford' });
    expect(turns.at(-1)).toMatch(/not enough/);

    const shopkeeper = await atTheBookshop('en');
    expect(turns[0]).not.toBe(shopkeeper.turns[0]);
  });
});

const atReception = (packId: LanguageCode) =>
  open(buildNpcSession(INTERACTIONS.checkIn, CULTURE_PACKS[packId], 'B1', NAMED_NPCS.receptionist, CLOCK_10AM));
const withTheDoctor = (packId: LanguageCode) =>
  open(buildNpcSession(INTERACTIONS.seeTheDoctor, CULTURE_PACKS[packId], 'B1', NAMED_NPCS.doctor, { ...CLOCK_10AM, approach: 'doctorCallsName' }));
const atThePharmacy = (packId: LanguageCode, prescription: MedicineId | null = 'cold-medicine') =>
  open(buildNpcSession(INTERACTIONS.getMedicine, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.pharmacist, { ...CLOCK_10AM, prescription }));
const settlingTheBill = (packId: LanguageCode) =>
  open(
    buildNpcSession(INTERACTIONS.settleHospitalBill, CULTURE_PACKS[packId], 'C1', NAMED_NPCS.receptionist, {
      ...CLOCK_10AM,
      hospital: { today: 2, owedInShifts: 1.5, instalmentInShifts: null, rentDueDay: 7 },
    }),
  );

/** What the Player says at the clinic in each pack: a cold's symptoms, and how they pay the hospital bill. */
const PATIENT_SAYS = {
  ja: { cold: '咳が出て、喉が痛いです', hayFever: 'くしゃみが止まりません', all: '全部払います', weeks: '3週間でお願いします' },
  zh: { cold: '我咳嗽，嗓子疼', hayFever: '我一直打喷嚏', all: '我全部付', weeks: '分3周吧' },
  en: { cold: "I've got a cough and a sore throat", hayFever: "I can't stop sneezing", all: "I'll pay it all now", weeks: 'over 3 weeks please' },
  de: { cold: 'Ich habe Husten und Halsschmerzen', hayFever: 'Ich muss ständig niesen', all: 'ich zahle alles sofort', weeks: 'in 3 Wochen bitte' },
} as const;

describe('mock VoiceSession: the clinic (#12, #13, #14, #15)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(LANGUAGE_CODES)('reception hears why the Player has come, reads it back and checks them in on a yes (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atReception(packId);

    await say(PATIENT_SAYS[packId].cold);
    expect(toolCalls).toEqual([]);
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'register_patient', args: { reason: 'cough, sore throat' } }]);
    await answer({ result: 'done' });

    expect(turns).toHaveLength(3);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it.each(LANGUAGE_CODES)('the doctor speaks first, names the Illness the symptoms fit and diagnoses it on a yes (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await withTheDoctor(packId);
    expect(turns).toHaveLength(1);

    await say(PATIENT_SAYS[packId].hayFever);
    expect(toolCalls).toEqual([]);
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'diagnose', args: { illness: 'hay-fever' } }]);
    await answer({ result: 'done' });

    expect(turns).toHaveLength(3);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it.each(LANGUAGE_CODES)('the pharmacist reads back the prescription with its price, and dispenses it on a yes (%s)', async (packId) => {
    const { turns, toolCalls, say, answer } = await atThePharmacy(packId);
    expect(turns[0]!.toLowerCase()).toContain(CULTURE_PACKS[packId].goods['cold-medicine'].name.toLowerCase());

    await say(PLAYER[packId].yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'dispense', args: { medicine: 'cold-medicine' } }]);
    await answer({ result: 'served' });

    expect(turns).toHaveLength(2);
  });

  it('the pharmacist dispenses nothing without a prescription', async () => {
    const { turns, toolCalls, say } = await atThePharmacy('en', null);
    await say('yes please');

    expect(turns[0]).toMatch(/prescription/);
    expect(toolCalls).toEqual([]);
  });

  it.each(LANGUAGE_CODES)('reception says what is owed, then settles it all now or in weeks on a yes (%s)', async (packId) => {
    const { yes } = PLAYER[packId];
    const { turns, toolCalls, say } = await settlingTheBill(packId);
    expect(turns[0]).toContain(formatLocalMoney(1.5, packId));

    await say(PATIENT_SAYS[packId].all);
    await say(yes);
    await say(PATIENT_SAYS[packId].weeks);
    await say(yes);

    expect(toolCalls.map((call) => call.args)).toEqual([{ weeks: 0 }, { weeks: 3 }]);
  });
});

const LUNCH = { clock: { day: 2, minuteOfDay: 12 * 60 } };
const BILL = [
  { itemId: 'fish-dish', quantity: 1 },
  { itemId: 'cola', quantity: 1 },
] as const;
const atTheRestaurant = (packId: LanguageCode, interaction: Interaction) =>
  open(
    buildNpcSession(interaction, CULTURE_PACKS[packId], 'B1', NAMED_NPCS.server, {
      ...LUNCH,
      ...(interaction === INTERACTIONS.payTheBill && { bill: BILL }),
    }),
  );

/** What a guest says to the server, in each pack. */
const GUEST_SAYS = {
  ja: { party: '一人です', seating: '窓際がいいです', fish: '焼き鮭定食をください', vegetarian: 'ベジタリアンです', cash: '現金で' },
  zh: { party: '一位', seating: '靠窗的', fish: '我要清蒸鱼', vegetarian: '我吃素', cash: '用现金' },
  en: { party: 'just me', seating: 'by the window please', fish: 'fish and chips please', vegetarian: "I'm vegetarian", cash: 'cash please' },
  de: { party: 'eine Person', seating: 'am Fenster bitte', fish: 'den Lachs bitte', vegetarian: 'ich bin Vegetarier', cash: 'bar bitte' },
} as const;

describe('mock VoiceSession: the restaurant (#8, #9, #10, #11)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(LANGUAGE_CODES)('asks how many and where to sit, reads both back, then seats the guest (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheRestaurant(packId, INTERACTIONS.getATable);

    await say(GUEST_SAYS[packId].party);
    await say(GUEST_SAYS[packId].seating);
    expect(toolCalls).toEqual([]);
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'seat_guest', args: { party: 1, seating: 'window' } }]);
    await answer({ result: 'done' });

    expect(turns).toHaveLength(4);
    expect(new Set(turns).size).toBe(4);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it.each(LANGUAGE_CODES)('reads back a dish with its price, then serves it with serve_order (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheRestaurant(packId, INTERACTIONS.orderAMeal);

    await say(GUEST_SAYS[packId].fish);
    expect(turns.at(-1)!.toLowerCase()).toContain(CULTURE_PACKS[packId].goods['fish-dish'].name.toLowerCase());
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'serve_order', args: { items: [{ item: 'fish-dish', quantity: 1 }] } }]);
    await answer({ result: 'served' });

    expect(turns).toHaveLength(3);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it.each(LANGUAGE_CODES)('asks what the guest does not eat, recommends a dish that keeps to it, and serves it (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheRestaurant(packId, INTERACTIONS.recommendAMeal);

    await say(GUEST_SAYS[packId].vegetarian);
    expect(turns.at(-1)!.toLowerCase()).toContain(CULTURE_PACKS[packId].goods['veggie-dish'].name.toLowerCase());
    await say(yes);
    expect(toolCalls).toEqual([
      { id: expect.any(String), name: 'serve_order', args: { items: [{ item: 'veggie-dish', quantity: 1 }], restriction: 'vegetarian' } },
    ]);
    await answer({ result: 'served' });

    expect(turns).toHaveLength(3);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it('recommends a dish that keeps to the need again when the game rejects the one the guest asked for', async () => {
    const { turns, toolCalls, say, answer } = await atTheRestaurant('en', INTERACTIONS.recommendAMeal);
    await say("I'm vegetarian");
    await say('fish and chips please');
    await say('yes');
    expect(toolCalls.at(-1)!.args).toEqual({ items: [{ item: 'fish-dish', quantity: 1 }], restriction: 'vegetarian' });

    await answer({ result: 'invalid_arguments', error: 'Fish and chips has fish in it.' });

    expect(turns.at(-1)).toContain(CULTURE_PACKS.en.goods['veggie-dish'].name.toLowerCase());
  });

  it.each(LANGUAGE_CODES)('says the bill total, asks how the guest pays, reads it back and settles the bill (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheRestaurant(packId, INTERACTIONS.payTheBill);
    const total = formatLocalMoney(menuPrice('fish-dish', packId) + menuPrice('cola', packId), packId);
    expect(turns[0]).toContain(total);

    await say(GUEST_SAYS[packId].cash);
    expect(toolCalls).toEqual([]);
    await say(yes);
    expect(toolCalls).toEqual([{ id: expect.any(String), name: 'settle_bill', args: { method: 'cash' } }]);
    await answer({ result: 'done' });

    expect(turns).toHaveLength(3);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it.each(LANGUAGE_CODES)('says what is owed from a bill walked out on as the total, with nothing on the bill today (%s)', async (packId) => {
    const owed = menuPrice('pork-dish', packId) + menuPrice('juice', packId);
    const session = buildNpcSession(INTERACTIONS.payTheBill, CULTURE_PACKS[packId], 'B1', NAMED_NPCS.server, { ...LUNCH, restaurantDebt: owed });
    const { turns } = await open(session);

    expect(turns[0]).toContain(formatLocalMoney(owed, packId));
  });
});

describe('mock VoiceSession: "the usual?"', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const USUAL = { items: [{ item: 'tea', quantity: 2 }] };

  async function regular(packId: LanguageCode) {
    const heard = listen();
    const memory: NpcMemory = {
      ...STRANGER,
      familiarity: FAMILIARITY.tierThresholds.acquaintance,
      usualOrder: { interactionId: INTERACTIONS.orderDrink.id, args: USUAL },
    };
    const npcSession = buildNpcSession(INTERACTIONS.orderDrink, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.barista, {
      clock: { day: 2, minuteOfDay: 600 },
      relationship: { memory, characterName: 'Sam' },
    });
    const session = openMockVoiceSession(npcSession, heard.events);
    await session.connect();
    await vi.runAllTimersAsync();
    const say = async (text: string) => {
      session.sendText(text);
      await vi.runAllTimersAsync();
    };
    return { ...heard, say };
  }

  it.each(LANGUAGE_CODES)('offers the usual in the %s pack, and serves it on a yes', async (packId) => {
    const { turns, toolCalls, say } = await regular(packId);
    const yes = { ja: 'はい、お願いします', zh: '好', en: 'Yes please', de: 'Ja, gerne' }[packId];

    expect(turns[0]).toBe({ ja: 'いらっしゃいませ！いつものでいいですか？', zh: '欢迎光临！还是老样子吗？', en: 'Hiya! The usual?', de: 'Hallo! Wie immer?' }[packId]);
    await say(yes);

    expect(toolCalls).toMatchObject([{ name: 'serve_order', args: USUAL }]);
  });

  it('takes an order as usual when the Player wants something else', async () => {
    const { turns, toolCalls, say } = await regular('en');

    await say('A latte, please');

    expect(turns.at(-1)).toMatch(/latte.*Is that right\?/i);
    expect(toolCalls).toEqual([]);
  });
});

const atTheCafe = (packId: LanguageCode, interaction: Interaction, step: 'B1' | 'C1', memory?: NpcMemory) =>
  open(
    buildNpcSession(interaction, CULTURE_PACKS[packId], step, NAMED_NPCS.barista, {
      clock: { day: 2, minuteOfDay: 600 },
      ...(memory && { relationship: { memory, characterName: 'Sam' } }),
    }),
  );

/** What a customer says to the barista, in each pack: a coffee and a pastry, then how the coffee is made, or all at once. */
const CUSTOMER_SAYS = {
  ja: { coffeeAndPastry: 'コーヒーとメロンパンをください', large: 'Lサイズで', iced: 'アイスで', all: 'Lサイズのアイスコーヒーにミルクを入れてください', egg: '卵アレルギーです', none: 'アレルギーはありません' },
  zh: { coffeeAndPastry: '我要咖啡和蛋挞', large: '大杯', iced: '要冰的', all: '我要大杯冰的咖啡，加奶', egg: '我对鸡蛋过敏', none: '我没有过敏' },
  en: { coffeeAndPastry: 'a coffee and a scone please', large: 'large please', iced: 'iced please', all: 'a large iced coffee with milk please', egg: "I'm allergic to eggs", none: 'no allergies' },
  de: { coffeeAndPastry: 'einen Kaffee und eine Brezel bitte', large: 'groß bitte', iced: 'mit Eis bitte', all: 'einen großen Kaffee mit Eis und Milch bitte', egg: 'ich bin allergisch gegen Eier', none: 'keine Allergien' },
} as const;

const LARGE_ICED = { item: 'coffee', quantity: 1, size: 'large', temperature: 'iced' } as const;

describe('mock VoiceSession: café orders with options and allergens (#2, #3)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(LANGUAGE_CODES)('asks the size and hot or iced of a drink made to order, reads the order back, then serves it (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const says = CUSTOMER_SAYS[packId];
    const { goods } = CULTURE_PACKS[packId];
    const { turns, toolCalls, say, answer } = await atTheCafe(packId, INTERACTIONS.orderWithOptions, 'B1');

    await say(says.coffeeAndPastry);
    await say(says.large);
    await say(says.iced);
    expect(toolCalls).toEqual([]);
    const total = formatLocalMoney(menuPrice('coffee', packId) + menuPrice('pastry', packId), packId);
    expect(turns.at(-1)).toContain(goods.coffee.name);
    expect(turns.at(-1)).toContain(goods.pastry.name);
    expect(turns.at(-1)).toContain(total);
    await say(yes);
    expect(toolCalls).toEqual([
      { id: expect.any(String), name: 'serve_order', args: { items: [{ ...LARGE_ICED, extras: [] }, { item: 'pastry', quantity: 1 }] } },
    ]);
    await answer({ result: 'served' });

    expect(turns).toHaveLength(5);
    expect(new Set(turns).size).toBe(5);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it.each(LANGUAGE_CODES)('takes a drink with its size, hot or iced and an extra all said at once (%s)', async (packId) => {
    const { turns, toolCalls, say } = await atTheCafe(packId, INTERACTIONS.orderWithOptions, 'B1');

    await say(CUSTOMER_SAYS[packId].all);
    expect(turns.at(-1)).toContain(CULTURE_PACKS[packId].drinkOptions.milk.name);
    await say(PLAYER[packId].yes);

    expect(toolCalls.map((call) => call.args)).toEqual([{ items: [{ ...LARGE_ICED, extras: ['milk'] }] }]);
  });

  it.each(LANGUAGE_CODES)('asks about allergies first, then serves an order avoiding the one the customer has (%s)', async (packId) => {
    const { yes, script } = PLAYER[packId];
    const { turns, toolCalls, say, answer } = await atTheCafe(packId, INTERACTIONS.orderAvoidingAllergen, 'C1');

    await say(CUSTOMER_SAYS[packId].egg);
    expect(turns.at(-1)).toContain(CULTURE_PACKS[packId].allergens.egg.name);
    await say(CUSTOMER_SAYS[packId].all);
    await say(yes);
    expect(toolCalls.map((call) => call.args)).toEqual([{ items: [{ ...LARGE_ICED, extras: ['milk'] }], allergen: 'egg' }]);
    await answer({ result: 'served' });

    expect(turns).toHaveLength(4);
    for (const turn of turns) expect(turn).toMatch(script);
  });

  it('orders with no allergy as "none"', async () => {
    const { toolCalls, say } = await atTheCafe('en', INTERACTIONS.orderAvoidingAllergen, 'C1');

    await say('no allergies');
    await say('a latte please');
    await say('yes');

    expect(toolCalls.map((call) => call.args)).toEqual([{ items: [{ item: 'latte', quantity: 1 }], allergen: 'none' }]);
  });

  it('says what has the allergen in it when the game rejects the order, and takes another', async () => {
    const { turns, toolCalls, say, answer } = await atTheCafe('en', INTERACTIONS.orderAvoidingAllergen, 'C1');
    await say("I'm allergic to milk");
    await say('a latte please');
    await say('yes');

    await answer({ result: 'invalid_arguments', error: 'Latte (menu id "latte") has milk in it.' });
    expect(turns.at(-1)).toMatch(/latte has milk in it/i);
    await say('a tea please');
    await say('medium please');
    await say('hot please');
    await say('yes');

    expect(toolCalls.at(-1)!.args).toEqual({ items: [{ item: 'tea', quantity: 1, size: 'medium', temperature: 'hot', extras: [] }], allergen: 'milk' });
  });

  it('offers a usual made to order, and serves it as it is made', async () => {
    const usual = { items: [{ ...LARGE_ICED, extras: ['sugar'] }] };
    const memory: NpcMemory = {
      ...STRANGER,
      familiarity: FAMILIARITY.tierThresholds.acquaintance,
      usualOrder: { interactionId: INTERACTIONS.orderWithOptions.id, args: usual },
    };
    const { turns, toolCalls, say } = await atTheCafe('en', INTERACTIONS.orderWithOptions, 'B1', memory);

    expect(turns[0]).toBe('Hiya! The usual?');
    await say('yes please');

    expect(toolCalls.map((call) => call.args)).toEqual([usual]);
  });
});
