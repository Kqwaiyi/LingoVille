# 29c — Town office, post office and the catalogue check

**What to build:** At the town office, the Player registers their address (#23). At the post office, they send a parcel home (#24). With these in, every Goal Interaction in the catalogue is in the game, and a test proves it.

**Blocked by:** 17c — Find an item, and the convenience store, 18b — Extensions, hallway reminders and step-downs, 24b — Wrapped gifts and recommendations by taste, 25b — Recommendation within a dietary restriction, 27b — Gym membership and Fitness, 28c — Pharmacy and cures, 28d — Hospital bill and payment plans, 29a — Café orders with options and allergens, 29b — Refunds and tram directions

**Spec:** [spec.md](../spec.md): Goal Interactions (#23, #24, catalogue)

**Status:** ready-for-agent

- [ ] Interactions #23 (`register_resident(fields)`) and #24 (`ship(destination, speed)`) are defined, with their effects, and work in all four packs.
- [ ] Registering an address is recorded in the save, as flavour only.
- [ ] The town office and post office are open 9:00–17:00 on weekdays.
- [ ] A `content` test asserts that all 25 non-hiring Goal Interactions are defined and cross-reference cleanly in every pack.
