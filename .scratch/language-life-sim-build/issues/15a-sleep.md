# 15a — Bed and sleep

**What to build:** From 20:00 the Player can go to bed at home, and the Character wakes at 07:00 the next morning with a small Mood boost. Waking starts a new day, which saves the game and rotates the start-of-day backup.

**Blocked by:** 13b — Greybox town of 11 places

**Spec:** [spec.md](../spec.md): Time and clock; Save model (autosave, backups); Decisions made before ticketing (9)

**Status:** ready-for-agent

- [ ] `sleep` is allowed only from 20:00. It always wakes at 07:00 the next morning, even after a late bedtime, pauses decay and gives a small Mood boost. No naps (Vitest for each rule).
- [ ] The new day triggers an autosave and the start-of-day backup.
- [ ] Using the bed before 20:00 says it's too early, in the Native Language.
- [ ] After loading a save made at home, the Character spawns in bed.
