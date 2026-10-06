# 35b — NPC eval cases and the judge

**What to build:** The eval harness also plays scripted conversations against real NPC sessions and checks them against the NPC hard bars and rate bars. A judge model rates corrections and step-appropriate speech.

**Blocked by:** 35a — Eval harness with annotate and Recap cases, 14 — Language Proficiency from Recap evidence, and NPCs adapt to the step

**Spec:** [spec.md](../spec.md): AI quality evaluation

**Status:** done

- [x] NPC cases: interaction id, step, a script of player turns tagged `clean`/`noisy`/`gibberish`, and the expected outcome. Start with 6–10 per language, more for zh and ja.
- [x] Inputs are mostly `sendText` turns, using real garbled transcripts from the prototype. Gitignored recordings of the dev are listed in a committed manifest, and missing audio is skipped.
- [x] Hard bars with zero failures: no NPC line outside the Target Language (loanwords are fine); no completion before a read-back and confirmation; completion arguments always match the read-back.
- [x] Rate bars: `noisy` turns understood or repaired without Patience loss ≥ 90%; `gibberish` accepted ≤ 10%; corrections judged correct ≥ 90%; step-appropriate speech ≥ 85%.
- [x] The judge is `gemini-3.8-pro` with a fixed rubric.

## Comments

**Decisions made while building (2026-10-06):**
- The Target Language bar is deterministic (`evals/targetLanguage.ts`): script checks for zh and ja (a run of three or more Latin words fails, single loanwords pass; kana in a zh line fails; a long kanji-only ja line reads as Chinese), and common-word counts between en and de.
- "No completion before a read-back and confirmation" fails on either check: the script's (no turn marked `confirms` sent yet) or the judge's (no read-back the player agreed to). "Arguments match the read-back" is the judge's. Goals with effect `none` (the nurse) need no read-back.
- `noisy` and `gibberish` rates are deterministic: a turn "cost Patience" if the NPC called `not_understood` before the next turn.
- A whole sentence in another language is tagged `gibberish`, since it must cost Patience.
- Expected outcomes are checked as `npcOutcomeMatches`, a rate with no bar, so it is tracked against the baseline.
- Only the zh noisy turns are the prototype's real transcripts (一百, 100 咖啡, 我要玩, 老师，我要, 小贝). The ja, en and de noisy turns are written in the same style; replace them with real ones when there are some.
- The recordings in the manifest haven't been made yet, so their 6 cases are skipped until the dev records them.
- The estimated full run is about $1.71 (quick about $0.45), over the < $1 target: most of it is the pro judge.
