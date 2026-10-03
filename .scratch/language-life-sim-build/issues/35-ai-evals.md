# 35 — AI quality evals

**What to build:** The dev runs `npm run eval` to check real model quality before merging changes to the `ai` module or the gateway config. The harness shows an estimated cost and asks before running. It checks hard bars and rate bars against a human-owned baseline, and writes a timestamped report.

**Blocked by:** 06 — Recap, hear-it-said and the Journal, 10 — Reading aids for Chinese and Japanese, 14 — The town adapts to my level

**Spec:** [spec.md](../spec.md): AI quality evaluation

**Status:** ready-for-agent

- [ ] A top-level `evals` harness that imports the real `ai` builders and `content`, and never ships.
- [ ] Zod-typed cases, by kind and language:
  - NPC: interaction id, step, a script of player turns tagged `clean`/`noisy`/`gibberish`, and the expected outcome;
  - Recap: a canned transcript, Help log and expected step;
  - annotate: a line and its gold readings.
- [ ] Start with 6–10 NPC cases per language, more for zh and ja.
- [ ] Inputs are mostly `sendText` turns, using real garbled transcripts from the prototype. Gitignored recordings of the dev are listed in a committed manifest, and missing audio is skipped.
- [ ] Hard bars must have zero failures:
  - no NPC line outside the Target Language (loanwords are fine);
  - no completion before a read-back and confirmation;
  - completion arguments always match the read-back;
  - Help discounting never lowers the CEFR estimate;
  - every Recap matches its schema;
  - `base` segments concatenate to the line exactly.
- [ ] Rate bars, as listed in the spec. Any rate that drops more than 5 points against the baseline fails the run.
- [ ] The judge is `gemini-3.8-pro` with a fixed rubric.
- [ ] `--quick` runs a few cases per language. Each run prints an estimated cost and asks before continuing. Reports go to a timestamped JSON file.
- [ ] The harness can't update the baseline. Only a human does that, by hand.
