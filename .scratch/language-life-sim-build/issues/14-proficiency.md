# 14 — The town adapts to my level

**What to build:** The Player's hidden Language Proficiency moves after each finished conversation, from the Recap's CEFR estimate. If the Player over- or under-rated themselves at setup, it corrects itself within about the first game day. NPCs then speak to the Player's real level. At low steps they're slower and simpler and offer choices up front; at high steps they speak naturally and expect more. NPCs get less patient as the Player improves.

**Blocked by:** 06 — Recap, hear-it-said and the Journal

**Spec:** [spec.md](../spec.md): Language Proficiency

**Status:** ready-for-agent

- [ ] `applyRecapEvidence`, with Vitest:
  - the score moves about 0.15 of the gap to the estimate normally, and about 0.3 during the first 10 interactions;
  - 1–2 player turns count very little;
  - each `not_understood()` is evidence of a lower level;
  - Help-log turns are discounted, and Help never lowers the estimate.
- [ ] Six steps, A1–C2, with a buffer at the boundaries so the current step doesn't flicker. The step moves in both directions.
- [ ] The highest step reached is tracked separately and only ever goes up.
- [ ] The step-adaptation prompt block varies:
  - vocabulary and sentence length;
  - speed: "slowly and clearly" at A1–A2, natural from B2 up;
  - choices offered up front at low steps, and one simpler rephrase at A1–A2.
- [ ] Snapshots cover each language × step.
- [ ] Starting Patience follows the current step: 4/4/3/3/2/2.
- [ ] Neither the level nor Patience appears anywhere on screen.
