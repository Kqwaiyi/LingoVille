# 27 — Bathhouse, gym and Fitness

**What to build:** The Player buys bathhouse entry (#21) for a big Mood lift; it counts as a Comfort Purchase. The Player can also join the gym (#22). Membership lasts 30 days and is renewed by talking to the attendant. With membership, one gym session a day (about 1 game hour) gives Fitness XP and a small Mood lift. Fitness lowers the chance of Illness and slows Health loss when Hunger or Thirst is at zero.

**Blocked by:** 13b — Greybox town of 11 places and tram travel, 15 — Sleep, Mood sources and the Mood modifier, 17b — Cooking and Life Skills

**Spec:** [spec.md](../spec.md): Goal Interactions (#21, #22); Economy (Comfort Purchases); Life Skills (Fitness); Decisions made before ticketing (6)

**Status:** ready-for-agent

- [ ] Interaction #21 (`admit(options)`) is defined and works in all four packs.
- [ ] Bathhouse success charges the entry price and gives a big Mood lift, set in the tuning module (Vitest).
- [ ] The bathhouse stays open on Sundays in the de pack.
- [ ] Interaction #22 (`register_member()`) is defined, with a short renewal path for an expired membership, and works in all four packs.
- [ ] Membership lasts 30 in-game days and costs about 0.5 Shift. It is never charged automatically and never becomes debt. Once it expires, sessions are refused until it's renewed (Vitest).
- [ ] `gymSession`: one a day, taking about 1 game hour, giving Fitness XP × the Mood modifier and a small Mood lift (Vitest).
- [ ] Fitness lowers Illness chance by up to 40% at level 5, recorded for Illness, and slows the Health drain at zero Hunger or Thirst (Vitest).
