# 35b — NPC eval cases and the judge

**What to build:** The eval harness also plays scripted conversations against real NPC sessions and checks them against the NPC hard bars and rate bars. A judge model rates corrections and step-appropriate speech.

**Blocked by:** 35a — Eval harness with annotate and Recap cases, 14 — Language Proficiency from Recap evidence, and NPCs adapt to the step

**Spec:** [spec.md](../spec.md): AI quality evaluation

**Status:** ready-for-agent

- [ ] NPC cases: interaction id, step, a script of player turns tagged `clean`/`noisy`/`gibberish`, and the expected outcome. Start with 6–10 per language, more for zh and ja.
- [ ] Inputs are mostly `sendText` turns, using real garbled transcripts from the prototype. Gitignored recordings of the dev are listed in a committed manifest, and missing audio is skipped.
- [ ] Hard bars with zero failures: no NPC line outside the Target Language (loanwords are fine); no completion before a read-back and confirmation; completion arguments always match the read-back.
- [ ] Rate bars: `noisy` turns understood or repaired without Patience loss ≥ 90%; `gibberish` accepted ≤ 10%; corrections judged correct ≥ 90%; step-appropriate speech ≥ 85%.
- [ ] The judge is `gemini-3.8-pro` with a fixed rubric.
