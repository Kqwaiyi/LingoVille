# 14a — Proficiency moves from Recap evidence

**What to build:** The Player's hidden Language Proficiency moves after each finished conversation, based on the Recap's CEFR estimate. If the Player over- or under-rated themselves at setup, it corrects itself within about the first game day. NPC Patience follows the current step.

**Blocked by:** None — can start immediately

**Spec:** [spec.md](../spec.md): Language Proficiency; Help (Help log weighting)

**Status:** ready-for-agent

- [ ] `applyRecapEvidence`, with Vitest:
  - the score moves about 0.15 of the gap to the estimate normally, and about 0.3 during the first 10 interactions;
  - 1–2 player turns count very little;
  - each `not_understood()` is evidence of a lower level;
  - Help-log turns are discounted, and Help never lowers the estimate.
- [ ] Six steps, A1–C2, with a buffer at the boundaries so the current step doesn't flicker. The step moves in both directions.
- [ ] The highest step reached is tracked separately and only ever goes up.
- [ ] Starting Patience follows the current step: 4/4/3/3/2/2.
- [ ] Neither the level nor Patience appears anywhere on screen.
