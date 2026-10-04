# 18a — Rent, the Newcomer Discount and paying the landlord

**What to build:** Rent is about 2 Shifts a week at full price, minus the Newcomer Discount, and first falls due at the end of day 7. The Player pays the landlord at home (#16). Unpaid rent becomes debt with a Mood penalty, never eviction.

**Blocked by:** 14a — Proficiency moves from Recap evidence, 16a — Fainting and hospital debt

**Spec:** [spec.md](../spec.md): Economy; Decisions made before ticketing (13)

**Status:** ready-for-agent

- [ ] Rent falls due weekly from the end of day 7. The Newcomer Discount follows the highest step reached (50/40/25/10/0/0%) and only steps down, never back up (Vitest).
- [ ] Paying rent (#16, `accept_rent(amount)`) clears rent and rent debt.
- [ ] Unpaid rent becomes debt with a Mood penalty. Debt is repaid only at the counter, never from Shift pay (Vitest).
- [ ] The landlord is available 8:00–20:00.
