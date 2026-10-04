import { describe, expect, it } from 'vitest';
import type { AnnotateRequest, Annotation, Hint, HintRequest, Recap, RecapRequest } from '../ai/index.ts';
import { INTERACTIONS, placePhrasebook } from '../content/index.ts';
import { CLOCK, createSave, FIRST_MORNING, type GameState } from '../sim/index.ts';
import type { OpenVoiceSession, VoiceSessionEvents } from '../voice/index.ts';
import {
  createGameStore,
  DEV_SETUP,
  selectConversation,
  selectHelpOpen,
  selectHints,
  selectNpcExpression,
  selectPhrasebook,
  selectTimeScale,
  selectTranslation,
  type GameStoreDeps,
} from './index.ts';
import { recordingSaves } from './testSaves.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const HINTS: Hint[] = [
  { text: 'ホットラテをください。', translation: 'A hot latte, please.' },
  { text: 'メニューをください。', translation: 'The menu, please.' },
];

/** Something the test answers when it says, or fails. */
function pending<Request, Answer>() {
  const asked: { request: Request; answer: (answer: Answer) => Promise<void>; fail: () => Promise<void> }[] = [];
  const ask = (request: Request) =>
    new Promise<Answer>((resolve, reject) =>
      asked.push({
        request,
        answer: async (answer) => {
          resolve(answer);
          await flush();
        },
        fail: async () => {
          reject(new Error('unavailable'));
          await flush();
        },
      }),
    );
  return { asked, ask };
}

/** A café whose barista, hints, translations and Recaps the test speaks for. */
function cafe(game: GameState = createSave(DEV_SETUP)) {
  const npc = {
    events: null as VoiceSessionEvents | null,
    sent: [] as string[],
    says(text: string) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete();
    },
    calls(name: string, args: unknown) {
      npc.events!.onToolCall({ id: 'call', name, args });
    },
  };
  const openVoiceSession: OpenVoiceSession = (_, events) => {
    npc.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: (text) => void npc.sent.push(text),
      sendToolResponse: () => {},
      close: () => {},
    };
  };
  const hints = pending<HintRequest, Hint[]>();
  const annotations = pending<AnnotateRequest, Annotation>();
  const recaps = pending<RecapRequest, Recap>();
  const { saves, written } = recordingSaves();
  const deps: Partial<GameStoreDeps> = {
    openVoiceSession,
    requestHints: hints.ask,
    requestAnnotation: annotations.ask,
    requestRecap: recaps.ask,
    saves,
    journal: { append: async () => ({}) as never, list: async () => [], raw: async () => [], restore: async () => {}, remove: async () => {} },
  };
  const store = createGameStore(game, deps);
  store.getState().enterPlace('cafe');
  store.getState().setInteractable('barista');
  store.getState().talk();
  return { store, npc, hints, annotations, recaps, written };
}

const GREETING = 'いらっしゃいませ！ご注文はお決まりですか？';

