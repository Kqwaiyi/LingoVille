# 05 — Speak to NPCs with a real voice

**What to build:** With the gateway running against real Gemini, the Player holds Space to talk to the barista, hears the reply about a second later, and sees their own words as "Heard as: …". Holding Space while the NPC talks interrupts it. If the connection drops, the game retries once. If that fails too, the conversation ends with "NPC had to step away" at no cost. If no token can be minted, a "Voice service unavailable: check the local server" screen appears.

**Blocked by:** 04 — Order a drink and pay

**Spec:** [spec.md](../spec.md): Voice pipeline and Gemini gateway

**Status:** ready-for-human (only the manual check against real Gemini is left)

- [x] `POST /api/token` mints a one-use ephemeral token (v1beta `auth_tokens`) and returns it with the Live model ID from the gateway config.
- [x] The real `VoiceSession` is ported from the voice prototype (branch `prototype/voice-conversation`), and it is the only code that touches the socket:
  - Audio: an AudioWorklet captures 16 kHz PCM, and 24 kHz PCM plays through scheduled AudioBufferSources.
  - Transcription is on both ways. Push-to-talk uses `activityStart`/`activityEnd` with automatic detection off. `sendText` serves the Typed Fallback.
  - It emits events for transcripts, tool calls, mic level and usage.
- [x] Space is push-to-talk (except while the typed field has focus). The mic button turns red with a live dot while listening. Interrupting stops NPC playback.
- [x] On a connection failure, the game retries once with a fresh token, seeding the transcript so far. A second failure is a network abandonment: no Patience or Mood loss, no Recap, and a toast.
- [x] Token usage is accumulated per turn for each conversation.
- [x] Playwright (mock mode): a scripted network drop produces the abandonment toast and no state change.
- [ ] Manual check against real Gemini: order a drink by voice in at least one language.
