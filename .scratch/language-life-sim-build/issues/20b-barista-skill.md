# 20b — Barista skill, translated customers and overwork

**What to build:** The Barista skill rises with each customer served well. It raises pay by 6% a level and makes the grid easier to use, but never helps with listening. Translating a customer's order and then serving it correctly pays normally, minus half a dock. Working too many days in a week costs Mood.

**Blocked by:** 20a — Customer mix and harder barista orders, 17b — Cooking and Life Skills

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Life Skills; Help

**Status:** ready-for-agent

- [ ] Barista skill XP is earned per successful customer. Each level adds 6% to pay and unlocks mechanics aids only: a grouped grid and a remembered size (Vitest for pay).
- [ ] A tap-translated customer served correctly pays the per-customer amount minus half the failure dock, and gives no listening evidence. Vitest includes the A1–A2 case, where the dock is zero.
- [ ] In Shifts, hints for the Player's own lines are free.
- [ ] Overwork (working 5–6 days a week) gives a Mood penalty, set in the tuning module (Vitest).
