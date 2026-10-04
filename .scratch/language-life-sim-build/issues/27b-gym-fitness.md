# 27b — Gym membership and Fitness

**What to build:** The Player joins the gym (#22). Membership lasts 30 days and is renewed by talking to the attendant. With membership, one gym session a day (about 1 game hour) gives Fitness XP and a small Mood lift. Fitness lowers the chance of Illness and slows Health loss when Hunger or Thirst is at zero.

**Blocked by:** 27a — Bathhouse entry, 17b — Cooking and Life Skills

**Spec:** [spec.md](../spec.md): Goal Interactions (#22); Life Skills (Fitness); Economy; Decisions made before ticketing (6)

**Status:** ready-for-agent

- [ ] Interaction #22 (`register_member()`) is defined, with a short renewal path for an expired membership.
- [ ] Membership lasts 30 in-game days and costs about 0.5 Shift. It is never charged automatically and never becomes debt. Once it expires, sessions are refused until it's renewed (Vitest).
- [ ] `gymSession`: one a day, taking about 1 game hour, giving Fitness XP × the Mood modifier and a small Mood lift (Vitest).
- [ ] Fitness lowers Illness chance by up to 40% at level 5, recorded for Illness, and slows the Health drain at zero Hunger or Thirst (Vitest).
