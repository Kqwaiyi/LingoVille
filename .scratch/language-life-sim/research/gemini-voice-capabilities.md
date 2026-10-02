# Gemini voice capabilities for Japanese, Chinese, English, German

Researched 2026-10-03 against ai.google.dev (Gemini API docs, model cards, pricing). Ticket: [03-gemini-voice-capabilities](../issues/03-gemini-voice-capabilities.md).

## Model IDs found (current as of 2026-10-03)

Source: [Models](https://ai.google.dev/gemini-api/docs/models), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)

| Role | Model ID | Status |
|---|---|---|
| Live speech-to-speech (default) | `gemini-3.8-live` | Stable. Google calls it the "default Live API model for most low-latency voice agent experiences" |
| Live speech-to-speech, more reasoning | `gemini-3.8-live-extended-thinking` | Stable. Thinking level `low`/`medium`/`high` |
| Older Live models | `gemini-3.1-flash-live-preview`, `gemini-2.5-flash-native-audio-preview-12-2025` | Preview/legacy. Google says to move to 3.8 Live |
| Standalone TTS | `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts` | Stable (older `gemini-3.1-flash-tts-preview`, `gemini-2.5-*-preview-tts` are legacy) |
| Standalone STT | `gemini-3.5-transcribe`, `gemini-3.5-transcribe-live` | Stable |
| Speech translation | `gemini-3.5-live-translate-preview` | Preview. Not needed here |

## 1. End-to-end voice, or separate STT and TTS?

**End-to-end works.** The Live API takes a bidirectional WebSocket stream of microphone audio in and returns spoken audio out. Reasoning happens in the same model, and the system prompt sets the NPC persona and goal. The audio formats are:

- Input: raw 16-bit PCM, 16 kHz, little-endian.
- Output: raw 16-bit PCM, 24 kHz, little-endian.

Sources: [Live API overview](https://ai.google.dev/gemini-api/docs/live), [Gemini 3.8 Live model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live).

Voice activity detection (VAD) is automatic by default. It can be turned off so the client sends `activityStart`/`activityEnd` itself, which fits a push-to-talk key ([Live capabilities guide](https://ai.google.dev/gemini-api/docs/live-guide)).

Constraint: native-audio Live models "only support AUDIO response modality." To get the NPC's text for the speech bubble, turn on `output_audio_transcription` ([Live guide](https://ai.google.dev/gemini-api/docs/live-guide)). One session cannot return text and audio as two separate modalities.

A **cascaded alternative** also works if more control is needed:

1. `gemini-3.5-transcribe(-live)` for speech-to-text.
2. A text Gemini model for the NPC's reply, with structured output.
3. `gemini-3.8-flash(-lite)-tts` for speech.

This adds round trips, and therefore latency.

## 2. Language support and voices

- **Live API:** the docs list 99 languages, including English `en`, German `de`, Japanese `ja`, Chinese Simplified `zh-Hans` and Chinese Traditional `zh-Hant`. "Native audio output models automatically choose the appropriate language and don't support explicitly setting the language code" ([Live guide](https://ai.google.dev/gemini-api/docs/live-guide)). So the target language has to be enforced through the system prompt. The model may drift into English if the learner speaks English, so the prompt must handle that.
- **Voices:** "Native audio output models support any of the voices available for our Text-to-Speech (TTS) models." A voice is chosen with `speech_config.voice_config.prebuilt_voice_config.voice_name` ([Live guide](https://ai.google.dev/gemini-api/docs/live-guide)). The TTS docs list 30 prebuilt voices (Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, and others). The voices are not language-specific, and the language is detected from the text. Gemini 3.8 Flash TTS covers 130+ languages and Flash-Lite TTS covers 100+. Both include Japanese, Mandarin, English and German. Style can be steered with `speech_metadata`/inline tags, and multi-speaker output allows up to 2 speakers ([Speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)). The docs do not say whether every voice sounds equally native in every language. Check by ear in AI Studio.
- **Transcribe:** `gemini-3.5-transcribe` lists 85+ locales, including `ja-JP`, `cmn-Hans-CN`, `en-US`/`en-GB` and `de-DE`, with automatic language ID and code-switching ([Transcribe](https://ai.google.dev/gemini-api/docs/transcribe)). Code-switching matters because learners mix in their native language.

## 3. Round-trip latency

Google publishes **no millisecond figures**. The 3.8 Live model card says only "ultra-low latency audio-to-audio interactions" and "real-time dialogue without reasoning-induced delays" ([model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live)). Google steers latency-sensitive use toward `gemini-3.8-live` and away from the extended-thinking variant ([Models](https://ai.google.dev/gemini-api/docs/models)).

The cascaded STT → LLM → TTS path will be slower than the single Live session, because it takes three sequential requests. Latency has to be measured in a prototype.

## 4. Browser-direct, or a local backend for the key?

- The Live WebSocket accepts the API key as a query parameter: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=API_KEY`. The JavaScript examples connect straight from the browser ([WebSocket get-started](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket)). Technically, no backend is required.
- Google's recommendation for client apps is **ephemeral tokens**. A backend calls `/v1beta/auth_tokens` with the real key and passes the short-lived token to the browser. The browser then connects to `...BidiGenerateContentConstrained?access_token=...` ([Ephemeral tokens](https://ai.google.dev/gemini-api/docs/ephemeral-tokens)). Token defaults:
  - `expire_time`: 30 min.
  - `new_session_expire_time`: 1 min.
  - `uses`: 1 session.
- Ephemeral tokens are "only compatible with Live API at this time." Transcribe, TTS and text calls made from the browser would need the raw key, or a backend proxy.
- For a local-only app with the developer's own key, putting the key in the browser is an acceptable risk if it is never committed or served publicly. A tiny local backend (a Vite dev-server middleware or a small Node server) that holds the key in `.env` and mints ephemeral tokens is cleaner and costs little.

## 5. Player transcript (recap) and pronunciation/fluency signal

- **Transcript:** yes. `input_audio_transcription` returns text of the player's speech, and `output_audio_transcription` returns text of the NPC's speech, both streamed during the session ([Live guide](https://ai.google.dev/gemini-api/docs/live-guide)). That covers the recap and the NPC text bubble.
- **Pronunciation/fluency:** no dedicated feature exists. The docs show no confidence scores in Live transcription and no pronunciation-assessment feature in Transcribe ([Live guide](https://ai.google.dev/gemini-api/docs/live-guide), [Transcribe](https://ai.google.dev/gemini-api/docs/transcribe)). Usable proxies:
  - Whether the transcript matches the intended words. A mis-transcription suggests unclear pronunciation.
  - Word-level timestamps from `gemini-3.5-transcribe` (pauses, speech rate). These are offered for file audio, and Google notes they "degrade transcription accuracy."
  - Detected-language ID, to catch the player falling back to their native language.
  - An LLM judgement: send the recorded clip to a Gemini model after the conversation and ask for feedback. This is not a calibrated score.

## 6. Reporting "goal achieved": function calling and structured output

- **Function calling: supported** in the Live API. A tool such as `report_goal_achieved({goal_id, evidence})` can be declared, and the model calls it mid-conversation. Responses are **not** handled automatically: "You must handle tool responses manually in your client code" ([Live tools](https://ai.google.dev/gemini-api/docs/live-tools)).
- The docs disagree on sync versus async calls. The 3.8 Live model card says function calling is "asynchronous by default." The fetched tools-guide summary said 3.8 Live is synchronous only. The tools-guide markdown shows `NON_BLOCKING` behaviour with `scheduling` set to `INTERRUPT`, `WHEN_IDLE` or `SILENT` ([model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live), [Live tools](https://ai.google.dev/gemini-api/docs/live-tools)). Either works for a goal-report call.
- **Structured output (response schema): not supported** in Live. The model card marks "Structured outputs" as unsupported. If a strict JSON verdict is needed, run a separate `generateContent` call with `responseSchema` on the transcript at the end of the conversation (or periodically).
- Google Search grounding is also available. Code execution, URL context and Maps are not.

## 7. Session limits

Source: [Session management](https://ai.google.dev/gemini-api/docs/live-session), [Live guide](https://ai.google.dev/gemini-api/docs/live-guide)

- Audio-only sessions last at most 15 min without context compression.
- A WebSocket connection lasts about 10 min. The server sends a `GoAway` message first, and **session resumption** handles stay valid for 2 h.
- Context window: 128k tokens for native-audio models (the 3.8 Live card lists 131,072 input and 65,536 output tokens).
- NPC conversations are short (minutes), so these limits rarely matter. Open one session per conversation.

## 8. Pricing and free tier

Source: [Pricing](https://ai.google.dev/gemini-api/docs/pricing). Audio is counted at 25 tokens per second.

| Model | Audio in | Audio out | Text in / out | Free tier |
|---|---|---|---|---|
| `gemini-3.8-live` (and `-extended-thinking`, `3.1-flash-live-preview`) | $3.00/1M ≈ **$0.005/min** | $12.00/1M ≈ **$0.018/min** | $0.75 / $4.50 per 1M | Yes |
| `gemini-2.5-flash-native-audio-preview-12-2025` | $3.00/1M | $12.00/1M | $0.50 / $2.00 | Yes |
| `gemini-3.5-transcribe` | $0.003/min | n/a | text out $0.002/min | Yes |
| `gemini-3.5-transcribe-live` | $0.005/min | n/a | text out $0.004/min | Yes |
| `gemini-3.8-flash-tts` | n/a | $9/1M (→ $18/1M from 2027-01-01) | text in $0.50/1M (→ $1.00) | Yes (Standard) |
| `gemini-3.8-flash-lite-tts` | n/a | $6/1M (→ $12/1M from 2027-01-01) | text in $0.50/1M (→ $1.00) | Yes (Standard) |

Rough estimate for one minute of Live conversation, with about half player speech and half NPC speech: 0.5 × $0.005 + 0.5 × $0.018 ≈ **$0.012/min**, plus small text and system-prompt costs. Billed context may grow over a longer session. Measure it with usage metadata.

**Free-tier limits:** the [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) page does not publish per-model RPM/TPM/RPD or concurrent-session numbers for Live, TTS or Transcribe. It says limits "can be viewed in Google AI Studio" ([AI Studio rate-limit dashboard](https://aistudio.google.com/rate-limit)). The free tier is offered for all the models above except `gemini-2.5-pro-preview-tts`. On the free tier, Google may use the data to improve products, which is the usual Gemini API free-tier term. Check the exact numbers in AI Studio for your own key.

## Open questions / not verified

- Actual round-trip latency for ja/zh/en/de. A prototype must measure it.
- Whether Live input transcription is accurate for learner-accented, partly wrong speech in Japanese and Mandarin.
- Exact free-tier session and RPD caps (they are only shown in AI Studio).
- Whether the native-audio model reliably stays in the target language when the learner switches to English. This has to be enforced in the system prompt and tested.

## Recommendation

Use **`gemini-3.8-live`** through the Live API as the single end-to-end voice pipeline:

- Mic PCM 16 kHz in, NPC audio 24 kHz out.
- System prompt for the NPC persona and the target-language constraint.
- A prebuilt voice per NPC.
- `input_audio_transcription` and `output_audio_transcription` on, for the recap and the text bubbles.
- A `report_goal_achieved` function tool for goal detection.

Run a tiny **local Node backend**. It holds the key in `.env` and mints **ephemeral tokens**, so the browser connects straight to the Live WebSocket with a short-lived token and the key stays out of the browser. That backend can also proxy the non-Live calls:

- A post-conversation `generateContent` call with `responseSchema` for a strict goal verdict and feedback.
- Optionally `gemini-3.5-transcribe`, for word timestamps as a fluency proxy.

Treat pronunciation feedback as LLM-judged and heuristic: Gemini has no scoring API for it. Expect about $0.01–0.02 per conversation minute on the paid tier, and check free-tier caps in AI Studio. Keep the cascaded path (Transcribe → text model → `gemini-3.8-flash-lite-tts`) as a fallback only if the Live model's language control or transcript quality falls short in the prototype.