describe('the Help tab', () => {
  it('stops the clock and freezes Patience while it is open', () => {
    const { store, npc } = cafe();
    npc.says(GREETING);
    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.conversation);

    store.getState().toggleHelp();

    expect(selectHelpOpen(store.getState())).toBe(true);
    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.paused);
    const before = store.getState().game.clock;
    store.getState().advance(10_000);
    expect(store.getState().game.clock).toEqual(before);

    const patience = selectConversation(store.getState())!.patience;
    npc.calls('not_understood', { reason: 'unintelligible' });
    expect(selectConversation(store.getState())!.patience).toEqual(patience);
    expect(selectNpcExpression(store.getState())).toBe('relaxed');

    store.getState().toggleHelp();
    expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.conversation);
  });

  it('asks for hints for this moment, built from the interaction, the step and the transcript so far', async () => {
    const { store, npc, hints } = cafe();
    npc.says(GREETING);

    store.getState().toggleHelp();

    expect(selectHints(store.getState())).toEqual({ status: 'loading' });
    expect(hints.asked.map((a) => a.request)).toEqual([
      {
        culturePackId: DEV_SETUP.culturePackId,
        step: DEV_SETUP.startingStep,
        nativeLanguage: 'en',
        interactionId: INTERACTIONS.orderDrink.id,
        transcript: [{ speaker: 'npc', text: GREETING }],
      },
    ]);
    await hints.asked[0]!.answer(HINTS);
    expect(selectHints(store.getState())).toEqual({ status: 'ready', hints: HINTS });
  });

  it('keeps the hints until the conversation moves on, then asks again', async () => {
    const { store, npc, hints } = cafe();
    npc.says(GREETING);
    store.getState().toggleHelp();
    await hints.asked[0]!.answer(HINTS);
    store.getState().toggleHelp();
    store.getState().toggleHelp();
    expect(hints.asked).toHaveLength(1);

    store.getState().sendTypedLine('ラテ');
    npc.says('ホットラテですね。');
    store.getState().toggleHelp();

    expect(hints.asked).toHaveLength(2);
    expect(hints.asked[1]!.request.transcript).toHaveLength(3);
  });

  it('keeps showing the hints when the NPC finishes a line while Help is open', async () => {
    const { store, npc, hints } = cafe();
    npc.says('いらっしゃいませ！');
    store.getState().toggleHelp();
    npc.says('ご注文はお決まりですか？');

    await hints.asked[0]!.answer(HINTS);

    expect(selectHints(store.getState())).toEqual({ status: 'ready', hints: HINTS });
    expect(selectConversation(store.getState())!.helpLog.filter((entry) => entry.kind === 'hint')).toHaveLength(HINTS.length);
  });

  it('says when no hints could be had', async () => {
    const { store, npc, hints } = cafe();
    npc.says(GREETING);
    store.getState().toggleHelp();

    await hints.asked[0]!.fail();

    expect(selectHints(store.getState())).toEqual({ status: 'failed' });
  });

  it('closes when the Player takes a turn, so the conversation carries on', () => {
    const { store, npc } = cafe();
    npc.says(GREETING);
    store.getState().toggleHelp();

    store.getState().sendTypedLine('ホットラテをください。');

    expect(selectHelpOpen(store.getState())).toBe(false);
    expect(npc.sent).toEqual(['ホットラテをください。']);
  });

  it('costs no money and no Mood', async () => {
    const { store, npc, hints, annotations } = cafe();
    npc.says(GREETING);
    const character = store.getState().game.character;

    store.getState().toggleHelp();
    await hints.asked[0]!.answer(HINTS);
    store.getState().toggleHelp();
    await annotations.asked[0]!.answer({ translation: 'Welcome!' });
    store.getState().translateLine(0);

    expect(store.getState().game.character).toEqual(character);
  });

  it('works the same at every step', () => {
    for (const startingStep of ['A1', 'B2'] as const) {
      const { store, npc, hints } = cafe(createSave({ ...DEV_SETUP, startingStep }));
      npc.says(GREETING);
      store.getState().toggleHelp();
      expect(selectHelpOpen(store.getState())).toBe(true);
      expect(selectTimeScale(store.getState())).toBe(CLOCK.timeScale.paused);
      expect(hints.asked).toHaveLength(1);
    }
  });

  it('cannot open once the conversation is over', () => {
    const { store, npc } = cafe();
    npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    npc.says('ありがとうございました。');

    store.getState().toggleHelp();

    expect(selectHelpOpen(store.getState())).toBe(false);
  });
});

describe('Translate', () => {
  it('annotates each NPC line in the Target Language as soon as it finishes', () => {
    const { npc, annotations } = cafe();

    npc.events!.onOutputTranscript('いらっしゃいませ！');
    expect(annotations.asked).toEqual([]);
    npc.events!.onOutputTranscript('ご注文は？');
    npc.events!.onTurnComplete();

    expect(annotations.asked.map((a) => a.request)).toEqual([
      { targetLanguage: DEV_SETUP.targetLanguage, nativeLanguage: 'en', line: 'いらっしゃいませ！ご注文は？' },
    ]);
  });

  it('shows the translation already returned for the line, instantly', async () => {
    const { store, npc, annotations } = cafe();
    npc.says(GREETING);
    await annotations.asked[0]!.answer({ translation: 'Welcome! Are you ready to order?' });
    expect(selectTranslation(0)(store.getState())).toBeNull();

    store.getState().translateLine(0);

    expect(selectTranslation(0)(store.getState())).toEqual({ status: 'ready', text: 'Welcome! Are you ready to order?' });
  });

  it('shows the translation the moment it arrives if Translate was pressed first, and asks again if it failed', async () => {
    const { store, npc, annotations } = cafe();
    npc.says(GREETING);
    store.getState().translateLine(0);
    expect(selectTranslation(0)(store.getState())).toEqual({ status: 'loading' });

    await annotations.asked[0]!.fail();
    expect(selectTranslation(0)(store.getState())).toEqual({ status: 'failed' });

    store.getState().translateLine(0);
    store.getState().translateLine(0);
    expect(annotations.asked).toHaveLength(2);
    await annotations.asked[1]!.answer({ translation: 'Welcome!' });
    expect(selectTranslation(0)(store.getState())).toEqual({ status: 'ready', text: 'Welcome!' });
  });

  it('only translates NPC lines', () => {
    const { store, npc } = cafe();
    npc.says(GREETING);
    store.getState().sendTypedLine('ラテ');

    store.getState().translateLine(1);

    expect(selectTranslation(1)(store.getState())).toBeNull();
    expect(selectConversation(store.getState())!.helpLog).toEqual([]);
  });
});

