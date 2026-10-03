# 19 — Barista hiring and a first Shift

**What to build:** The Player asks the barista for work (#26) and gives their name. Once hired, E at the staff door during opening hours starts a Shift. Five to eight Shift Customers walk up, speak first and each order a single drink, which the Player taps on a menu grid. Each order is checked exactly. At the end, pay is shown and one combined Shift Recap opens.

**Blocked by:** 06 — Recap, hear-it-said and the Journal, 14 — The town adapts to my level, 15 — Sleep, late nights and the Mood modifier

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Decisions made before ticketing (8, 11)

**Status:** ready-for-agent

- [ ] Hiring interaction #26: ask for work, give a name (the sim compares it to the setup name) and say when you can start. A failure can be retried. The Job is recorded in the save.
- [ ] E at the staff door during opening hours starts a Shift. At most one Shift a day, with no schedule.
- [ ] Shift Customer sessions carry the hidden order as the customer's goal. Customers are anonymous, have no memory and get a random voice. They speak first and can be asked to repeat or clarify, with Patience as usual.
- [ ] A barista menu grid. `applyShiftCustomer` checks the served items exactly against the hidden order, with no model judgement.
- [ ] `endShift` pays base × share served × Mood modifier × stake multiplier (from the highest step), minus a dock per failed or abandoned customer, never below 0. Vitest covers the docks at each step.
- [ ] A network abandonment replaces the customer and doesn't count. A player abandonment counts as a failure.
- [ ] The Shift saves after every customer. A reload ends the Shift with pay for the customers already served.
- [ ] One combined Shift Recap opens at the end, from a single `/api/recap` call. Shift results feed listening evidence into Proficiency.
- [ ] Closing time doesn't cut a Shift short.
