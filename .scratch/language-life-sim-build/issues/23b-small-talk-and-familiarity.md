# 23b — Small Talk and Familiarity

**What to build:** Pressing E on an idle Named NPC starts Small Talk. It has no goal and can't fail. Mood rises with each understood exchange, the NPC wraps up after 6–8 exchanges or when busy, and the conversation gets a lighter Recap. Over 1–2 weeks of regular visits, NPCs move from stranger to acquaintance to friend. They learn the Character's name only when told, and use it from then on. They follow up on what was talked about last time. A friend has +1 Patience.

**Blocked by:** 23a — Named NPC personas and NPC Memory records

**Spec:** [spec.md](../spec.md): Goal Interactions (Small Talk); Recap and Journal; Named NPCs, Familiarity and NPC Memory; NPC prompt assembly ("You and this person")

**Status:** ready-for-agent

- [ ] E on an idle Named NPC (no queue, not mid-order) starts Small Talk.
- [ ] Small Talk mode has no completion function, can't fail, and the NPC points any stated goal to the counter instead of switching modes.
- [ ] The NPC wraps up after about 6–8 exchanges, or when busy.
- [ ] Mood per understood exchange counts under a per-NPC daily cap, stored on the NPC Memory record (Vitest).
- [ ] Small Talk gets the lighter Recap (snapshot of the request builder).
- [ ] Familiarity comes mostly from Small Talk, and a little from successful Goal Interactions with that NPC. It shares the per-NPC daily cap with Small Talk Mood. Tier thresholds come from the tuning module, and Familiarity never decays (Vitest).
- [ ] `learn_name` is a session tool for Named NPCs, checked by the sim against the setup name. NPCs greet the Character by name from acquaintance up.
- [ ] The Recap's optional `lastTopic` overwrites the previous one.
- [ ] The "You and this person" prompt block is built from NPC Memory, with snapshots for a stranger and a friend.
- [ ] A friend has +1 Patience (Vitest).
- [ ] Familiarity never gives discounts or unlocks Help.
