# 10 — Reading aids for Chinese and Japanese

**What to build:** A Chinese learner sees pinyin with tone marks over every NPC line the moment it appears. About a second later the reading is quietly corrected, if the model's segmentation passes the checks. A Japanese learner sees furigana over kanji, and can turn on a romaji line in Settings. Reading aids can be hidden, and the Recap and Journal keep the corrected versions.

**Blocked by:** 06 — Recap, hear-it-said and the Journal, 09 — Help tab

**Spec:** [spec.md](../spec.md): Reading aids; Decisions made before ticketing (10)

**Status:** ready-for-agent

- [ ] Library readings render immediately: `pinyin-pro` for zh, and `kuroshiro` for ja (preloaded during loading, not on the first line), with `wanakana` for romaji.
- [ ] `/api/annotate` also returns `{base, reading}` segments for zh and ja. They replace the library readings only if all four validator rules pass.
- [ ] The validator is pure and table-tested, using the known misreadings (长得, 还钱, 一日中, この方) as fixtures.
- [ ] Rendering uses DOM `<ruby>` built with `textContent` in the chat column. A small "speaking…" indicator is anchored to the NPC.
- [ ] Device settings: reading aids on/off, and Show romaji on/off (off by default). Hiding reading aids hides both.
- [ ] Recap new words show `<ruby>`, and Journal entries store the annotated version.