describe('the Help log', () => {
  /** Orders a latte, using whatever Help `use` asks for along the way, and returns the Recap request. */
  async function orderWith(use: (setup: ReturnType<typeof cafe>) => Promise<void>) {
    const setup = cafe();
    const { store, npc, recaps } = setup;
    npc.says(GREETING);
    await use(setup);
    store.getState().sendTypedLine('ホットラテをください。');
    npc.says('ホットラテですね。450円です。よろしいですか？');
    store.getState().sendTypedLine('はい');
    npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    npc.says('ありがとうございました。');
    return recaps.asked[0]!.request as Extract<RecapRequest, { kind: 'goal' }>;
  }

  it('is empty when no Help was used', async () => {
    const request = await orderWith(async () => {});

    expect(request.conversation.helpLog).toEqual([]);
  });

  it('records the hints and phrasebook entries shown and the NPC lines translated, in order, and sends them to the Recap', async () => {
    const request = await orderWith(async ({ store, hints, annotations }) => {
      await annotations.asked[0]!.answer({ translation: 'Welcome!' });
      store.getState().translateLine(0);
      store.getState().toggleHelp();
      await hints.asked[0]!.answer(HINTS);
    });

    const phrases = placePhrasebook(DEV_SETUP.culturePackId, 'cafe');
    expect(request.conversation.helpLog).toEqual([
      { afterLine: 1, kind: 'translate', text: GREETING },
      ...phrases.map((phrase) => ({ afterLine: 1, kind: 'phrasebook', text: phrase.text })),
      ...HINTS.map((hint) => ({ afterLine: 1, kind: 'hint', text: hint.text })),
    ]);
  });

  it('records each piece of Help once at the same moment, however often it is opened', async () => {
    const request = await orderWith(async ({ store, hints, annotations }) => {
      await annotations.asked[0]!.answer({ translation: 'Welcome!' });
      store.getState().translateLine(0);
      store.getState().translateLine(0);
      store.getState().translateLine(0);
      store.getState().toggleHelp();
      await hints.asked[0]!.answer(HINTS);
      store.getState().toggleHelp();
      store.getState().toggleHelp();
    });

    const kinds = request.conversation.helpLog.map((entry) => entry.kind);
    expect(kinds.filter((kind) => kind === 'translate')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'hint')).toHaveLength(HINTS.length);
  });

  it('does not record hints that arrived after Help was closed, since they were never shown', async () => {
    const request = await orderWith(async ({ store, hints }) => {
      store.getState().toggleHelp();
      store.getState().toggleHelp();
      await hints.asked[0]!.answer(HINTS);
    });

    expect(request.conversation.helpLog.some((entry) => entry.kind === 'hint')).toBe(false);
  });
});

describe('the personal phrasebook', () => {
  const WORD = { base: 'いらっしゃいませ', reading: 'いらっしゃいませ', gloss: 'welcome' };

  it('keeps a Recap’s new word, in the Native Language it was glossed in, and saves it', () => {
    const { store, npc, written } = cafe();
    npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    npc.says('ありがとうございました。');
    written.length = 0;

    // On the Recap's new words.
    store.getState().addToPhrasebook(WORD, 'en');

    const entry = { text: WORD.base, reading: WORD.reading, gloss: WORD.gloss, glossLanguage: 'en', dayAdded: FIRST_MORNING.day };
    expect(selectPhrasebook(store.getState())).toEqual([entry]);
    expect(written.at(-1)?.game.phrasebook).toEqual([entry]);
  });

  it('shows its entries in the Help tab, and records them as shown', async () => {
    const { store, npc, recaps } = cafe();
    store.getState().addToPhrasebook(WORD, 'en');
    npc.says(GREETING);

    store.getState().toggleHelp();
    store.getState().sendTypedLine('ホットラテをください。');
    npc.calls('serve_order', { items: [{ item: 'latte', quantity: 1 }] });
    npc.says('ありがとうございました。');

    const request = recaps.asked[0]!.request as Extract<RecapRequest, { kind: 'goal' }>;
    expect(request.conversation.helpLog).toContainEqual({ afterLine: 1, kind: 'phrasebook', text: WORD.base });
  });
});
