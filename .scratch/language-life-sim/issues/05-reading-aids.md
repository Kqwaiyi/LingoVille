# Reading aids for Chinese and Japanese

Type: research
Status: resolved
Map: [Language-learning life sim](../map.md)

## Question

How can NPC text bubbles show accurate reading aids — pinyin with tone marks for Chinese, furigana and/or romaji for Japanese — in the browser? Compare client-side libraries (e.g. pinyin-pro, kuroshiro + kuromoji, wanakana) against asking Gemini to emit annotated text: accuracy on polyphonic characters / kanji readings, bundle size, licensing, and how to render ruby text (HTML `<ruby>`) in a 3D-game UI overlay.

## Answer

Use a hybrid. Gemini's structured JSON output (`responseJsonSchema`) returns `segments: [{base, reading}]` alongside each NPC line. The model knows what the sentence means, so it can resolve the context polyphones that libraries miss: in local tests pinyin-pro got 长得 and 还钱 wrong, and kuroshiro got 一日中 and この方 wrong. Gemini guarantees valid JSON, not correct readings, so check every reply.
Mandarin: bundle pinyin-pro (MIT, about 150 KB gzip, active) as the fallback when Gemini's segments fail that check.
Japanese: use wanakana (MIT) to turn kana into romaji. kuroshiro + kuromoji (MIT/Apache) would be only a lazy-loaded fallback, because its dictionary is about 18 MB and kuromoji has not been released since 2018.
Render bubbles as DOM `<ruby>` (Baseline since 2015) through three.js CSS2DRenderer, built with `textContent`, with a toggle to hide the readings. Show romaji as a separate line.

Findings: [reading-aids](../research/reading-aids.md)
