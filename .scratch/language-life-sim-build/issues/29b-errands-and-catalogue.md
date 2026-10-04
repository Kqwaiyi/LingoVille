# 29b — Refunds, directions, town office, post office and the catalogue check

**What to build:** At the supermarket, the Player returns a faulty item (#6) and gets their money back. At a tram stop, the Player asks which tram goes to a place (#25), which adds a route marker. At the town office, the Player registers their address (#23). At the post office, they send a parcel home (#24). With these in, every Goal Interaction in the catalogue is in the game, and a test proves it.

**Blocked by:** 13b — Greybox town of 11 places and tram travel, 17a — Supermarket and convenience store: groceries, inventory, finding an item and counter food, 18 — Rent, the Newcomer Discount and the landlord, 24 — Bookshop and Comfort Purchases, 25 — The restaurant: table, meal, bill and dietary recommendations, 27 — Bathhouse, gym and Fitness, 28b — Clinic, pharmacy and the hospital bill, 29a — Café orders with options and allergens

**Spec:** [spec.md](../spec.md): Goal Interactions (#6, #23, #24, #25, catalogue)

**Status:** ready-for-agent

- [ ] Interaction #6 (`refund(item, reason)`) is defined. Success removes the item from the inventory and refunds its price (Vitest).
- [ ] Interaction #25 (`give_directions(stop)`) is defined. Success adds a route marker.
- [ ] Interactions #23 (`register_resident(fields)`) and #24 (`ship(destination, speed)`) are defined, with their effects.
- [ ] #6, #23, #24 and #25 all work in all four packs.
- [ ] Registering an address is recorded in the save, as flavour only.
- [ ] The town office and post office are open 9:00–17:00 on weekdays.
- [ ] A `content` test asserts that all 25 non-hiring Goal Interactions are defined and cross-reference cleanly in every pack.
