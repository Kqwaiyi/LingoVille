# 01 — Project skeleton and guardrails

**What to build:** A dev runs `npm install` and one `npm run dev`. Vite serves an empty game page, and the local Gemini gateway runs beside it and answers a health check through the `/api` proxy. The module layout, import boundaries, test runners and agent conventions all exist before any feature lands, so every later slice has a place to go.

**Blocked by:** None — can start immediately

**Spec:** [spec.md](../spec.md): Architecture and modules; Testing Decisions

**Status:** ready-for-agent

- [ ] One `npm run dev` starts Vite and the gateway, and the page shows that the gateway is reachable.
- [ ] The gateway reads the Gemini key only from a gitignored `.env`, with a committed example file. The key never reaches the browser bundle.
- [ ] `GEMINI_MOCK=1` switches the gateway to mock mode. Model IDs, voices and endpoint versions live in one gateway config.
- [ ] Strict TypeScript. Folders exist for `sim`, `content`, `ai`, `voice`, `world`, `ui`, `i18n`, `store` and `server`, plus a top-level `evals`. Three.js is pinned at r186.
- [ ] ESLint `import/no-restricted-paths` fails the lint when `sim`, `content` or `ai` imports `world`, `ui` or `voice`. A deliberate violation proves it.
- [ ] Vitest runs one trivial `sim` test. Playwright runs one smoke test against the page with the gateway in mock mode.
- [ ] One tuning module exists for game numbers (open questions 4 and 5 start here as defaults). Tests import values from it rather than copying them.
- [ ] Each folder has a short `AGENTS.md` with its rule and how to test it. `evals/AGENTS.md` says only a human may update the eval baseline.
