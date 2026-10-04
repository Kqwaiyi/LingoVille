import { describe, expect, it } from 'vitest';
import { LANGUAGE_CODES, PLACE_IDS } from '../sim/index.ts';
import { PLACE_PHRASEBOOKS, placePhrasebook, placePhrasebookSchema } from './index.ts';

const PHRASE = { text: 'メニューをください。', reading: 'めにゅーをください。', glosses: { zh: '请给我菜单。', en: 'The menu, please.', de: 'Die Karte, bitte.' } };

describe('place phrasebooks', () => {
  it.each(LANGUAGE_CODES)('every phrasebook authored in the %s pack passes its schema', (packId) => {
    for (const [placeId, phrases] of Object.entries(PLACE_PHRASEBOOKS[packId])) {
      const result = placePhrasebookSchema(packId).safeParse(phrases);
      expect(result.success, `${packId} ${placeId}: ${result.error?.message}`).toBe(true);
      expect(PLACE_IDS).toContain(placeId);
    }
  });

  it.each(LANGUAGE_CODES)('has the café phrasebook authored for the %s pack', (packId) => {
    expect(placePhrasebook(packId, 'cafe').length).toBeGreaterThan(0);
  });

  it('has nothing for a place with no phrasebook yet', () => {
    expect(placePhrasebook('ja', 'home')).toEqual([]);
  });

  it.each([
    ['a missing gloss in another Native Language', { ...PHRASE, glosses: { zh: '请给我菜单。', en: 'The menu, please.' } }],
    ['an empty gloss', { ...PHRASE, glosses: { ...PHRASE.glosses, de: '' } }],
    ['an empty phrase', { ...PHRASE, text: '' }],
    ['no reading for a Japanese phrase', { ...PHRASE, reading: '' }],
  ])('rejects a phrase with %s', (_, phrase) => {
    expect(placePhrasebookSchema('ja').safeParse([phrase]).success).toBe(false);
  });

  it('rejects the same phrase twice in one place', () => {
    expect(placePhrasebookSchema('ja').safeParse([PHRASE, PHRASE]).success).toBe(false);
  });

  it('needs no reading where the Target Language has no reading aid', () => {
    const phrase = { text: 'The menu, please.', reading: '', glosses: { ja: 'メニューをください。', zh: '请给我菜单。', de: 'Die Karte, bitte.' } };
    expect(placePhrasebookSchema('en').safeParse([phrase]).success).toBe(true);
  });
});
