# 18 — Rent, debt and the landlord

**What to build:** Rent is about 2 Shifts a week at full price, minus the Newcomer Discount, and first falls due at the end of day 7. The Player pays the landlord (#16) or asks for more time (#17). Unpaid rent becomes debt with a Mood penalty, never eviction. The landlord catches the Character in the hallway with reminders, and announces each Newcomer Discount step-down in conversation.

**Blocked by:** 14 — The town adapts to my level, 16 — Fainting and the hospital

**Spec:** [spec.md](../spec.md): Economy; Decisions made before ticketing (13)

**Status:** ready-for-agent

- [ ] Rent falls due weekly from the end of day 7. The Newcomer Discount follows the highest step reached (50/40/25/10/0/0%) and only steps down, never back up (Vitest).
- [ ] Paying rent (#16) clears rent and rent debt. An extension (#17, `grant_extension(days)`) removes the Mood penalty for the extended days.
- [ ] Unpaid rent becomes debt with a Mood penalty. Debt is repaid only at the counter, never from Shift pay (Vitest).
- [ ] The landlord is available 8:00–20:00. They approach in the hallway when rent is due and unpaid, or when a Newcomer Discount step-down is pending.
- [ ] Step-downs are spoken by the landlord, never shown as numbers.
