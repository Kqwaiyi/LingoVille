# 28 — Illness and the clinic

**What to build:** Every week or two, the Character may fall ill with a cold, flu, food poisoning or hay fever, each with its own symptoms. At the clinic the Player checks in at reception (#12), is called by name, describes their symptoms to the doctor (#13), gets medicine at the pharmacy (#14), and settles the bill in full or in instalments (#15). The diagnosis is right only if the Player got the symptoms across, and the wrong medicine doesn't cure. Flu clears only after the next sleep.

**Blocked by:** 15 — Sleep, late nights and the Mood modifier, 16 — Fainting and the hospital, 17 — Groceries, cooking and Life Skills

**Spec:** [spec.md](../spec.md): Illness; Goal Interactions (#12–15); Economy; Decisions made before ticketing (7, 13)

**Status:** ready-for-agent

- [ ] Illness onset comes from the seeded RNG at a base rate set in the tuning module. Low Well-being makes it more likely and Fitness less likely. Expired or cheap food raises the chance of food poisoning. A reload can't dodge an Illness (Vitest).
- [ ] An Illness drains Health slowly and lowers Mood, and leads to Fainting if left untreated.
- [ ] The 4 Illnesses, with their symptoms and medicines, are content.
- [ ] Interactions #12–15 are defined. The receptionist or doctor calls the Character's name in the waiting room, starting the conversation.
- [ ] `dispense` cures only if the medicine matches the Illness. The fever reducer stops flu's Health drain at once, but the flu clears only after the next sleep (Vitest).
- [ ] Hospital debt can be paid in full at reception, or set as a plan through #15. Plan instalments are taken automatically on rent day, and a missed instalment stays as debt (Vitest).
- [ ] A doctor's visit plus medicine costs clearly less than Fainting.
