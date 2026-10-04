import { describe, expect, it } from 'vitest';
import { CULTURE_PACKS } from '../content/index.ts';
import { AnnotateRequestSchema, AnnotationSchema, buildAnnotateRequest, type AnnotateRequest } from './index.ts';

const LINES: AnnotateRequest[] = [
  { targetLanguage: 'ja', nativeLanguage: 'en', line: 'ホットラテですね。450円です。よろしいですか？' },
  { targetLanguage: 'zh', nativeLanguage: 'de', line: '一杯热拿铁，二十八块。对吗？' },
  { targetLanguage: 'en', nativeLanguage: 'ja', line: "One hot latte, that's £3.40. Is that right?" },
  { targetLanguage: 'de', nativeLanguage: 'zh', line: 'Einmal Latte macchiato für 3,40 €, richtig?' },
];

describe('buildAnnotateRequest', () => {
  it.each(LINES)('asks for a $nativeLanguage translation of a $targetLanguage NPC line', (request) => {
    expect(buildAnnotateRequest(request)).toMatchSnapshot();
  });

  it('puts the line itself in the contents, and names both languages', () => {
    const body = buildAnnotateRequest(LINES[0]!);

    expect(body.contents[0]!.parts[0]!.text).toBe(LINES[0]!.line);
    expect(body.systemInstruction.parts[0]!.text).toContain(CULTURE_PACKS.ja.languageName);
    expect(body.systemInstruction.parts[0]!.text).toContain(CULTURE_PACKS.en.languageName);
  });

  it('answers with a translation', () => {
    expect(buildAnnotateRequest(LINES[1]!).generationConfig.responseSchema.required).toEqual(['translation']);
    expect(AnnotationSchema.safeParse({ translation: 'One hot latte.' }).success).toBe(true);
    expect(AnnotationSchema.safeParse({}).success).toBe(false);
  });

  it('accepts only a line in a language it knows', () => {
    expect(AnnotateRequestSchema.safeParse(LINES[2]).success).toBe(true);
    expect(AnnotateRequestSchema.safeParse({ ...LINES[2], line: ' ' }).success).toBe(false);
    expect(AnnotateRequestSchema.safeParse({ ...LINES[2], targetLanguage: 'fr' }).success).toBe(false);
  });
});
