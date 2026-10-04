# 29b — Refunds and tram directions

**What to build:** At the supermarket, the Player returns a faulty item (#6) and gets their money back. At a tram stop, the Player asks which tram goes to a place (#25), which adds a route marker.

**Blocked by:** 17a — Pay for groceries, inventory and expiry, 13c — Tram fast travel

**Spec:** [spec.md](../spec.md): Goal Interactions (#6, #25)

**Status:** ready-for-agent

- [ ] Interaction #6 (`refund(item, reason)`) is defined. Success removes the item from the inventory and refunds its price (Vitest).
- [ ] Interaction #25 (`give_directions(stop)`) is defined. Success adds a route marker.
- [ ] Both work in all four packs.
