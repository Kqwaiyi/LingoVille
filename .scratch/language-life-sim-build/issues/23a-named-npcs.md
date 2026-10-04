# 23a — Named NPC personas and NPC Memory records

**What to build:** The town has about 15 Named NPCs: counter staff, 3–4 park regulars and the landlord. Each has a fixed persona localised for every pack, and their name shows in the conversation header. The save keeps one NPC Memory record per Named NPC.

**Blocked by:** 13b — Greybox town of 11 places

**Spec:** [spec.md](../spec.md): Named NPCs, Familiarity and NPC Memory

**Status:** ready-for-agent

- [ ] Persona content schema: name, age, temperament, quirks and one favourite gift, localised per pack. The content check fails if any persona lacks a localisation in any pack.
- [ ] Park regulars stand in the park as Named NPCs.
- [ ] Each Named NPC has an NPC Memory record in the save, with the fields from the spec's table. With no record, the NPC treats the Character as a stranger.
- [ ] `timesMet` goes up after each finished conversation with that NPC (Vitest).
- [ ] The role and persona prompt block uses the localised persona (snapshot).
