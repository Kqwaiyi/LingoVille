import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildNpcSession } from '../ai/index.ts';
import { CULTURE_PACKS, INTERACTIONS, NAMED_NPCS } from '../content/index.ts';
import type { LanguageCode } from '../sim/index.ts';
import { openMockVoiceSession, type VoiceSessionEvents } from './index.ts';

function npcSession(packId: LanguageCode) {
  return buildNpcSession(INTERACTIONS.orderDrink, CULTURE_PACKS[packId], 'A1', NAMED_NPCS.barista, {
    clock: { day: 1, minuteOfDay: 420 },
  });
}

/** Records what the fake NPC says, one entry per finished turn. */
function listen() {
  const turns: string[] = [];
  let current = '';
  const events: VoiceSessionEvents = {
    onOutputTranscript: (text) => (current += text),
    onTurnComplete: () => {
      turns.push(current);
      current = '';
    },
  };
  return { turns, events };
}

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
    session.sendText('はい');
    await vi.runAllTimersAsync();

    expect(turns).toHaveLength(3);
  });

  it.each([
    ['ja', /[ぁ-んァ-ン]/],
    ['zh', /[一-龯]/],
    ['en', /^[\x20-\x7e’]+$/],
    ['de', /[A-Za-zäöüß]/],
  ] as const)('speaks only the Target Language (%s)', async (packId, script) => {
    const { turns, events } = listen();
    const session = openMockVoiceSession(npcSession(packId), events);
    await session.connect();
    await vi.runAllTimersAsync();
    session.sendText('hello');
    await vi.runAllTimersAsync();

    for (const turn of turns) expect(turn).toMatch(script);
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
});
