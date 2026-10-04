# 23b — Small Talk

**What to build:** Pressing E on an idle Named NPC starts Small Talk. It has no goal and can't fail. Mood rises with each understood exchange, the NPC wraps up after 6–8 exchanges or when busy, and the conversation gets a lighter Recap.

**Blocked by:** 23a — Named NPC personas and NPC Memory records

**Spec:** [spec.md](../spec.md): Goal Interactions (Small Talk); Recap and Journal

**Status:** ready-for-agent

- [ ] E on an idle Named NPC (no queue, not mid-order) starts Small Talk.
- [ ] Small Talk mode has no completion function, can't fail, and the NPC points any stated goal to the counter instead of switching modes.
- [ ] The NPC wraps up after about 6–8 exchanges, or when busy.
- [ ] Mood per understood exchange counts under a per-NPC daily cap, stored on the NPC Memory record (Vitest).
- [ ] Small Talk gets the lighter Recap (snapshot of the request builder).
