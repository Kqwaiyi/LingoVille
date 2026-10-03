# 20 — Full barista Shift and Job skills

**What to build:** Barista Shifts now mix customers: 60% at the Player's band, 30% below and 10% above. Harder customers order a drink with size, hot or iced and extras (modifier toggles), or change their mind halfway (undo and redo). The Barista skill rises with each customer served well. It raises pay by 6% a level and makes the grid easier to use, but never helps with listening. Translating a customer's order and then serving it correctly pays normally, minus half a dock.

**Blocked by:** 09 — Help tab, 17 — Groceries, cooking and Life Skills, 19 — Barista hiring and a first Shift

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Life Skills; Help

**Status:** ready-for-agent

- [ ] Barista templates B, I and A, as in the spec's table.
- [ ] The customer mix is 60/30/10 from the seeded RNG, falling back to the nearest band the Job has. Bands map B = A1–A2, I = B1–B2, A = C1–C2 on the current step (Vitest).
- [ ] Barista skill XP is earned per successful customer. Each level adds 6% to pay and unlocks mechanics aids only (a grouped grid, a remembered size).
- [ ] A tap-translated customer served correctly pays the per-customer amount minus half the failure dock, and gives no listening evidence. Vitest includes the A1–A2 case, where the dock is zero.
- [ ] Overwork (working 5–6 days a week) gives a Mood penalty, set in the tuning module.
