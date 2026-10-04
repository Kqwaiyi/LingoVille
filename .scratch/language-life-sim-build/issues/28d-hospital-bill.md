# 28d — Hospital bill and payment plans

**What to build:** At reception, the Player settles hospital debt in full, or arranges to pay it in instalments (#15). Instalments come out automatically on rent day, and a missed instalment stays as debt.

**Blocked by:** 28b — Clinic check-in and diagnosis, 18a — Rent, the Newcomer Discount and paying the landlord

**Spec:** [spec.md](../spec.md): Economy (debt); Goal Interactions (#15); Decisions made before ticketing (13)

**Status:** ready-for-agent

- [ ] Interaction #15 (`set_payment_plan(weeks)`, where 0 means pay now) is defined and works in all four packs.
- [ ] Hospital debt can be paid in full at reception, or set as a plan. Plan instalments are taken automatically on rent day, and a missed instalment stays as debt (Vitest).
- [ ] A doctor's visit plus medicine costs clearly less than Fainting (Vitest on content prices).
