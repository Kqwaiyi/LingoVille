# 24 — Restaurant

**What to build:** At the restaurant, the Player gets a table (#8), orders a meal (#9), asks for a recommendation within a dietary restriction (#10) and pays the bill (#11). A restaurant meal is a Comfort Purchase that fills Hunger and lifts Mood. The restaurant is closed on Mondays.

**Blocked by:** 13 — The whole town: 11 places, hours and trams

**Spec:** [spec.md](../spec.md): Goal Interactions (#8–11); Economy

**Status:** ready-for-agent

- [ ] Interactions #8–11 are defined, with their completion functions and effects, and work in all four packs.
- [ ] The restaurant menu and dietary facts are pack content, covered by the cross-reference check.
- [ ] The restaurant meal counts as a Comfort Purchase (Mood) at about 0.25 Shift.
