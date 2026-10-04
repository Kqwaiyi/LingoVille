# 15 — Sleep, Mood sources and the Mood modifier

**What to build:** Mood now matters. It falls fast after about 2am and while Hunger or Thirst is empty, and the dock's Mood gauge shows a face that matches Mood. A Mood modifier is ready for Shift pay and Life Skill XP to use. From 20:00 the Player can go to bed at home, and the Character wakes at 07:00 the next morning with a small Mood boost. Waking starts a new day, which saves the game and rotates the start-of-day backup.

**Blocked by:** 13b — Greybox town of 11 places and tram travel

**Spec:** [spec.md](../spec.md): Well-being and Mood; Time and clock; Save model (autosave, backups); Decisions made before ticketing (4, 9)

**Status:** ready-for-agent

- [ ] Mood drains fast after about 2am, in `tick` (Vitest).
- [ ] Unmet needs (Hunger or Thirst at 0) lower Mood (Vitest).
- [ ] The Mood scale, the size of each change and the Mood modifier curve are defaults in the tuning module. The modifier is a pure function (Vitest).
- [ ] The dock's Mood gauge shows a face that matches Mood.
- [ ] `sleep` is allowed only from 20:00. It always wakes at 07:00 the next morning, even after a late bedtime, pauses decay and gives a small Mood boost. No naps (Vitest for each rule).
- [ ] The new day triggers an autosave and the start-of-day backup.
- [ ] Using the bed before 20:00 says it's too early, in the Native Language.
- [ ] After loading a save made at home, the Character spawns in bed.
