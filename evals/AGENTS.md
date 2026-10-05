# evals

The `npm run eval` harness checks real model quality against hard bars and rate bars. It never ships, and app and gateway code may not import it.

`runEval.ts` holds the run: the cost estimate and the question, the model calls, the bars, the baseline check and the report. `index.ts` wires it to the real `fetch`, the terminal and `.env`. Cases live in `cases/<kind>/<lang>.ts` and are Zod-typed by `cases/schema.ts`. Recap cases cover all four Target Languages. Annotate cases cover zh and ja only. Per-call prices are in `cost.ts`: update them when a model in `server/config.ts` changes.

**Rules**
- **Only a human may update the eval baseline (`evals/baseline.json`).** An agent must never create, edit, regenerate or delete it, or lower any bar to make a run pass. The harness only reads it, and a missing baseline skips the regression check. If a run fails, report it. A `--quick` run is checked against the bars only, not the baseline.
- It imports the real `ai` builders, and through them `content`: cases name real interaction ids and NPCs. Each run prints an estimated cost and asks before continuing.
- Reports go to the gitignored `evals/reports/<timestamp>.json`.
- The dev's voice recordings are gitignored; only `recordings/manifest.json` is committed.

**Testing**: `npm run eval` (or `npm run eval -- --quick`) calls real Gemini, so run it only when asked, or before merging changes to `ai` or `server/config.ts`. The harness's own logic is tested in Vitest with a fake `fetch`, and the cases are checked too (gold readings must pass the annotate checks). Those tests never call Gemini.

`npx vitest run evals`
