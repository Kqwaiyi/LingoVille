# e2e

Playwright smoke tests: the top seam, testing what the Player sees.

**Rules**
- Always run against the gateway in mock mode. `playwright.config.ts` starts `npm run dev` with `GEMINI_MOCK=1` on its own ports.
- No automated 3D visual tests. Use roles and visible text, not scene internals.
- Specs take `test` and `expect` from `./test.ts`, which fails a test on any uncaught error in the page (lint enforces it).
- Wait on something the Player sees before each action, never on a fixed sleep or a timed key hold, so a test passes the same way on a fast or busy machine. Walk with `walkUntil` (`walk.ts`): it holds keys until a prompt shows and lets go in that frame. A helper that presses a key to open something waits for it to show before returning. Keep a `waitForTimeout` only where real time is what's measured (the clock, or how far a walk gets where nothing can show the Character stopped), with a comment naming it.

**Testing**: `npm run test:e2e` runs one test at a time. While iterating, run one file: `npx playwright test e2e/<name>.spec.ts`. Tracing is off by default. To debug a failing test, re-run it with a trace (`npx playwright test e2e/<name>.spec.ts -g "<test title>" --trace=on`), then open it with the `npx playwright show-trace …` command the failure prints.
