import { describe, expect, it } from 'vitest';
import type { VoiceRequest } from '../ai/index.ts';
import { createSave, type LanguageCode } from '../sim/index.ts';
import type { OpenVoiceSession, SpokenTurn, VoiceSessionEvents } from '../voice/index.ts';
import { createGameStore, DEV_SETUP } from './index.ts';
import { recordingSaves } from './testSaves.ts';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The café with a barista the test speaks for, and a record of everything said again. */
function cafe() {
  const npc = {
    events: null as VoiceSessionEvents | null,
    /** The barista says a line, aloud (`spoken`) or, like the scripted fake NPC, with nothing to hear again. */
    says(text: string, spoken?: SpokenTurn) {
      npc.events!.onOutputTranscript(text);
      npc.events!.onTurnComplete(spoken);
    },
  };
  const openVoiceSession: OpenVoiceSession = (_, events) => {
    npc.events = events;
    return {
      connect: async () => {},
      startTalking: () => {},
      stopTalking: () => {},
      sendText: () => {},
      sendToolResponse: () => {},
      close: () => {},
    };
  };
  const replayed: SpokenTurn[] = [];
  const said: { text: string; targetLanguage: LanguageCode; voice?: VoiceRequest }[] = [];
  const store = createGameStore(createSave(DEV_SETUP), {
    openVoiceSession,
    saves: recordingSaves().saves,
    replaySpoken: (spoken) => void replayed.push(spoken),
    hearItSaid: async (text, targetLanguage, voice) => void said.push({ text, targetLanguage, ...(voice && { voice }) }),
  });
  store.getState().enterPlace('cafe');
  store.getState().setInteractable('barista');
  return { store, npc, replayed, said };
}

describe('🔊 Replay on an NPC line', () => {
  it('plays the line again just as the NPC said it', async () => {
    const { store, npc, replayed, said } = cafe();
    store.getState().talk();
    npc.says('いらっしゃいませ！', ['IRASSHAI', 'MASE']);
    store.getState().sendTypedLine('ラテ ください');
    npc.says('ラテですね。', ['LATTE']);

    store.getState().replayLine(0);
    store.getState().replayLine(2);
    await flush();

    expect(replayed).toEqual([['IRASSHAI', 'MASE'], ['LATTE']]);
    expect(said).toEqual([]);
  });

  it('says a line it has nothing of aloud in the NPC’s own voice, not the language’s', async () => {
    const { store, npc, replayed, said } = cafe();
    store.getState().talk();
    npc.says('いらっしゃいませ！');

    store.getState().replayLine(0);
    await flush();

    expect(replayed).toEqual([]);
    expect(said).toEqual([{ text: 'いらっしゃいませ！', targetLanguage: DEV_SETUP.targetLanguage, voice: { targetLanguage: DEV_SETUP.targetLanguage, npcId: 'barista' } }]);
  });
});
