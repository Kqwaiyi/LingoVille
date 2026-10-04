# 26a — Giving gifts and learning the favourite

**What to build:** In any conversation with a Named NPC, the Player can give a gift from the inventory. One gift per NPC per week counts, and the NPC's favourite counts most. The Player finds out the favourite by asking.

**Blocked by:** 23b — Small Talk and Familiarity, 24 — Bookshop and Comfort Purchases

**Spec:** [spec.md](../spec.md): Named NPCs, Familiarity and NPC Memory

**Status:** ready-for-agent

- [ ] `giveGift`: a one-off Familiarity bump, counted once per NPC per week (`lastGiftDay`) and bigger for the favourite (Vitest).
- [ ] A way to give a gift from the inventory during any conversation with a Named NPC.
- [ ] `reveal_favourite` is a session tool for Named NPCs and sets `favouriteKnown`.
