# 25a — Get a table, order a meal and pay

**What to build:** At the restaurant, the Player gets a table (#8), orders a meal (#9) and pays the bill (#11). A restaurant meal is a Comfort Purchase that fills Hunger and lifts Mood.

**Blocked by:** 24a — Comfort Purchases, books and café cake

**Spec:** [spec.md](../spec.md): Goal Interactions (#8, #9, #11); Economy

**Status:** ready-for-agent

- [ ] Interactions #8 (`seat_guest`), #9 (`serve_order`) and #11 (`settle_bill`) are defined, with their completion functions and effects, and work in all four packs.
- [ ] The restaurant menu is pack content, covered by the cross-reference check.
- [ ] The restaurant meal counts as a Comfort Purchase (Mood) at about 0.25 Shift.
- [ ] The restaurant is closed on Mondays.
