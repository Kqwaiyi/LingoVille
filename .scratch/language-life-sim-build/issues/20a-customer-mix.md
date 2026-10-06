# 20a — Customer mix and harder barista orders

**What to build:** Barista Shifts now mix customers: 60% at the Player's band, 30% below and 10% above. Harder customers order a drink with a size, hot or iced and extras (modifier toggles), or change their mind halfway (undo and redo).

**Blocked by:** 19b — A Shift of single-drink customers

**Spec:** [spec.md](../spec.md): Jobs and Shifts (templates, mix)

**Status:** done

- [x] Barista templates B, I and A, as in the spec's table, as content. `SHIFT_TEMPLATES.barista` (`src/content/shifts.ts`): a single drink (B); coffee or tea in a size, hot or iced, with one extra that drink takes (I); the same, with a change of mind (A). Each pack names the sizes, hot/iced and extras (`drinkOptions`).
- [x] The customer mix is 60/30/10 from the seeded RNG, falling back to the nearest band the Job has. Bands map B = A1–A2, I = B1–B2, A = C1–C2 on the current step (Vitest). The shares are `ECONOMY.shiftCustomerMix`. On a tie between two nearest bands, the easier one is used.
- [x] Modifier toggles on the grid for size, hot/iced and extras, plus undo and redo. The toggles set how the next drink tapped is made (medium, hot, nothing added for each new customer). Undo and redo cover taps and Clear (`src/sim/tray.ts`). A customer who changes their mind does so when the Player first puts something on the tray.
- [x] The exact check covers modifiers and the final order after a change of mind (Vitest). A drink ordered alone may be made any way. The Shift Recap is told how each drink was made and what a customer first asked for. Saves are v9: each Shift Customer records its template and any change of mind.
