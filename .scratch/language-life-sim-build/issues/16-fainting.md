# 16 — Fainting and the hospital

**What to build:** If Health reaches zero, the Character faints and wakes in the hospital at 08:00 the next day, losing the rest of the current day. The bill is about 1.5 Shifts, and becomes debt if the Character can't pay it. Mood takes a hit. The nurse greets the Character in the Target Language.

**Blocked by:** 04 — Order a drink and pay, 13 — The whole town: 11 places, hours and trams

**Spec:** [spec.md](../spec.md): Well-being and Mood (Fainting); Town and places (NPCs who start conversations)

**Status:** ready-for-agent

- [ ] `faint`: the Character wakes at 08:00 the next day in the hospital. The bill of about 1.5 Shifts is paid or recorded as hospital debt, and Mood takes a hit (Vitest).
- [ ] Debts are a list on the save (kind, amount) that carries forward, shown next to the money.
- [ ] NPC-initiated conversations exist: the nurse starts talking when the Character wakes.
- [ ] A Fainting screen, then the wake-up scene.
- [ ] Nothing in the game kills the Character.
