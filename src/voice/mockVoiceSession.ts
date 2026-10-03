import type { LanguageCode } from '../sim/index.ts';
import type { OpenVoiceSession } from './voiceSession.ts';

/** Roughly how long the real NPC takes to start answering. */
const REPLY_DELAY_MS = 600;

// What the fake barista says: a greeting, then replies in turn, round and round.
// None of them sounds like not understanding, which only a real failed turn may (ticket 04).
const SCRIPT: Record<LanguageCode, { greeting: string; replies: string[] }> = {
  ja: {
    greeting: 'いらっしゃいませ！ご注文はお決まりですか？',
    replies: ['はい、かしこまりました。ほかに何かありますか？', 'サイズはどうしますか？', 'ホットとアイス、どちらにしますか？'],
  },
  zh: {
    greeting: '欢迎光临！您想喝点什么？',
    replies: ['好的。还要别的吗？', '要大杯还是小杯？', '要热的还是冰的？'],
  },
  en: {
    greeting: 'Hiya! What can I get you?',
    replies: ['Lovely. Anything else?', 'Small or large?', 'Hot or iced?'],
  },
  de: {
    greeting: 'Hallo! Was darf’s sein?',
    replies: ['Gerne. Sonst noch etwas?', 'Klein oder groß?', 'Warm oder kalt?'],
  },
};

/**
 * The mock-mode NPC: a scripted fake that greets first and answers every
 * typed line in the Target Language, after a short delay.
 */
export const openMockVoiceSession: OpenVoiceSession = (session, events) => {
  const script = SCRIPT[session.voice.targetLanguage];
  const pending = new Set<ReturnType<typeof setTimeout>>();
  let replies = 0;
  let closed = false;

  const say = (line: string) => {
    const timer = setTimeout(() => {
      pending.delete(timer);
      events.onOutputTranscript(line);
      events.onTurnComplete();
    }, REPLY_DELAY_MS);
    pending.add(timer);
  };

  return {
    connect: async () => {
      if (!closed) say(script.greeting);
    },
    sendText: () => {
      if (closed) return;
      say(script.replies[replies++ % script.replies.length]!);
    },
    close: () => {
      closed = true;
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    },
  };
};
