# evals

The `npm run eval` harness checks real model quality against hard bars and rate bars. It never ships, and app and gateway code may not import it.

`runEval.ts` holds the run: the cost estimate and the question, the model calls, the bars, the baseline check and the report. `index.ts` wires it to the real `fetch`, Node's WebSocket, the terminal and `.env`. Cases live in `cases/<kind>/<lang>.ts` and are Zod-typed by `cases/schema.ts`. Recap and NPC cases cover all four Target Languages. Annotate cases cover zh and ja only. Per-call prices are in `cost.ts`: update them when a model in `server/config.ts` changes.

NPC cases play a script of tagged player turns (`clean`, `noisy`, `gibberish`) against a real Live session (`npcConversation.ts`), built by the real `buildNpcSession` and opened by the game's own `openLiveSession`. The harness answers tool calls the way the game does: Patience from `sim`, completions through the interaction's own validator. A turn marked `confirms` confirms the NPC's read-back. Script checks are in `npcResult.ts` and `targetLanguage.ts`. The judge (`judge.ts`, `MODELS.evalJudge` in `server/config.ts`) rates step-appropriate speech, whether a completion matched the confirmed read-back, and Recap corrections, with a fixed rubric. About 10% of its verdicts are listed under `spotCheck` in the report for the dev to check by hand.

**Rules**
- **Only a human may update the eval baseline (`evals/baseline.json`).** An agent must never create, edit, regenerate or delete it, or lower any bar to make a run pass. The harness only reads it, and a missing baseline skips the regression check. If a run fails, report it. A `--quick` run is checked against the bars only, not the baseline.
- It imports the real `ai` builders, and through them `content`: cases name real interaction ids and NPCs. Each run prints an estimated cost and asks before continuing.
- Reports go to the gitignored `evals/reports/<timestamp>.json`.
- The dev's voice recordings are gitignored; only `recordings/manifest.json` is committed. A recording is a 16 kHz mono 16-bit WAV in `evals/recordings/`. A case whose recording is missing is skipped.
- **Don't change the judge's rubric (`judge.ts`) to make a run pass.** The baseline's rates were judged with it.

**Testing**: `npm run eval` (or `npm run eval -- --quick`) calls real Gemini and costs money, so an agent runs it only when the user explicitly asks in the chat. Changes to `ai` or `server/config.ts` need a passing run before merging: say so, and let the user run it or ask you to. The harness's own logic is tested in Vitest through `runEval`, with a fake `fetch` and a fake Live socket. The cases are checked too: gold readings must pass the annotate checks, recordings must be in the manifest, and expected completion arguments must be ones the completion takes. Those tests never call Gemini.

`npx vitest run evals`
