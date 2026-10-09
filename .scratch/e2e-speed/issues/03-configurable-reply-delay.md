# 03: Configurable fake NPC reply delay

**What to build:** The scripted fake NPC answers quickly in the smoke suite but keeps its realistic 600ms in mock-mode `npm run dev`.
- In mock mode the gateway reads a reply delay from a new env var, such as `GEMINI_MOCK_REPLY_MS`, and hands it to the browser in the token response.
- The voice module's session opener passes the delay to the mock VoiceSession, which waits that long instead of its hard-coded 600ms.
- The smoke config sets a short delay of about 50ms.

The details:
- An unset env var means 600.
- A value that isn't a non-negative integer stops the gateway at startup with a message naming the variable.
- Real-mode token responses don't change.
- The mock VoiceSession always answers asynchronously, even at 0.

See the spec's Solution step 3 and Implementation Decisions ("Reply delay contract", "Reply delay in the browser", "Smoke config").

**Blocked by:** 01 (Steady smoke tests)

**Status:** ready-for-agent

- [ ] Gateway (Vitest, via `createGateway`): the mock-mode token response carries the configured delay, and 600 when the env var is unset
- [ ] Gateway (Vitest): a malformed delay value is rejected at startup with a message naming the variable
- [ ] Gateway (Vitest): the real-mode token response carries no reply delay
- [ ] Mock VoiceSession (Vitest, fake timers): a reply arrives after the delay it was given and not before, and after 600ms when none is given
- [ ] Mock VoiceSession (Vitest): with a delay of 0, events still arrive asynchronously, not within the call that caused them
- [ ] The smoke config's web server env sets the short delay alongside `GEMINI_MOCK=1`
- [ ] `.env.example` lists the new variable, and the server and voice `AGENTS.md` files say the delay comes from the token response
- [ ] `npm test`, `npm run lint`, `npm run typecheck` and `npm run test:e2e` pass
- [ ] The full-suite wall-clock time, before and after, is recorded under `## Comments` on the spec
