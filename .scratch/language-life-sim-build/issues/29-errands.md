# 29 — Errands: the rest of the catalogue

**What to build:** The remaining Goal Interactions work:

- at the café, a drink and food with options (#2) and an order that avoids an allergen (#3);
- at the supermarket, returning a faulty item (#6);
- at the town office, registering an address (#23);
- at the post office, sending a parcel home (#24);
- at a tram stop, asking which tram goes to a place (#25), which adds a route marker.

**Blocked by:** 13 — The whole town: 11 places, hours and trams

**Spec:** [spec.md](../spec.md): Goal Interactions (#2, #3, #6, #23, #24, #25)

**Status:** ready-for-agent

- [ ] Interactions #2, #3, #6, #23, #24 and #25 are defined, with their completion functions and effects, and work in all four packs.
- [ ] Registering an address is recorded in the save, as flavour only.
- [ ] A `content` test asserts that all 25 non-hiring Goal Interactions are defined and cross-reference cleanly in every pack.
