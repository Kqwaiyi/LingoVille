# 13 — The whole town: 11 places, hours and trams

**What to build:** The Player can walk a town of 11 places:

- home
- café
- supermarket
- convenience store
- restaurant
- clinic, hospital and pharmacy
- park
- 2–3 tram stops
- bookshop and gift shop
- bathhouse and gym
- town office and post office

A line above the dock shows the current place and its hours. Lit windows mean a place is open, and closed places can't be entered. The tram is fast travel between stops. In the German pack, nearly everything is shut on Sunday.

**Blocked by:** 02 — Walk to the café and watch the clock, 11 — Four Culture Packs and local prices

**Spec:** [spec.md](../spec.md): Town and places; Decisions made before ticketing (8)

**Status:** ready-for-agent

- [ ] Greybox (or kit) layout of all 11 places, with the staff roles from the places table. "Press E to talk — <role>" appears near each available NPC.
- [ ] Places and default hours are content, and packs override them. The de pack closes everything on Sunday except the bathhouse, the Fainting ward, the convenience store and the trams. The restaurant is closed on Mondays.
- [ ] Closing time only stops new conversations and Shifts from starting; anything already under way finishes (Vitest).
- [ ] The place and hours line sits above the dock.
- [ ] Windows are lit only while a place is open.
- [ ] Tram: choose a stop, time passes, and the Character arrives. Trams run 6:00–1:00 and are free.
- [ ] Only the Character's current place id is in sim state. Positions live in the Rapier world.
