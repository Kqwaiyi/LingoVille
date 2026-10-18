// The parts of kuromoji's internals `libraryReadings.ts` builds its tokenizer from.
// kuromoji's own browser loader unzips with zlibjs, which can't find its global once bundled as ESM.

declare module 'kuromoji/src/loader/DictionaryLoader.js' {
  import type { DynamicDictionaries } from 'kuromoji';

  type Loaded = (error: unknown, buffer: ArrayBuffer | null) => void;

  /** Loads kuromoji's dictionary files, through `loadArrayBuffer`, which is called unbound. */
  export default class DictionaryLoader {
    constructor(dicPath: string);
    loadArrayBuffer(url: string, callback: Loaded): void;
    load(callback: (error: unknown, dictionaries: DynamicDictionaries) => void): void;
  }
}

declare module 'kuromoji/src/Tokenizer.js' {
  import type { DynamicDictionaries, IpadicFeatures, Tokenizer } from 'kuromoji';

  const TokenizerFromDictionaries: new (dictionaries: DynamicDictionaries) => Tokenizer<IpadicFeatures>;
  export default TokenizerFromDictionaries;
}
