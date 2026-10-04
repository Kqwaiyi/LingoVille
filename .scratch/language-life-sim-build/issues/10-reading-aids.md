# 10 — Reading aids for Chinese and Japanese

**What to build:** A Chinese learner sees pinyin with tone marks over every NPC line the moment it appears. About a second later the reading is quietly corrected, if the model's segmentation passes the checks. A Japanese learner sees furigana over kanji, and can turn on a romaji line in Settings. Reading aids can be hidden, and the Recap and Journal keep the corrected versions.

**Blocked by:** 06 — Recap, hear-it-said and the Journal, 09 — Help tab

**Spec:** [spec.md](../spec.md): Reading aids; Decisions made before ticketing (10)

**Status:** done

- [x] Library readings render immediately: `pinyin-pro` for zh, and `kuroshiro` for ja (preloaded during loading, not on the first line), with `wanakana` for romaji.
- [x] `/api/annotate` also returns `{base, reading}` segments for zh and ja. They replace the library readings only if all four validator rules pass.
- [x] The validator is pure and table-tested, using the known misreadings (长得, 还钱, 一日中, この方) as fixtures.
- [x] Rendering uses DOM `<ruby>` built with `textContent` in the chat column. A small "speaking…" indicator is anchored to the NPC.
- [x] Device settings: reading aids on/off, and Show romaji on/off (off by default). Hiding reading aids hides both.
- [x] Recap new words show `<ruby>`, and Journal entries store the annotated version.

## Comments

- **2026-10-04, implementation notes.** The ja library reading uses kuromoji (the tokenizer kuroshiro wraps) directly rather than kuroshiro: kuroshiro's furigana mode returns an HTML string, which the `textContent` rule rules out. A pure aligner in `src/ai/readings.ts` turns kuromoji's tokens into `{base, reading}` segments and places furigana over kanji only. kuromoji's own browser loader breaks once Vite bundles it (zlibjs looks for its global on `this`), so `src/store/libraryReadings.ts` loads the dictionary with `fetch` and `DecompressionStream`. The dictionary is served at `/kuromoji-dict/` by a small plugin in `vite.config.ts`, and `path` is aliased to `path-browserify`.
- The four checks run in the browser (`checkReadings` in the store), so the reading the Player sees is always the one checked. A rejected reading is logged with its rule. Recap new words go through the same checks one word at a time, and the library reading takes the place of one that fails.
- Settings: there's no Settings screen yet (ticket 33), so the title screen's Settings pane now has the two toggles. Journal entries are schema v3: NPC lines keep their reading, and the page shows the conversation under "The conversation".
