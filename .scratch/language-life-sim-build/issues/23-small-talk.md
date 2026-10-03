# 23 — Named NPCs, Small Talk and Familiarity

**What to build:** The town has about 15 Named NPCs (counter staff, 3–4 park regulars and the landlord), each with a fixed persona localised for every pack. Pressing E on an idle Named NPC starts Small Talk. It has no goal and can't fail; Mood rises with each understood exchange, it wraps up after 6–8 exchanges, and it gets a lighter Recap. Over 1–2 weeks of regular visits, NPCs move from stranger to acquaintance to friend. They learn the Character's name only when told, and use it from then on. They follow up on what was talked about last time. A friend has +1 Patience.

**Blocked by:** 06 — Recap, hear-it-said and the Journal, 13 — The whole town: 11 places, hours and trams

**Spec:** [spec.md](../spec.md): Named NPCs, Familiarity and NPC Memory; Goal Interactions (Small Talk)

**Status:** ready-for-agent

- [ ] Persona content schema: name, age, temperament, quirks and one favourite gift, localised per pack. The content check fails if any persona lacks a localisation in any pack.
- [ ] Each Named NPC has an NPC Memory record in the save: familiarity points and a per-NPC daily cap counter, `timesMet`, `knowsName`, `usualOrder`, `lastTopic`, `favouriteKnown`, `lastGiftDay` and `registerOffered`.
- [ ] Small Talk mode has no completion function, and the NPC points any stated goal to the counter. It gets the lighter Recap. Mood per exchange counts under the per-NPC daily cap shared with Familiarity (Vitest).
- [ ] Familiarity comes mostly from Small Talk, and a little from successful Goal Interactions with that NPC. Tier thresholds come from the tuning module, and Familiarity never decays (Vitest).
- [ ] `learn_name` is checked by the sim against the setup name. NPCs greet the Character by name from acquaintance up.
- [ ] The Recap's `lastTopic` overwrites the previous one. The "You and this person" prompt block is built from NPC Memory, with snapshots for a stranger and a friend.
- [ ] A friend has +1 Patience.
- [ ] Familiarity never gives discounts or unlocks Help.
