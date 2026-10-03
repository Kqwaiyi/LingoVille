# sim

Pure TypeScript game rules: state types, `tick`, economy, proficiency, Life Skills, Familiarity, Illness.

**Rules**
- No React, Three, DOM or I/O. Never import `world`, `ui` or `voice` (lint enforces both).
- Functions take state in and return state out. All randomness comes from the seeded RNG in the state.
- Every game number lives in `tuning.ts`. Don't hard-code numbers in rules.
- Other modules import from `index.ts`, not from inner files.

**Testing** (primary seam): Vitest through the public functions, state in → state out. Import numbers from `tuning.ts` rather than copying them, so retuning doesn't break rule tests. Don't test private helpers.

`npx vitest run src/sim`
