# 26b — "The usual?" and "on the house"

**What to build:** After three identical orders, acquaintances offer "the usual?". A friend occasionally gives something "on the house", at most once a week.

**Blocked by:** 23c — Familiarity, names and memory in the prompt

**Spec:** [spec.md](../spec.md): Named NPCs, Familiarity and NPC Memory

**Status:** ready-for-agent

- [ ] `usualOrder` is set after the same interaction with the same completion arguments 3 times in a row (Vitest).
- [ ] From acquaintance up, the NPC offers "the usual?". An accepted "usual" counts as a normal success with small level evidence (Vitest).
- [ ] "On the house" flavour from a friend, at most once a week, with no discounts otherwise.
