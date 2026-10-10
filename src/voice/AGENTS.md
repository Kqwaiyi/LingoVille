# voice

`VoiceSession` (the only code that touches the Live socket), audio worklets and the hear-it-said TTS cache.

**Rules**
- UI and world depend on the `VoiceSession` interface, never on the socket.
- `openVoiceSession` mints a fresh token from `/api/token` on every connect, then opens the Live session, or the scripted fake NPC when the gateway is in mock mode. Model, voice and endpoint come from the token response, never from browser code.
- Mock mode uses a scripted fake NPC with the same interface. Typing `MOCK_DROP_LINE` to it drops its connection, so smoke tests can script a network failure.
- The fake NPC waits `replyDelayMs` from the token response before each answer (600 when it's missing), and always answers from a timer, even at 0, never within the call that caused it.
- The browser edges (WebSocket, mic worklet, playback queue, the mic check's mic) live in `browserIo.ts`. Protocol logic stays in `liveSession.ts`, so it can be tested without a browser.
- The NPC's voice and hear-it-said play at the Voice volume under Master (`setVoiceVolume`, which the audio module sets), never ducked.
- Hear-it-said clips come from `/api/tts` and are cached in their own IndexedDB database by a hash of (text, voice), never in saves and never exported.
- `sim`, `content` and `ai` may not import this module.

**Testing**: the mock `VoiceSession` directly; hear-it-said with a fake gateway and an in-memory cache; the Live session through the `VoiceSession` interface, with a fake socket and fake audio standing in for Gemini and the speakers; and the Playwright smoke in mock mode. No real Gemini calls in tests.

`npx vitest run src/voice` · `npm run test:e2e`
