# 25 — The restaurant: table, meal, bill and dietary recommendations

**What to build:** At the restaurant, the Player gets a table (#8), orders a meal (#9) and pays the bill (#11). The Player can also ask the server for a recommendation that fits a dietary restriction (#10) and order it. A restaurant meal is a Comfort Purchase that fills Hunger and lifts Mood.

**Blocked by:** 24 — Bookshop and Comfort Purchases

**Spec:** [spec.md](../spec.md): Goal Interactions (#8, #9, #10, #11); Economy

**Status:** ready-for-agent

- [ ] Interactions #8 (`seat_guest`), #9 (`serve_order`), #10 (`serve_order`) and #11 (`settle_bill`) are defined, with their completion functions and effects, and work in all four packs.
- [ ] The restaurant menu, with dietary facts for each dish, is pack content, covered by the cross-reference check.
- [ ] The sim rejects an order that breaks the stated restriction (Vitest).
- [ ] The restaurant meal counts as a Comfort Purchase (Mood) at about 0.25 Shift.
- [ ] The restaurant is closed on Mondays.
