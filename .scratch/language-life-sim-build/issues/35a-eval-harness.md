# 35a — Eval harness with annotate and Recap cases

**What to build:** The dev runs `npm run eval` to check real model quality. The harness shows an estimated cost and asks before running. It checks annotate and Recap cases against hard bars and a human-owned baseline, and writes a timestamped report.

**Blocked by:** 14 — Language Proficiency from Recap evidence, and NPCs adapt to the step

**Spec:** [spec.md](../spec.md): AI quality evaluation

**Status:** done

- [x] A top-level `evals` harness that imports the real `ai` builders and `content`, and never ships.
- [x] Zod-typed cases by kind and language: Recap (a canned transcript, Help log and expected step) and annotate (a line and its gold readings).
- [x] Hard bars with zero failures: every Recap matches its schema; Help discounting never lowers the CEFR estimate; `base` segments concatenate to the line exactly.
- [x] Rate bars for CEFR within ±1 step and annotate validation failures. Any rate that drops more than 5 points against the baseline fails the run.
- [x] `--quick` runs a few cases per language. Each run prints an estimated cost and asks before continuing. Reports go to a timestamped JSON file.
- [x] The harness can't update the baseline. Only a human does that, by hand.
