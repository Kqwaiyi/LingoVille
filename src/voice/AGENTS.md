# voice

`VoiceSession` (the only code that touches the Live socket), audio worklets and the hear-it-said TTS cache.

**Rules**
- UI and world depend on the `VoiceSession` interface, never on the socket.
- Mock mode uses a scripted fake NPC with the same interface.
- `sim`, `content` and `ai` may not import this module.

**Testing**: through the mock `VoiceSession` and the Playwright smoke in mock mode. No real Gemini calls in tests.

`npx vitest run src/voice` · `npm run test:e2e`
