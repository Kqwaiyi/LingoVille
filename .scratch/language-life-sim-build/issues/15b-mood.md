# 15b — Mood sources and the Mood modifier

**What to build:** Mood now matters. It falls fast after about 2am and while Hunger or Thirst is empty. A Mood modifier is ready for Shift pay and Life Skill XP to use, and the dock's Mood gauge shows a face that matches Mood.

**Blocked by:** None — can start immediately

**Spec:** [spec.md](../spec.md): Well-being and Mood; Decisions made before ticketing (4)

**Status:** ready-for-agent

- [ ] Mood drains fast after about 2am, in `tick` (Vitest).
- [ ] Unmet needs (Hunger or Thirst at 0) lower Mood (Vitest).
- [ ] The Mood scale, the size of each change and the Mood modifier curve are defaults in the tuning module. The modifier is a pure function (Vitest).
- [ ] The dock's Mood gauge shows a face that matches Mood.
