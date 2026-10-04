# ai

Pure prompt builders and schemas: NPC session, Recap, hint, annotate, and the annotate validator.

**Rules**
- Pure functions, no network. Never import `world`, `ui` or `voice` (lint enforces it).
- The gateway imports the request builders and their Zod schemas from here, so the browser sends structured inputs and the gateway builds the prompt.
- The Character's money never goes into a prompt.
- Changes here need an `npm run eval` before merging (see `evals/AGENTS.md`).

**Testing**: Vitest, inputs → prompt text or tool declarations. Snapshot `buildNpcSession` for each language × step, and `buildRecapRequest` for each kind of Recap (Goal Interaction, Small Talk, Shift), `buildHintRequest`, and `buildAnnotateRequest` for each Target Language. Test the annotate validator as a table of passing and failing cases. Tests never call real Gemini; that's an eval.

`npx vitest run src/ai`
