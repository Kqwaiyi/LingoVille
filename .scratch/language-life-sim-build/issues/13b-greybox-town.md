# 13b — Greybox town of 11 places

**What to build:** The Player can walk a greybox town with all 11 places, each with placeholders for its staff. "Press E to talk — <role>" appears near each available NPC, and windows are lit only while a place is open.

**Blocked by:** 13a — Places, opening hours and closing time

**Spec:** [spec.md](../spec.md): Town and places; Architecture and modules (positions)

**Status:** ready-for-agent

- [ ] Greybox (or kit) layout of home, café, supermarket, convenience store, restaurant, clinic/hospital/pharmacy, park, 2–3 tram stops, bookshop/gift shop, bathhouse/gym and town office/post office.
- [ ] Each place has the staff roles from the places table, with "Press E to talk — <role>" near each available NPC.
- [ ] Windows are lit only while a place is open.
- [ ] Only the Character's current place id is in sim state, and it updates as the Character walks between places. Positions live in the Rapier world.
