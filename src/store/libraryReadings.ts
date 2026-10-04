import type { DynamicDictionaries, IpadicFeatures, Tokenizer } from 'kuromoji';
import { libraryKana, libraryPinyin, type ReadingLanguage, type Segment } from '../ai/index.ts';
import type { LanguageCode } from '../sim/index.ts';

/**
 * The library readings an NPC line shows the moment it appears, before the
 * model's arrive: pinyin-pro for zh, kuromoji for ja.
 */
export type LibraryReadings = {
  /** Loads what a language's readings need, so the first line doesn't wait. Only ja has anything to load. */
  preload(language: LanguageCode): Promise<void>;
  /** A line's reading, or null if it can't be read yet (ja before its dictionary has loaded). */
  read(language: ReadingLanguage, line: string): Segment[] | null;
};

/** Where the dev server and the build serve kuromoji's dictionary from (see `vite.config.ts`). */
export const KUROMOJI_DICT_PATH = '/kuromoji-dict/';

/** A gzipped dictionary file, fetched and unzipped. */
async function unzipped(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
  return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

/**
 * The browser's library readings. kuromoji's dictionary is about 17 MB, so it
 * loads only in a Japanese game, as the game starts.
 */
export function createLibraryReadings(dictPath = KUROMOJI_DICT_PATH): LibraryReadings {
  let tokenizer: Tokenizer<IpadicFeatures> | null = null;
  let loading: Promise<void> | null = null;

  const loadKuromoji = async () => {
    const [{ default: DictionaryLoader }, { default: KuromojiTokenizer }] = await Promise.all([
      import('kuromoji/src/loader/DictionaryLoader.js'),
      import('kuromoji/src/Tokenizer.js'),
    ]);
    // kuromoji's own browser loader unzips with zlibjs, which breaks once bundled, so the browser unzips instead.
    class FetchDictionaryLoader extends DictionaryLoader {
      override loadArrayBuffer(url: string, callback: (error: unknown, buffer: ArrayBuffer | null) => void) {
        unzipped(url).then(
          (buffer) => callback(null, buffer),
          (error: unknown) => callback(error, null),
        );
      }
    }
    const dictionaries = await new Promise<DynamicDictionaries>((resolve, reject) =>
      new FetchDictionaryLoader(dictPath).load((error, loaded) => (error ? reject(error) : resolve(loaded))),
    );
    tokenizer = new KuromojiTokenizer(dictionaries);
  };

  return {
    preload: (language) => {
      // The dictionary is fetched from the dev server or the build; outside a browser there is none.
      if (language !== 'ja' || typeof document === 'undefined') return Promise.resolve();
      loading ??= loadKuromoji().catch((error: unknown) => {
        loading = null;
        throw error;
      });
      return loading;
    },
    read: (language, line) => {
      if (language === 'zh') return libraryPinyin(line);
      if (!tokenizer) return null;
      return libraryKana(tokenizer.tokenize(line).map((token) => ({ surface: token.surface_form, reading: token.reading, pos: token.pos })));
    },
  };
}

export const browserLibraryReadings = createLibraryReadings();
