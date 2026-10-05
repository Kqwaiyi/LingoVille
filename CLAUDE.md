# CLAUDE.md

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage roles as-is (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Implementation

Implementation is test-first: load the `tdd` skill and work red→green at the seams named in the feature's `spec.md` (under `.scratch/<feature>/`).

## Code layout and commands

Modules live in `src/` (`sim`, `content`, `ai`, `voice`, `world`, `ui`, `i18n`, `store`), the Gemini gateway in `server/`, the eval harness in `evals/` Playwright smoke tests in `e2e/` and repo-wide guardrail tests (lint boundaries) in `tooling/`. **Each folder has an `AGENTS.md` with its rule and how to test it. Read it before editing that folder.** Game numbers live only in `src/sim/tuning.ts`.

- `npm run dev`: Vite plus the gateway. Copy `.env.example` to `.env`, or set `GEMINI_MOCK=1`.
- `npm run typecheck`, `npm run lint`, `npm test` (Vitest), `npm run test:e2e` (Playwright, mock mode).
- **Never run `npm run eval` (or `--quick`) unless the user explicitly asks for it in the chat.** It calls real Gemini and costs money. When a change needs an eval, say so and let the user run it or ask you to.
