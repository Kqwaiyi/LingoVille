import { describe, expect, it } from 'vitest';
import { checkReadings } from '../../src/ai/index.ts';
import { interactionById, needsReadBack } from '../npcConversation.ts';
import { CASES, RECORDINGS } from './index.ts';

describe('eval cases', () => {
  it('has Recap cases in every Target Language', () => {
    const languages = new Set(CASES.recap.map((c) => c.request.culturePackId));

    expect([...languages].sort()).toEqual(['de', 'en', 'ja', 'zh']);
  });

  it('has 6–10 or more NPC cases in every Target Language, with more for zh and ja', () => {
    const count = (language: string) => CASES.npc.filter((c) => c.targetLanguage === language).length;

    for (const language of ['zh', 'ja', 'en', 'de']) expect(count(language)).toBeGreaterThanOrEqual(6);
    expect(Math.min(count('zh'), count('ja'))).toBeGreaterThan(Math.max(count('en'), count('de')));
  });

  it('has noisy and gibberish turns to rate in every Target Language', () => {
    for (const language of ['zh', 'ja', 'en', 'de']) {
      const tags = new Set(CASES.npc.filter((c) => c.targetLanguage === language).flatMap((c) => c.turns.map((t) => t.tag)));
      expect([...tags].sort()).toEqual(['clean', 'gibberish', 'noisy']);
    }
  });

  it('has unique ids', () => {
    const ids = [...CASES.recap, ...CASES.npc, ...CASES.annotate].map((c) => c.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CASES.annotate.map((c) => [c.id, c] as const))('%s: its gold readings pass the annotate checks', (_, c) => {
    expect(checkReadings(c.targetLanguage, c.line, c.gold)).toEqual({ ok: true });
  });
});

describe('NPC eval cases', () => {
  it.each(CASES.npc.map((c) => [c.id, c] as const))('%s: its recordings are in the manifest, in its language', (_, c) => {
    for (const file of c.turns.flatMap((turn) => (turn.recording ? [turn.recording] : []))) {
      expect(RECORDINGS.recordings.find((r) => r.file === file)).toMatchObject({ language: c.targetLanguage });
    }
  });

  it.each(CASES.npc.map((c) => [c.id, c] as const))('%s: the arguments it expects are ones the completion takes', (_, c) => {
    if (c.expected.outcome !== 'completed') return;
    const { args } = interactionById(c.interactionId).completion;

    expect(args.partial().safeParse(c.expected.args).success).toBe(true);
    expect(Object.keys(c.expected.args).every((key) => key in args.shape)).toBe(true);
  });

  it.each(CASES.npc.map((c) => [c.id, c] as const))('%s: a completion that needs a read-back has a turn confirming it', (_, c) => {
    if (c.expected.outcome !== 'completed' || !needsReadBack(interactionById(c.interactionId))) return;

    expect(c.turns.some((turn) => turn.confirms)).toBe(true);
  });
});
