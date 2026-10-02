# Gemini voice capabilities for Japanese, Chinese, English, German

Type: research
Status: resolved
Map: [Language-learning life sim](../map.md)

## Question

Which Google Gemini APIs and models can carry a full voice conversation — player speech in, NPC reasoning, NPC speech out — in Japanese, Mandarin Chinese, English and German, for a locally-run web app using the dev's own API key? Find, from primary Google docs: whether the Live API / native-audio models do this end-to-end or whether separate STT and TTS are needed; per-language support and voice options; round-trip latency; whether the API can be called from the browser or needs a local backend to hold the key; whether it can return a transcript of the player's speech (needed for the recap) and anything usable as a pronunciation or fluency signal; structured-output / function-calling support for reporting "goal achieved"; and pricing per minute of conversation and free-tier limits.

## Answer

`gemini-3.8-live` (stable) does the whole loop through the Live API WebSocket: player audio in, reasoning, and NPC audio out. Japanese, Chinese, English and German are all among its 99 languages. There is no language-code setting, so the target language has to be set in the system prompt. Voices come from the 30 prebuilt TTS voices.
The Live API can stream text transcripts of both the player and the NPC, which covers the recap and the text bubbles. Function calling works, so a "goal achieved" tool is possible. Structured output does not work in Live and there is no pronunciation score, so use a separate `generateContent` call with `responseSchema` and LLM-judged or heuristic fluency signals.
Google publishes no latency figures. The browser can connect with `?key=`, but Google recommends a small local backend that creates ephemeral tokens. Those tokens work only for the Live API.
Pricing: audio in costs about $0.005/min and audio out about $0.018/min, so roughly $0.012/min of conversation. A free tier exists, but its limits are only shown in AI Studio. Recommendation: `gemini-3.8-live`, a local Node token server, and a post-conversation structured-output check.

Findings: [gemini-voice-capabilities](../research/gemini-voice-capabilities.md)
