# 26b — Regulars: "the usual?", "on the house", casual register and park waves

**What to build:** After three identical orders, acquaintances offer "the usual?". A friend occasionally gives something "on the house", at most once a week, and offers once to switch to a casual register (Sie→du, keigo→タメ口), which the Recap notes. Park regulars wave the Player over, at most once a day.

**Blocked by:** 23b — Small Talk and Familiarity, 16 — Fainting, hospital debt and NPC-initiated conversations

**Spec:** [spec.md](../spec.md): Named NPCs, Familiarity and NPC Memory; Town and places (NPCs who start conversations)

**Status:** ready-for-agent

- [ ] `usualOrder` is set after the same interaction with the same completion arguments 3 times in a row (Vitest).
- [ ] From acquaintance up, the NPC offers "the usual?". An accepted "usual" counts as a normal success with small level evidence (Vitest).
- [ ] "On the house" flavour from a friend, at most once a week, with no discounts otherwise.
- [ ] At friend tier, the register-switch offer is made once (`registerOffered`) and noted in the Recap (Vitest and a snapshot).
- [ ] Park regulars start a conversation by waving the Player over, at most once a day (Vitest).
