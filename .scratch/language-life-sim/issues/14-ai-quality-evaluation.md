# AI quality evaluation

Type: grilling
Status: resolved
Map: [Language-learning life sim](../map.md)

## Question

How do we check that the real models behave well before trusting them, and keep checking as prompts and models change? Decide:
- what is measured: NPCs staying in the Target Language, speaking at the Proficiency Step, judging intent fairly (including noisy learner transcripts), calling the completion function only after a read-back, the Recap's corrections and CEFR estimates, and the accuracy of reading aids
- how it's run: a scripted eval harness over typed or recorded turns in the four languages, LLM-as-judge, human spot checks, or a mix
- the pass bars, and when evals run (before changing a model or prompt, or on a schedule)
- the API cost budget for running evals

The [Technical architecture](10-technical-architecture.md) ticket fixes the following:
- Prompts are pure builders with snapshot tests, and model IDs live only in `server/config.ts`.
- Mock mode (`GEMINI_MOCK=1`) covers functional end-to-end tests, so this ticket is only about the quality of real model output.
- Reading aids are library-first, then replaced by Gemini `/api/annotate` output when it passes validation. Validation rules are in scope here.

From the [Voice conversation prototype](06-voice-conversation-prototype.md): live transcription of learner Mandarin is noisy (小杯 came back as "小贝" or "tape", 一杯 as "100"), yet the NPC understood. From the [Reading aids](05-reading-aids.md) research: both libraries misread common words.

From [Help economics](12-help-economics.md): the Recap evaluation gets a Help log and must discount helped turns. A turn that repeats a hint shown just before it counts for little, and a tap-translated NPC line counts for nothing. Help must never *lower* the level estimate. Whether the evaluation does this correctly is in scope for measurement.

## Answer

Resolved on 2026-10-03 by grilling with the human.

**What is measured.** All six areas, in all four Target Languages, with larger case sets for zh and ja because their transcripts and readings carry the most risk:
- **Deterministic checks:** the NPC stays in the Target Language (language/script detection on output transcripts, loanwords allowed); the completion function is called only after a read-back and the player's confirmation, with arguments that match the read-back; the Recap's CEFR estimate is within ±1 Proficiency Step of the scripted level; Help-weighted turns never *lower* the estimate (the same case is run with and without a Help log); every Recap matches its schema.
- **LLM judge:** whether NPC speech suits the Proficiency Step, whether each Recap correction is actually correct, and whether intent was judged fairly. The judge is a stronger model than the one under test (e.g. `gemini-3.8-pro`, kept in `server/config.ts`) with a fixed rubric. A human spot-checks about 10% of the judge's verdicts on each run, so the judge itself is watched.
- **Reading aids:** the deterministic validation below, plus a small hand-checked gold set of lines per language for ja and zh.

**Inputs.**
- **Mostly text turns** through `sendText` (the Typed Fallback path) to `gemini-3.8-live`. They're cheap, deterministic and easy to write. Noisy-transcript cases are written as the garbled text the [Voice conversation prototype](06-voice-conversation-prototype.md) actually saw ("小贝", "100 咖啡", "Chao Pe"). Each turn is tagged `clean`, `noisy` (intelligible, so the NPC must understand or repair it for free) or `gibberish` (it must cost Patience).
- **A small set of recorded human clips:** a few dozen of the dev's own learner recordings per language, so the real voice path is covered. They're run less often. The audio stays **gitignored** in `evals/audio/`, and only a manifest is committed (file, language, intended transcript, expected outcome). Audio cases whose files are missing are skipped.
- Synthesized TTS audio was rejected, because it's less realistic than either typed noise or real recordings.

**Validation rules for `/api/annotate`.** An annotation replaces the library reading only if all four checks pass:
1. The `base` segments concatenated equal the original line exactly.
2. Every reading is in the right script: zh uses pinyin syllables with tone marks only, ja uses kana only.
3. The reading's length is plausible: zh has one syllable per hanzi; in ja, kana-only segments read as themselves.
4. zh only: the reading agrees with `pinyin-pro`, except on that library's known polyphonic characters, where Gemini may differ.

If any check fails, the library reading stays. The failure rate is recorded as an eval metric.

**Pass bars.**
- **Hard (no failures allowed):** no NPC line outside the Target Language, apart from loanwords; no completion function before a read-back and the player's confirmation; no completion arguments that differ from the read-back; Help discounting never lowers the CEFR estimate; every Recap passes its schema; `base` concatenation is exact for every annotation.
- **Rates:**
  - intent fairness: ≥ 90% of `noisy` turns understood or repaired without Patience loss, and ≤ 10% of `gibberish` turns accepted
  - CEFR estimate within ±1 step ≥ 85% of the time
  - judge rates corrections correct ≥ 90% of the time
  - step-appropriate speech ≥ 85%
  - annotation validation failures ≤ 15% (a soft bar, because the fallback is safe)
- **Regression rule:** any rate metric that drops by more than 5 points against the saved baseline fails the run, even if it is still above its bar.

**When evals run.** `npm run eval` gates on change: it must pass before merging anything that touches `src/ai/` (prompt builders and schemas) or `server/config.ts` (model IDs, voices). Agents are told to run it in the relevant `AGENTS.md`. There's no schedule or CI, since the project runs locally only and every call costs API money. One full run is made on the final model choice before the hackathon demo. `--quick` runs a handful of cases per language for small prompt tweaks.

**Cost.** Before starting, each run prints its estimated cost and asks to continue (e.g. "≈ $0.60, continue?"). The aim is under $1 per full run and about $15 over the whole hackathon. Most of the cost is the pro-model judge, because text-mode Live turns and flash-lite annotation calls are cheap.

**Layout.** There's a top-level `evals/` folder, outside `src/` so it never ships:
- `evals/cases/{npc,recap,annotate}/<lang>/*.ts` holds Zod-typed cases:
  - an NPC case names a Goal Interaction id, a Proficiency Step, a script of tagged player turns, and the expected outcome
  - a Recap case is a canned transcript plus a Help log plus the expected step
  - an annotate case is a line plus its gold readings
- Reports go to `evals/reports/<timestamp>.json`. The baseline is committed at `evals/baseline.json`.
- There are about 6–10 NPC cases per language to start, with more for zh and ja.

The eval code may import `src/ai/` builders and `src/content/`, so it tests the real prompts.

**Who may change what.** An agent may iterate on prompts until the eval passes. **Only a human may update `evals/baseline.json`**, and `evals/AGENTS.md` says so. This stops a run from "passing" because the baseline was lowered.
