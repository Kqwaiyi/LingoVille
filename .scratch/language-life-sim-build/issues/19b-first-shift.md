# 19b — A Shift of single-drink customers

**What to build:** Once hired, the Player presses E at the café staff door during opening hours to start a Shift. Five to eight Shift Customers walk up, speak first and each order a single drink, which the Player taps on a menu grid. Each order is checked exactly. At the end, the pay is shown.

**Blocked by:** 19a — Barista hiring, 14 — Language Proficiency from Recap evidence, and NPCs adapt to the step, 15 — Sleep, Mood sources and the Mood modifier

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Decisions made before ticketing (8)

**Status:** ready-for-agent

- [ ] E at the staff door during opening hours starts a Shift. At most one Shift a day, with no schedule (Vitest).
- [ ] Shift Customer sessions carry the hidden order as the customer's goal. Customers are anonymous, have no memory and get a random voice. They speak first and can be asked to repeat or clarify, with Patience as usual.
- [ ] A barista menu grid. `applyShiftCustomer` checks the served items exactly against the hidden order, with no model judgement (Vitest).
- [ ] `endShift` pays base × share served × Mood modifier × stake multiplier (from the highest step), minus a dock per failed customer, never below 0. Vitest covers the docks at each step.
- [ ] Closing time doesn't cut a Shift short.
- [ ] No Recap opens between customers, and Shift Customer conversations don't start a Recap request or move Proficiency. The combined Shift Recap comes in 19c (Vitest).
