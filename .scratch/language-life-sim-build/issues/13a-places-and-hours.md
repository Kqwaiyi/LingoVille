# 13a — Places, opening hours and closing time

**What to build:** Every place has opening hours, and Culture Packs can override them. A line above the dock shows the current place and its hours. A closed place can't be entered. Closing time stops new conversations and Shifts from starting, but never cuts one short. In the German pack, nearly everything is shut on Sunday.

**Blocked by:** 11 — Four Culture Packs and local prices

**Spec:** [spec.md](../spec.md): Town and places; Time and clock; Decisions made before ticketing (8)

**Status:** ready-for-agent

- [ ] All 11 places and their default hours are content, and packs override them. The de pack closes everything on Sunday except the bathhouse, the Fainting ward, the convenience store and the trams. The restaurant is closed on Mondays (Vitest).
- [ ] Closing time only stops new conversations and Shifts from starting; anything already under way finishes (Vitest).
- [ ] The place and hours line sits above the dock.
- [ ] A closed place can't be entered, and its staff can't be talked to.
