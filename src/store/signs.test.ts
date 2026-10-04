import { describe, expect, it } from 'vitest';
import { libraryPinyin, type Segment } from '../ai/index.ts';
import { CULTURE_PACKS, worldSign } from '../content/index.ts';
import { createSave, type LanguageCode } from '../sim/index.ts';
import { createGameStore, DEV_SETUP, selectSignTooltip, type LibraryReadings } from './index.ts';
import { recordingSaves } from './testSaves.ts';

/** pinyin-pro for zh; ja's dictionary hasn't loaded, so it reads nothing yet. */
const library: LibraryReadings = {
  preload: async () => {},
  read: (language, line): Segment[] | null => (language === 'zh' ? libraryPinyin(line) : null),
};

function townIn(packId: LanguageCode, nativeLanguage: LanguageCode = 'en') {
  const game = createSave({ ...DEV_SETUP, targetLanguage: packId, culturePackId: packId });
  const store = createGameStore(game, { saves: recordingSaves().saves, readings: library });
  store.setState({ nativeLanguage });
  return store;
}

const tooltip = (store: ReturnType<typeof townIn>) => selectSignTooltip(store.getState());

describe('pointing at a sign', () => {
  it('shows each line of the menu with its library reading, and no gloss until Translate', () => {
    const store = townIn('zh');
    store.getState().pointAtSign('cafe-menu');

    const lines = worldSign('cafe-menu', 'zh');
    expect(tooltip(store)).toEqual({
      signId: 'cafe-menu',
      translated: false,
      canTranslate: true,
      lines: lines.map(({ text, note }) => ({ text, note, segments: libraryPinyin(text), gloss: null })),
    });
  });

  it('Translate shows each line’s authored gloss in the Native Language', () => {
    const store = townIn('zh', 'de');
    store.getState().pointAtSign('cafe-menu');
    store.getState().translateSign();

    expect(tooltip(store)?.translated).toBe(true);
    expect(tooltip(store)?.lines.map((line) => line.gloss)).toEqual(worldSign('cafe-menu', 'zh').map((line) => line.glosses.de));
  });

  it('shows a line plain while its reading can’t be read yet, and a Latin-script pack has none', () => {
    const ja = townIn('ja');
    ja.getState().pointAtSign('cafe-name');
    expect(tooltip(ja)?.lines[0]).toMatchObject({ text: CULTURE_PACKS.ja.cafe.name, segments: null });

    const de = townIn('de');
    de.getState().pointAtSign('cafe-hours');
    expect(tooltip(de)?.lines[0]).toMatchObject({ text: 'Öffnungszeiten', note: '08:00–18:00', segments: null });
  });

  it('offers no Translate where the Native Language is the sign’s own language', () => {
    const store = townIn('en', 'en');
    store.getState().pointAtSign('cafe-menu');
    store.getState().translateSign();

    expect(tooltip(store)).toMatchObject({ canTranslate: false, translated: false });
  });

  it('hides when the pointer leaves the sign, unless it is over the tooltip itself', () => {
    const store = townIn('zh');
    store.getState().pointAtSign('cafe-menu');
    store.getState().holdSignTooltip(true);
    store.getState().unpointSign('cafe-menu');
    expect(tooltip(store)?.signId).toBe('cafe-menu');

    store.getState().holdSignTooltip(false);
    expect(tooltip(store)).toBeNull();

    store.getState().pointAtSign('cafe-menu');
    store.getState().unpointSign('cafe-menu');
    expect(tooltip(store)).toBeNull();
  });

  it('closes when the Character walks out of range, even with the pointer on the tooltip', () => {
    const store = townIn('zh');
    store.getState().pointAtSign('cafe-menu');
    store.getState().holdSignTooltip(true);
    store.getState().unpointSign('cafe-menu', true);

    expect(tooltip(store)).toBeNull();
  });

  it('a late leave from one sign doesn’t hide the next one', () => {
    const store = townIn('zh');
    store.getState().pointAtSign('cafe-menu');
    store.getState().pointAtSign('cafe-name');
    store.getState().unpointSign('cafe-menu');

    expect(tooltip(store)?.signId).toBe('cafe-name');
  });

  it('starts untranslated on each new sign', () => {
    const store = townIn('zh');
    store.getState().pointAtSign('cafe-menu');
    store.getState().translateSign();
    store.getState().pointAtSign('cafe-hours');

    expect(tooltip(store)?.translated).toBe(false);
  });
});
