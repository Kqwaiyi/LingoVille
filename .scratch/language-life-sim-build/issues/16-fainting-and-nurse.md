# 16 — Fainting, hospital debt and NPC-initiated conversations

**What to build:** If Health reaches zero, the Character faints and wakes in the hospital at 08:00 the next day, losing the rest of the current day. The bill is about 1.5 Shifts, and it becomes debt if the Character can't pay it. Mood takes a hit. Nothing in the game kills the Character. On waking, the nurse greets the Character in the Target Language: the first NPC to start a conversation by itself. The same mechanism will later serve the landlord, the doctor and park regulars.

**Blocked by:** 13b — Greybox town of 11 places and tram travel, 15 — Sleep, Mood sources and the Mood modifier

**Spec:** [spec.md](../spec.md): Well-being and Mood (Fainting); Economy (debt); Town and places (NPCs who start conversations)

**Status:** ready-for-agent

- [ ] `faint`: the Character wakes at 08:00 the next day in the hospital. The bill of about 1.5 Shifts is paid, or recorded as hospital debt, and Mood takes a hit (Vitest).
- [ ] Debts are a list on the save (kind, amount) that carries forward, shown next to the money in the dock.
- [ ] A Fainting screen, then the Character wakes in the hospital ward.
- [ ] Nothing in the game kills the Character (Vitest: Health at 0 always leads to `faint`).
- [ ] A general way for an NPC to open a conversation with the Character when a condition is met, without the Player pressing E.
- [ ] The nurse starts talking when the Character wakes from Fainting.
- [ ] An NPC-initiated conversation behaves like any other: the NPC speaks first, and Leave, the Recap and Help all work.
