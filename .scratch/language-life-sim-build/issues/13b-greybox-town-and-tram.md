# 13b — Greybox town of 11 places and tram travel

**What to build:** The Player can walk a greybox town with all 11 places, each with placeholders for its staff. "Press E to talk — <role>" appears near each available NPC, and windows are lit only while a place is open. At a tram stop, the Player chooses another stop, time passes, and the Character arrives there. Trams are free and run 6:00–1:00.

**Blocked by:** 13a — Places, opening hours and closing time

**Spec:** [spec.md](../spec.md): Town and places; Architecture and modules (positions); Economy (trams free)

**Status:** ready-for-agent

- [ ] Greybox (or kit) layout of home, café, supermarket, convenience store, restaurant, clinic/hospital/pharmacy, park, 2–3 tram stops, bookshop/gift shop, bathhouse/gym and town office/post office.
- [ ] Each place has the staff roles from the places table, with "Press E to talk — <role>" near each available NPC.
- [ ] Windows are lit only while a place is open.
- [ ] Only the Character's current place id is in sim state, and it updates as the Character walks between places. Positions live in the Rapier world.
- [ ] Choosing a tram stop advances the clock by the trip time and moves the Character to that stop (Vitest for the sim side).
- [ ] Trams run 6:00–1:00 and cost nothing. Outside those hours, the stop says no tram is running.
- [ ] The place line updates on arrival, whether the Character walks or takes the tram.
