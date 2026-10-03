import { describe, expect, it } from 'vitest';
import { OUT_OF_PATIENCE_SCENE, type ToolResponse } from '../ai/index.ts';
import { CAFE_ITEMS, CULTURE_PACKS } from '../content/index.ts';
import { createSave, MOOD, PROFICIENCY_STEP_TABLE, WELL_BEING, type GameState } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  selectChatLines,
  selectClosingCard,
  selectConversation,
  selectNpcExpression,
  selectTyping,
} from './index.ts';

const LATTE = { items: [{ item: 'latte', quantity: 1 }] };

/** A stand-in NPC the test speaks for, recording what the store sends it and how it answers tool calls. */
function fakeVoice() {
  let calls = 0;
  const fake = {
    events: null as VoiceSessionEvents | null,
    sent: [] as string[],
    answers: [] as ToolResponse[],
    closed: false,
    says(text: string) {
      fake.events!.onOutputTranscript(text);
      fake.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      fake.events!.onToolCall({ id: `call-${++calls}`, name, args });
      return fake.answers.at(-1);
    },
  };
  const open: OpenVoiceSession = (_, events) => {
    fake.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: (text) => fake.sent.push(text),
      sendToolResponse: (_id, response) => fake.answers.push(response),
      close: () => (fake.closed = true),
    };
  };
  return { fake, open };
}

function orderingADrink(game: Partial<GameState['character']> = {}) {
  const { fake, open } = fakeVoice();
  const save = createSave(DEV_SETUP);
  const store = createGameStore({ ...save, character: { ...save.character, ...game } }, { openVoiceSession: open });
  store.getState().enterPlace('cafe');
  store.getState().setInteractable('barista');
  store.getState().talk();
  fake.says('いらっしゃいませ！');
  return { store, fake };
}

function servedALatte() {
  const { store, fake } = orderingADrink();
  store.getState().sendTypedLine('ラテ ください');
  fake.says('ホットラテですね。450円です。よろしいですか？');
  store.getState().sendTypedLine('はい');
  const before = store.getState().game;
  fake.calls('serve_order', LATTE);
  return { store, fake, before };
}

const patience = PROFICIENCY_STEP_TABLE[DEV_SETUP.startingStep].startingPatience;

describe('ordering a drink', () => {
  it('serves a confirmed order: payment is taken, Thirst and Mood rise, and the NPC is told', () => {
    const { store, fake, before } = servedALatte();
    const { character } = store.getState().game;

    expect(fake.answers).toEqual([{ result: 'served' }]);
    expect(character.moneyInShifts).toBeCloseTo(before.character.moneyInShifts - CAFE_ITEMS.latte.priceInShifts);
    expect(character.thirst).toBe(before.character.thirst + WELL_BEING.cafeDrinkThirst);
    expect(character.mood).toBe(before.character.mood + MOOD.changes.goalInteractionSuccess);
  });

  it('shows the closing card once the NPC has said goodbye', () => {
    const { store, fake } = servedALatte();
    expect(selectClosingCard(store.getState())).toBeNull();

    fake.says('ありがとうございます！またお越しくださいませ。');

    expect(fake.closed).toBe(true);
    expect(selectClosingCard(store.getState())).toEqual({
      kind: 'success',
      served: [{ name: CULTURE_PACKS.ja.cafe.menu.latte, gloss: CAFE_ITEMS.latte.gloss, quantity: 1 }],
      paidInShifts: CAFE_ITEMS.latte.priceInShifts,
      moodChange: MOOD.changes.goalInteractionSuccess,
    });
    // The transcript stays in the column behind the card.
    expect(selectChatLines(store.getState()).at(-1)?.text).toBe('ありがとうございます！またお越しくださいませ。');
  });

  it('stops listening to the Player once the order is served', () => {
    const { store, fake } = servedALatte();
    const sent = fake.sent.length;

    store.getState().sendTypedLine('もう一杯');

    expect(fake.sent).toHaveLength(sent);
  });

  it('frees the keys for walking once the closing card shows', () => {
    const { store, fake } = servedALatte();
    store.getState().setTyping(true);

    fake.says('ありがとうございました。');

    expect(selectTyping(store.getState())).toBe(false);
  });

  it('Skip Recap closes the closing card', () => {
    const { store, fake } = servedALatte();
    fake.says('ありがとうございました。');

    store.getState().skipRecap();

    expect(selectConversation(store.getState())).toBeNull();
    expect(selectClosingCard(store.getState())).toBeNull();
  });

  it('leaving during the goodbye skips to the closing card, keeping the order', () => {
    const { store, fake } = servedALatte();
    const game = store.getState().game;

    store.getState().leaveConversation();

    expect(fake.closed).toBe(true);
    expect(selectClosingCard(store.getState())?.kind).toBe('success');
    expect(store.getState().game).toBe(game);

    store.getState().leaveConversation();
    expect(selectConversation(store.getState())).toBeNull();
  });

  it('walking away during the goodbye still shows the closing card, and walking on keeps it', () => {
    const { store, fake } = servedALatte();

    store.getState().setInteractable(null);

    expect(fake.closed).toBe(true);
    expect(selectClosingCard(store.getState())?.kind).toBe('success');

    store.getState().setInteractable('tap');
    expect(selectClosingCard(store.getState())?.kind).toBe('success');
  });

  it("tells the NPC when the Character can't afford it, and the conversation goes on", () => {
    const { store, fake } = orderingADrink({ moneyInShifts: CAFE_ITEMS.latte.priceInShifts / 2 });
    const game = store.getState().game;

    fake.calls('serve_order', LATTE);
    fake.says('申し訳ございません、お支払いが足りないようです。');

    expect(fake.answers).toEqual([{ result: 'cannot_afford' }]);
    expect(store.getState().game).toBe(game);
    expect(selectClosingCard(store.getState())).toBeNull();
    expect(fake.closed).toBe(false);
  });

  it('tells the NPC when its completion arguments are invalid, changing nothing', () => {
    const { store, fake } = orderingADrink();
    const game = store.getState().game;

    fake.calls('serve_order', { items: [{ item: 'champagne', quantity: 1 }] });

    expect(fake.answers).toEqual([{ result: 'invalid_arguments', error: expect.any(String) }]);
    expect(store.getState().game).toBe(game);
  });
});

