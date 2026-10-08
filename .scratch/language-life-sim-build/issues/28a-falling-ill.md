# 28a — Falling ill

**What to build:** Every week or two, the Character may fall ill with a cold, flu, food poisoning or hay fever, each with its own symptoms. An Illness drains Health slowly and lowers Mood, and it leads to Fainting if left untreated.

**Blocked by:** 16 — Fainting, hospital debt and NPC-initiated conversations, 17b — Cooking and Life Skills

**Spec:** [spec.md](../spec.md): Illness

**Status:** done

- [x] The 4 Illnesses, with their symptoms and medicines, are content.
- [x] Illness onset comes from the seeded RNG at a base rate set in the tuning module. Low Well-being makes it more likely and Fitness less likely. Expired or cheap food raises the chance of food poisoning. A reload can't dodge an Illness (Vitest).
- [x] An Illness drains Health slowly and lowers Mood, and leads to Fainting if left untreated (Vitest).
- [x] The Player can tell the Character is ill, without being told the diagnosis.

**Notes for 28b:**
- The roll happens at each day end (`src/sim/days.ts`), so the Character falls ill overnight. Health drain while ill comes from `illnessHealthPerMinute` in `src/sim/illness.ts`: the fever reducer stopping flu's drain belongs there.
- Fainting cures the Illness (the ward sees to it). Without that, an untreated Illness would faint the Character again and again. The night's roll still applies, so the Character can wake up with a new Illness.
- Cheap counter food (snack, bento: `cheap` on the item) adds `ILLNESS.cheapFoodPoisoningChance` per piece eaten. The "Feeling unwell" line above the dock lists the symptoms, never the Illness. `?ill=<id>` (dev) starts a new game ill.
