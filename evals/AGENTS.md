# evals

The `npm run eval` harness (the script arrives with the eval build ticket, 35): checks real model quality against hard bars and rate bars. It never ships, and app and gateway code may not import it.

**Rules**
- **Only a human may update the eval baseline (`evals/baseline.json`).** An agent must never create, edit, regenerate or delete it, or lower any bar to make a run pass. If a run fails, report it.
- It imports the real `ai` builders and `content`. Each run prints an estimated cost and asks before continuing.
- The dev's voice recordings are gitignored; only `recordings/manifest.json` is committed.

**Testing**: the harness is not part of `npm test`. Run it only when asked, or before merging changes to `ai` or `server/config.ts`.
