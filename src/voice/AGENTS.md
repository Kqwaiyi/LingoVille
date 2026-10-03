# voice

`VoiceSession` (the only code that touches the Live socket), audio worklets and the hear-it-said TTS cache.

**Rules**
- UI and world depend on the `VoiceSession` interface, never on the socket.
- `openVoiceSession` mints a fresh token from `/api/token` on every connect, then opens the Live session, or the scripted fake NPC when the gateway is in mock mode. Model, voice and endpoint come from the token response, never from browser code.
- Mock mode uses a scripted fake NPC with the same interface. Typing `MOCK_DROP_LINE` to it drops its connection, so smoke tests can script a network failure.
- The browser edges (WebSocket, mic worklet, playback queue) live in `browserIo.ts`. Protocol logic stays in `liveSession.ts`, so it can be tested without a browser.
- `sim`, `content` and `ai` may not import this module.

**Testing**: the mock `VoiceSession` directly; the Live session through the `VoiceSession` interface, with a fake socket and fake audio standing in for Gemini and the speakers; and the Playwright smoke in mock mode. No real Gemini calls in tests.

`npx vitest run src/voice` · `npm run test:e2e`
