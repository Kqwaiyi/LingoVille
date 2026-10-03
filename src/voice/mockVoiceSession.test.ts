import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNpcSession, OUT_OF_PATIENCE_SCENE, type ToolResponse } from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS } from '../content/index.ts';
import type { LanguageCode } from '../sim/index.ts';
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

/** A connected fake barista that has already greeted the Player. */
async function atTheCounter(packId: LanguageCode = 'ja') {
  const heard = listen();
  const session = openMockVoiceSession(npcSession(packId), heard.events);
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

const { menu } = CULTURE_PACKS.ja.cafe;

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

    expect(turns.at(-1)).toContain(menu.latte);
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
