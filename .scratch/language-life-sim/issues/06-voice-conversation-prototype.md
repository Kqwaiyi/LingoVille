# Voice conversation prototype

Type: prototype
Status: resolved
Blocked by: 03, 02
Map: [Language-learning life sim](../map.md)

## Question

Does a voice conversation with a Gemini-driven NPC *feel* right? Build a throwaway, non-3D page: one café barista NPC, goal "order a drink", in one Target Language, using the approach the Gemini research recommends. React to: latency, turn-taking, whether intent judgement is fair to a beginner, TTS quality, and whether the "goal achieved" signal comes back reliably. Outcome: keep, adjust, or replace the voice approach.

The [Anatomy of an interaction](02-anatomy-of-an-interaction.md) ticket adds things to check:
- Push-to-talk with Space via manual `activityStart`/`activityEnd` (open mic as a toggle), including interrupting the NPC.
- The NPC reads the order back before it calls the completion function (`serve_order(items[])`).
- `not_understood()` fires reliably on turns it can't make sense of, and not on turns it understood.
- Loanwords from the Native Language are understood, but full Native-Language sentences are not.
- A post-conversation `generateContent` call produces the Recap: outcome, up to 3 corrections, new words.

## Answer

Resolved on 2026-10-03 by a playtest (Chinese Target Language, English Native Language, beginner level, push-to-talk, voice Kore) plus further runs covering open mic, the Typed Fallback and running out of Patience. The prototype is on branch `prototype/voice-conversation` (commit e527c0e), under `prototypes/voice-conversation/`.

**Verdict: keep** the single-session `gemini-3.8-live` approach, with the adjustments below. Every item on the checklist passed by the player's judgement: "Everything feels natural, core features are fully working."

**Evidence from the session report:**
- **Latency.** The time from releasing Space to the first NPC audio was 696–2025 ms over 24 turns. The median was about 920 ms, and only one turn went over 1.3 s. That feels natural.
- **Connection.** An ephemeral token from the local server, connecting to the v1beta `BidiGenerateContentConstrained` endpoint, worked on the first attempt. Neither the v1alpha fallback nor the raw-key fallback was needed.
- **Completion function.** `serve_order` fired four times, each time after the NPC read back the items and total and the player confirmed (e.g. "一杯小杯柠檬水，一共十五块，可以吗？" → "可以。"). The arguments matched the read-back every time.
- **Can't afford.** The game checked `serve_order` against the Character's money (¥36 asked, ¥34 held). The NPC explained in Chinese and asked the player to change the order.
- **Corrections.** Correcting the order works ("柠檬茶" → "我们这里没有柠檬茶…柠檬水吗？").
- **Language rules.** A loanword alone was understood ("café" → 咖啡). A non-Target-Language turn ("Amanhã") called `not_understood(other_language)`. The NPC never left Chinese.
- **Recap.** `gemini-3.8-flash` with `responseSchema` returned a useful Recap in about 5.9 s. It gave 3 corrections, including spotting that the transcript "100 咖啡" came from saying *yī bǎi* where *yī bēi* was meant, plus 4 new words with pinyin.

**Decision: clarifying re-asks are free.** On partly garbled turns ("我要玩", "老师, 我要", "Chao Pe"), the NPC asked a clarifying or guess-and-confirm question ("大杯还是小杯？") without calling `not_understood()`. The human chose to keep this. Patience is spent only when the NPC can't make sense of a turn at all (gibberish, a full Native-Language sentence, an empty transcript). Repairing a misunderstanding never costs, which matches "slowness never costs, only failing to get through". As a result `not_understood()` fires rarely (once in 24 turns here), so the starting Patience values can be small.

**Adjustments for the real build:**
- **End on completion.** A Goal Interaction ends after the completion function succeeds and the NPC says goodbye. The prototype let the conversation carry on, so the player ordered four times in one session.
- **Hear-it-said.** Use Gemini TTS (e.g. `gemini-3.8-flash-lite-tts`) for the Recap's play-aloud and for Help, not the browser's `speechSynthesis`. In the prototype, browser TTS played nothing for Chinese, and the browser has no consistent voices across the four languages.
- **Recap delay.** The Recap takes about 6 s. Start the call as soon as the conversation ends and show a loading state (during a Shift, Recaps already queue).
- **Noisy transcripts.** Live input transcription of a learner's Mandarin is noisy: 小杯 came back as "小贝", "Chao Pe" and "tape", and 一杯 as "100". The NPC still understood the intent. The Recap prompt must keep treating PLAYER lines as possibly mis-heard and treat a likely mishearing as a pronunciation point, as it did here. The player's own speech bubble will sometimes show the mishearing.
- **Token route.** The ephemeral-token route is confirmed, so drop the fallbacks. Token-usage reporting needs per-turn accumulation; the prototype only showed the last `usageMetadata`.

## Comments

- 2026-10-03 — Prototype built on branch `prototype/voice-conversation` (commit e527c0e), at `prototypes/voice-conversation/`. To run it: `git checkout prototype/voice-conversation`, add the key to `.env`, run `node prototypes/voice-conversation/server.mjs`, then open http://localhost:5174. Waiting for the human to play it and react.
