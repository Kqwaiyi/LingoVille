# Reading aids for Chinese and Japanese

Researched 2026-10-03 for ticket [05-reading-aids](../issues/05-reading-aids.md).

Question: how should NPC text bubbles show accurate reading aids (pinyin with tone marks for Mandarin; furigana and/or romaji for Japanese) in the browser? Client-side libraries vs. asking Gemini to emit annotated text, with accuracy, bundle size, licensing, and ruby rendering in a 3D-game overlay.

Sources: GitHub repos, npm registry metadata (`npm view`, `npm pack`, queried 2026-10-03), MDN, Google AI for Developers, three.js docs. I also ran a small local test of pinyin-pro 3.29.4 and kuroshiro 1.2.0 + kuroshiro-analyzer-kuromoji 1.1.0 in Node. The test results are below. They are a few sentences, not a benchmark.

## 1. Mandarin: pinyin-pro

| Fact | Value | Source |
|---|---|---|
| Latest version | 3.29.4 (published 2026-09-11), actively released | `npm view pinyin-pro time` |
| License | MIT | https://github.com/zh-lx/pinyin-pro, npm |
| Claimed accuracy | 99.846% vs. 94.097% for `pinyin` and `@napi-rs/pinyin` (the author's own benchmark) | https://github.com/zh-lx/pinyin-pro (README comparison table) |
| Size | Full package about 560 KB minified (about 158 KB gzip). The `html` API pulls in about 307 KB (about 135 KB gzip), and the bare `convert` API is about 1.8 KB | README bundle table |
| Tone output | `toneType: 'symbol'` (hàn, default), `'num'` (han4), `'none'` | README |
| Per-character output | `pinyin(text, { type: 'array' })` | README |
| Ruby helper | `html(text, opts)` returns `<ruby>` markup with `<rp>`/`<rt>`, CSS classes (`py-chinese-item`, `py-pinyin-item`), `rp` toggle, `wrapNonChinese`, `toneSandhi`, `traditional`, `surname` options | `types/core/html/index.d.ts` in the npm tarball |
| Tone sandhi | `toneSandhi` (default on) changes 一/不 to their spoken tones (一起 → yì qǐ, 不要 → bú yào) | Local test |

**Local polyphone test (pinyin-pro 3.29.4, default options):**

- Correct: 银行 yín háng, 班长 bān zhǎng, 音乐/快乐 yīn yuè / kuài lè, 觉得/睡觉 jué / jiào, 重新/很重 chóng / zhòng, 行不行 xíng bù xíng, 不要 bú yào, 一起 yì qǐ.
- Wrong: 他长得很高 → `cháng dé`. The correct reading is `zhǎng de`. 还没还钱 → second 还 `hái`. The correct reading is `huán`. 一个 → `gè`, while speech normally uses the neutral `ge` (debatable).

Conclusion: pinyin-pro is very good on common words. It still misses context-dependent polyphones (得 as a particle, 长 as a verb, 还 meaning "return"). Those words are frequent in beginner dialogue. Custom dictionaries (`customPinyin`) can patch known cases.

## 2. Japanese: kuroshiro + kuromoji, and wanakana

### kuroshiro (furigana and romaji)
- License MIT. The latest stable release is 1.2.0 from 2021-06-07. A `2.0.0-beta.1` was published on 2026-09-26, with `engines: node >=22`. It still depends on `kuromoji ^0.1.2`. Sources: https://github.com/hexenq/kuroshiro, `npm view kuroshiro time`.
- Modes: `normal`, `spaced`, `okurigana` (`漢(かん)字(じ)`), and `furigana`. The `furigana` mode outputs `<ruby>…<rp>(</rp><rt>…</rt><rp>)</rp></ruby>`. Output can be hiragana, katakana, or romaji. Romaji systems are `nippon`, `passport`, and `hepburn` (default). Source: README.
- Documented limitation: converting furigana to romaji cannot recover long vowels (chōon). Converting kanji to romaji does not have this problem. Source: README.
- It needs an analyzer. `kuroshiro-analyzer-kuromoji` (MIT, 1.1.0 stable, 2.0.0-beta.2 from 2026-09-28) wraps kuromoji.js. In the browser you must pass `dictPath` pointing to the served dictionary files.

### kuromoji.js (morphological analyzer)
- License Apache-2.0. The last release is 0.1.2 from 2018-03-19, so it has had no release in about 8 years. Source: https://github.com/takuyaa/kuromoji.js, `npm view kuromoji time`.
- It uses the IPADIC dictionary. Tokens include `surface_form`, `reading` (katakana), and `pronunciation`.
- **Dictionary weight: 12 `.dat.gz` files totalling about 17.8 MB** (base 4.0 MB, tid_pos 5.9 MB, check 3.1 MB, cc 1.7 MB, tid 1.6 MB, tid_map 1.5 MB). I measured this from the `kuromoji@0.1.2` tarball. The browser downloads them through XHR from `dicPath`. That is acceptable for a game running locally, but the files belong in a lazy-loaded asset, not the JS bundle.

**Local furigana test (kuroshiro 1.2.0, `mode: 'furigana'`):**

- Correct: 今日 きょう, 良い よ, 天気 てんき, 明日 あした, 何方 どなた, 上手 じょうず, 生まれた う / 生 なま / 生ビール なま.
- Wrong or doubtful: 一日中 → いち・にち・ちゅう. The correct reading is いちにちじゅう, and romaji gave `ichi nichi chū`. 日本 → にっぽん, where にほん is the usual everyday reading. この方 → ほう, where かた is more likely when talking about a person. (来た → き was correct.)

Conclusion: IPADIC context handling is decent, but it makes mistakes on compounds and suffix readings (中 じゅう) and on politeness and ambiguity cases (方 かた/ほう). The dictionary is old and unmaintained.

### wanakana
- License MIT, version 5.3.1. It converts between kana and romaji and detects scripts. **It does not read kanji.** Source: https://github.com/WaniKani/WanaKana.
- Useful step: once you have a kana reading (from kuromoji or from Gemini), `wanakana.toRomaji()` produces Hepburn romaji cheaply and deterministically.

## 3. Asking Gemini to emit annotated text

- Gemini supports constrained JSON output. Set `generationConfig.responseMimeType: "application/json"` together with `responseSchema` or `responseJsonSchema`. JS SDK: `@google/genai`. Sources: https://ai.google.dev/gemini-api/docs/structured-output, https://ai.google.dev/api/generate-content.
- The docs say the output is guaranteed to be syntactically valid JSON matching the schema. They also say to "always validate values in your application", because schema-compliant output can still be semantically wrong. A schema guarantees shape, not reading accuracy.
- Approach: the same Gemini call that writes the NPC line also returns segments. An example schema: `{ text: string, segments: [{ base: string, reading?: string }] }`, with `reading` in pinyin with tone marks or in hiragana. The model knows the sentence's intended meaning, so it can resolve the cases the libraries got wrong (长得 zhǎng de, 还钱 huán qián, 一日中 いちにちじゅう, この方 かた). This is an inference, not a published benchmark. I found no primary-source accuracy figure for Gemini on pinyin or furigana.
- Costs: more output tokens and latency for each line. LLM readings can be hallucinated, and segment `base` strings can drift from `text`. Validate that the joined `base` values equal `text`, and fall back to the library when they don't.

## 4. Rendering ruby in a 3D-game overlay

- HTML `<ruby>` / `<rt>` / `<rp>` is Baseline "widely available" (since July 2015). CSS `ruby-position` places annotations over or under the base text. Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/ruby.
- WebGL/canvas text has no ruby layout. Render bubbles as DOM, not textures. In three.js, `CSS2DRenderer` + `CSS2DObject` position real DOM elements over 3D objects. Limitations: elements always draw on top (no depth test), and DOM rendering is slower for many elements. That is fine for a handful of speech bubbles. Source: https://threejs.org/docs/#examples/en/renderers/CSS2DRenderer.
- Build the markup with `document.createElement` and `textContent`, not `innerHTML` with LLM text, to avoid injection. If you use the libraries' `html()` / furigana strings, sanitize or escape them first.
- Romaji usually reads better as a separate line under the bubble than as per-kanji ruby. You can add pinyin on a second `<rt>` line by setting `ruby-position: under` on an `rtc`, but browser support for double-sided ruby varies. A plain second line is simpler.
- A per-NPC or global toggle (show/hide `rt` with `rt { visibility: hidden }`) lets learners wean off the aids.

## 5. Comparison

| | pinyin-pro | kuroshiro + kuromoji | wanakana | Gemini annotated JSON |
|---|---|---|---|---|
| Polyphone / kanji accuracy | High; misses some context cases | Moderate–high; errors on compounds and ambiguity | N/A (kana only) | Likely highest (knows intent); unbenchmarked, can hallucinate |
| Size | about 135–158 KB gzip | JS small; **about 17.8 MB dictionary** | Small | 0 KB; more tokens and latency |
| License | MIT | MIT + Apache-2.0 | MIT | Google API terms |
| Maintenance | Active (2026-09) | kuroshiro 2.0 beta (2026-09); kuromoji stale since 2018 | Last release 2023 | Active |
| Offline / deterministic | Yes | Yes | Yes | No |

## Recommendation

Use a **hybrid**. Make Gemini's structured output the primary source of readings, and use deterministic libraries as the fallback and validator:

1. Extend the NPC-dialogue `responseJsonSchema` with `segments: [{ base, reading }]`: pinyin with tone marks for zh, hiragana for ja. Gemini knows what the sentence means, so it fixes the context polyphones the libraries got wrong in testing.
2. **Mandarin:** bundle **pinyin-pro** (MIT, about 150 KB gzip, actively maintained). Use it as the fallback when segments fail validation (joined `base` ≠ `text`, or a reading isn't valid pinyin), and optionally to flag disagreements.
3. **Japanese:** use **wanakana** to turn the kana reading into Hepburn romaji. Add kuroshiro + kuromoji only as a lazy-loaded fallback if Gemini segments prove unreliable, because the dictionary is about 18 MB and kuromoji is unmaintained. If you do use it, pin kuroshiro 1.2.0 until 2.0 leaves beta.
4. **Render** bubbles as DOM `<ruby>` elements through three.js `CSS2DRenderer`, built with `textContent` (no `innerHTML` of model output), with a toggle to hide `rt`. Show romaji as an optional second line rather than as ruby.
