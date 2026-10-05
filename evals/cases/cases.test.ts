import { describe, expect, it } from 'vitest';
import { checkReadings } from '../../src/ai/index.ts';
import { CASES } from './index.ts';

describe('eval cases', () => {
  it('has Recap cases in every Target Language', () => {
    const languages = new Set(CASES.recap.map((c) => c.request.culturePackId));

    expect([...languages].sort()).toEqual(['de', 'en', 'ja', 'zh']);
  });

  it('has unique ids', () => {
    const ids = [...CASES.recap, ...CASES.annotate].map((c) => c.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CASES.annotate.map((c) => [c.id, c] as const))('%s: its gold readings pass the annotate checks', (_, c) => {
    expect(checkReadings(c.targetLanguage, c.line, c.gold)).toEqual({ ok: true });
  });
});
