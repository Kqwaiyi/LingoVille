# 23c — Familiarity, names and memory in the prompt

**What to build:** Over 1–2 weeks of regular visits, NPCs move from stranger to acquaintance to friend. They learn the Character's name only when told, and use it from then on. They follow up on what was talked about last time. A friend has +1 Patience.

**Blocked by:** 23b — Small Talk

**Spec:** [spec.md](../spec.md): Named NPCs, Familiarity and NPC Memory; NPC prompt assembly ("You and this person")

**Status:** ready-for-agent

- [ ] Familiarity comes mostly from Small Talk, and a little from successful Goal Interactions with that NPC. It shares the per-NPC daily cap with Small Talk Mood. Tier thresholds come from the tuning module, and Familiarity never decays (Vitest).
- [ ] `learn_name` is a session tool for Named NPCs, checked by the sim against the setup name. NPCs greet the Character by name from acquaintance up.
- [ ] The Recap's optional `lastTopic` overwrites the previous one.
- [ ] The "You and this person" prompt block is built from NPC Memory, with snapshots for a stranger and a friend.
- [ ] A friend has +1 Patience (Vitest).
- [ ] Familiarity never gives discounts or unlocks Help.
