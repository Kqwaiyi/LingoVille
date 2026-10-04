# 20a — Customer mix and harder barista orders

**What to build:** Barista Shifts now mix customers: 60% at the Player's band, 30% below and 10% above. Harder customers order a drink with a size, hot or iced and extras (modifier toggles), or change their mind halfway (undo and redo).

**Blocked by:** 19b — A Shift of single-drink customers

**Spec:** [spec.md](../spec.md): Jobs and Shifts (templates, mix)

**Status:** ready-for-agent

- [ ] Barista templates B, I and A, as in the spec's table, as content.
- [ ] The customer mix is 60/30/10 from the seeded RNG, falling back to the nearest band the Job has. Bands map B = A1–A2, I = B1–B2, A = C1–C2 on the current step (Vitest).
- [ ] Modifier toggles on the grid for size, hot/iced and extras, plus undo and redo.
- [ ] The exact check covers modifiers and the final order after a change of mind (Vitest).
