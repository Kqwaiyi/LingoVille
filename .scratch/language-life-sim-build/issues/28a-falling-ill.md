# 28a — Falling ill

**What to build:** Every week or two, the Character may fall ill with a cold, flu, food poisoning or hay fever, each with its own symptoms. An Illness drains Health slowly and lowers Mood, and it leads to Fainting if left untreated.

**Blocked by:** 16 — Fainting, hospital debt and NPC-initiated conversations, 17b — Cooking and Life Skills

**Spec:** [spec.md](../spec.md): Illness

**Status:** ready-for-agent

- [ ] The 4 Illnesses, with their symptoms and medicines, are content.
- [ ] Illness onset comes from the seeded RNG at a base rate set in the tuning module. Low Well-being makes it more likely and Fitness less likely. Expired or cheap food raises the chance of food poisoning. A reload can't dodge an Illness (Vitest).
- [ ] An Illness drains Health slowly and lowers Mood, and leads to Fainting if left untreated (Vitest).
- [ ] The Player can tell the Character is ill, without being told the diagnosis.
