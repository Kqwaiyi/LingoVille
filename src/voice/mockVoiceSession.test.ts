import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  basketChangedScene,
  buildNpcSession,
  buildShiftCustomerSession,
  OUT_OF_PATIENCE_SCENE,
  shiftCustomerChangeScene,
  shiftCustomerServedScene,
  type ToolResponse,
} from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS, type Interaction } from '../content/index.ts';
import { LANGUAGE_CODES, type ApproachId, type LanguageCode, type ShiftCustomer, type ShiftOrder } from '../sim/index.ts';
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

  async function hiring(packId: LanguageCode) {
    const heard = listen();
    const npcSession = buildNpcSession(INTERACTIONS.askBaristaForWork, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.barista, {
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

describe('mock VoiceSession: a Shift Customer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const WANTS_A_LATTE: ShiftCustomer = { templateId: 'barista-single-drink', order: [{ itemId: 'latte', quantity: 1 }], changedFrom: null, voiceSeed: 7 };
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
