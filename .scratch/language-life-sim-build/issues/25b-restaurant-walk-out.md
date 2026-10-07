# 25b — Walking out of the restaurant with the bill unpaid

**What to build:** When the Character leaves the restaurant (or faints) with an unpaid bill, the bill becomes restaurant debt, paid off at the server. Today a meal is eaten when it's ordered and paid for later with the bill (#11). Walking out costs nothing: the bill stays open and the server won't seat the Character again until it's paid, so a restaurant meal can be had for free.

**Blocked by:** 25 — The restaurant

**Spec:** [spec.md](../spec.md): Goal Interactions (#9, #11); Economy

**Status:** ready-for-agent

**Decided (2026-10-07):** it becomes debt.

- Leaving the restaurant (`enterPlace`) or fainting there with anything on the bill moves the whole bill, at menu prices, into a new `restaurant` debt kind (`addDebt`). The bill is then empty. A second unpaid bill joins the same debt.
- Restaurant debt is repaid only at the server, never from Shift pay. While it's owed, E at the server is #11, with the debt in its facts ("owed from last time", in local money), and `settle_bill` pays the debt and any bill together. The server won't seat the Character again until it's paid.
- Like hospital debt, it costs no daily Mood (`MOOD.debtPenaltyPerDay` stays rent's). It shows next to the money as the other debts do.

- [x] The decision is recorded here.
- [ ] Walking out (and fainting) with an unpaid bill turns it into restaurant debt (Vitest, `src/sim/restaurant.test.ts`).
- [ ] `settle_bill` at the server pays restaurant debt along with any bill, and the server's facts say what's owed (Vitest; mock and snapshot updated).
- [ ] `DEBT_KINDS` gains `restaurant`. Older saves need no migration, since a new enum value only widens what loads, but the save tests cover a restaurant debt round trip.
- [ ] The prompts change (the bill facts), so this needs a passing `npm run eval` before merging.

## Comments

- Raised by the spec review of 25. The current rule lives in `enterPlace` (`src/sim/wellBeing.ts`) and `faint` (`src/sim/faint.ts`), which give up the table and keep `restaurant.bill`.
