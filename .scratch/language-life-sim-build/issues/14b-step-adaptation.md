# 14b — NPCs adapt to the Player's step

**What to build:** NPCs speak to the Player's current level. At low steps they're slower and simpler, offer choices up front and rephrase once when the Player seems lost. At high steps they speak naturally and expect the Player to volunteer details.

**Blocked by:** 14a — Proficiency moves from Recap evidence

**Spec:** [spec.md](../spec.md): Language Proficiency (NPC adaptation); NPC prompt assembly

**Status:** ready-for-agent

- [ ] The step-adaptation prompt block varies:
  - vocabulary and sentence length;
  - speed: "slowly and clearly" at A1–A2, natural from B2 up;
  - choices offered up front at low steps, and one simpler rephrase at A1–A2.
- [ ] Snapshots cover each language × step.
- [ ] The session is built from the current step, not the highest step reached.
