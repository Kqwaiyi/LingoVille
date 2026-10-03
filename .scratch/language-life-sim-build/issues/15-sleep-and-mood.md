# 15 — Sleep, late nights and the Mood modifier

**What to build:** From 20:00 the Player can go to bed at home, and the Character wakes at 07:00 with a small Mood boost. Staying up past about 2am drains Mood fast. Mood now matters: it rises and falls from the sources listed in the spec, and its modifier scales Shift pay and Life Skill XP.

**Blocked by:** 13 — The whole town: 11 places, hours and trams

**Spec:** [spec.md](../spec.md): Time and clock; Well-being and Mood; Decisions made before ticketing (4, 9)

**Status:** ready-for-agent

- [ ] `sleep` is allowed only from 20:00. It always wakes at 07:00 the next morning, pauses decay, gives a small Mood boost, and starts a new day, which triggers an autosave and the start-of-day backup. No naps. Vitest covers each rule.
- [ ] Mood drains fast after about 2am, in `tick`.
- [ ] The Mood scale, the size of each change and the Mood modifier curve are tuning defaults. The modifier is a pure function, used by pay and XP.
- [ ] Unmet needs (Hunger or Thirst at 0) lower Mood.
- [ ] The dock's Mood gauge shows a face that matches Mood.
