# 28b — Clinic, pharmacy and the hospital bill

**What to build:** At the clinic, the Player checks in at reception (#12) and waits until the doctor calls their name. Then they describe their symptoms (#13); the diagnosis is right only if the Player got the symptoms across. At the pharmacy, the Player gets medicine (#14). The right medicine cures at once, but the wrong one doesn't cure at all. Flu is different: the fever reducer stops the Health drain at once, and the flu clears only after the next sleep. At reception, the Player settles hospital debt in full, or arranges to pay it in instalments (#15). Instalments come out automatically on rent day, and a missed instalment stays as debt.

**Blocked by:** 28a — Falling ill, 15 — Sleep, Mood sources and the Mood modifier, 16 — Fainting, hospital debt and NPC-initiated conversations, 18 — Rent, the Newcomer Discount and the landlord

**Spec:** [spec.md](../spec.md): Illness; Goal Interactions (#12, #13, #14, #15); Economy (debt); Town and places (NPCs who start conversations); Decisions made before ticketing (7, 13)

**Status:** ready-for-agent

- [ ] Interactions #12 (`register_patient(reason)`), #13 (`diagnose(illness)`), #14 (`dispense(medicine)`) and #15 (`set_payment_plan(weeks)`, where 0 means pay now) are defined and work in all four packs.
- [ ] After check-in, the doctor calls the Character's name in the waiting room, which starts the conversation.
- [ ] The doctor's facts include the symptoms of each Illness. The diagnosis records a prescription.
- [ ] The clinic is closed on Sundays.
- [ ] `dispense` cures only if the medicine matches the Illness (Vitest).
- [ ] The fever reducer stops flu's Health drain at once, but the flu clears only after the next sleep (Vitest).
- [ ] Hospital debt can be paid in full at reception, or set as a plan. Plan instalments are taken automatically on rent day, and a missed instalment stays as debt (Vitest).
- [ ] A doctor's visit plus medicine costs clearly less than Fainting (Vitest on content prices).
