# 26 — Gifts, regulars and friendship milestones

**What to build:** In any conversation with a Named NPC, the Player can give a gift from the inventory. One gift per NPC per week counts, and the NPC's favourite (learned by asking) counts most. After three identical orders, acquaintances offer "the usual?". A friend offers once to switch to a casual register (Sie→du, keigo→タメ口), noted in the Recap. A friend occasionally gives something "on the house", at most once a week. Park regulars wave the Player over at most once a day.

**Blocked by:** 23 — Named NPCs, Small Talk and Familiarity, 25 — Bookshop and Comfort Purchases

**Spec:** [spec.md](../spec.md): Named NPCs, Familiarity and NPC Memory

**Status:** ready-for-agent

- [ ] `giveGift`: a one-off Familiarity bump, counted once per NPC per week and bigger for the favourite (Vitest).
- [ ] `reveal_favourite` sets `favouriteKnown`.
- [ ] `usualOrder` is set after the same interaction with the same completion arguments 3 times in a row. An accepted "the usual?" counts as a normal success with small level evidence (Vitest).
- [ ] At friend tier, the register-switch offer is made once (`registerOffered`) and noted in the Recap.
- [ ] "On the house" flavour from a friend, at most once a week.
- [ ] Park regulars start a conversation by waving the Player over, at most once a day.