describe('Patience', () => {
  it('starts relaxed and drops when the NPC cannot make sense of a turn', () => {
    const { store, fake } = orderingADrink();
    expect(selectNpcExpression(store.getState())).toBe('relaxed');

    store.getState().sendTypedLine('asdf');
    expect(fake.calls('not_understood', { reason: 'unintelligible' })).toEqual({ result: 'noted' });

    expect(selectNpcExpression(store.getState())).not.toBe('relaxed');
  });

  it('never drops on a clarifying re-ask', () => {
    const { store, fake } = orderingADrink();

    for (let i = 0; i < patience + 1; i++) {
      store.getState().sendTypedLine('ラテ');
      fake.says('サイズはどうしますか？');
    }

    expect(selectNpcExpression(store.getState())).toBe('relaxed');
    expect(fake.answers).toEqual([]);
  });

  it('drops on an unreadable typed turn, once, even if the NPC also calls not_understood', () => {
    const once = orderingADrink();
    once.store.getState().sendTypedLine('???');
    once.fake.calls('not_understood', { reason: 'unintelligible' });

    const control = orderingADrink();
    control.store.getState().sendTypedLine('asdf');
    control.fake.calls('not_understood', { reason: 'unintelligible' });

    expect(selectNpcExpression(once.store.getState())).toBe(selectNpcExpression(control.store.getState()));
    expect(once.fake.sent).toEqual(['???']);
  });

  it('runs out after the starting Patience for the step: the NPC ends politely and the interaction fails', () => {
    const { store, fake } = orderingADrink();
    const before = store.getState().game;

    for (let i = 1; i < patience; i++) {
      store.getState().sendTypedLine('asdf');
      expect(fake.calls('not_understood', { reason: 'unintelligible' })).toEqual({ result: 'noted' });
      fake.says('すみません、よくわかりませんでした。');
    }
    expect(selectNpcExpression(store.getState())).toBe('strained');
    store.getState().sendTypedLine('asdf');
    expect(fake.calls('not_understood', { reason: 'unintelligible' })).toEqual({ result: 'out_of_patience' });

    const { character } = store.getState().game;
    expect(character.moneyInShifts).toBe(before.character.moneyInShifts);
    expect(character.mood).toBe(before.character.mood + MOOD.changes.goalInteractionFailure);
    expect(selectClosingCard(store.getState())).toBeNull();

    fake.says('申し訳ございません…。');

    expect(fake.closed).toBe(true);
    expect(selectClosingCard(store.getState())).toEqual({ kind: 'failure', moodChange: MOOD.changes.goalInteractionFailure });
  });

  it('when an unreadable turn uses up the last of it, tells the NPC to end the conversation', () => {
    const { store, fake } = orderingADrink();
    for (let i = 1; i < patience; i++) store.getState().sendTypedLine('...');

    store.getState().sendTypedLine('...');

    expect(fake.sent.at(-1)).toBe(OUT_OF_PATIENCE_SCENE);
    expect(selectChatLines(store.getState()).at(-1)).toEqual({ speaker: 'player', text: '...' });
    fake.says('申し訳ございません…。');
    expect(selectClosingCard(store.getState())?.kind).toBe('failure');
  });

  it('is gone with the conversation: leaving early costs nothing and the next one starts relaxed', () => {
    const { store, fake } = orderingADrink();
    store.getState().sendTypedLine('asdf');
    fake.calls('not_understood', { reason: 'unintelligible' });
    const game = store.getState().game;

    store.getState().leaveConversation();

    expect(store.getState().game).toBe(game);
    expect(selectClosingCard(store.getState())).toBeNull();
    store.getState().talk();
    expect(selectNpcExpression(store.getState())).toBe('relaxed');
  });
});
