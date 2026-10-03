# e2e

Playwright smoke tests: the top seam, testing what the Player sees.

**Rules**
- Always run against the gateway in mock mode. `playwright.config.ts` starts `npm run dev` with `GEMINI_MOCK=1` on its own ports.
- No automated 3D visual tests. Use roles and visible text, not scene internals.

**Testing**: `npm run test:e2e` runs one test at a time (~5 min). While iterating, run one file: `npx playwright test e2e/<name>.spec.ts`.
