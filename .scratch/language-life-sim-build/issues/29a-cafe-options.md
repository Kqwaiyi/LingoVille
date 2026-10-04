# 29a — Café orders with options and allergens

**What to build:** At the café, the Player orders a drink and food with options (#2), and orders while avoiding an allergen (#3).

**Blocked by:** None — can start immediately

**Spec:** [spec.md](../spec.md): Goal Interactions (#2, #3)

**Status:** ready-for-agent

- [ ] Interactions #2 and #3 (`serve_order`) are defined, with their effects, and work in all four packs.
- [ ] Item options and allergen facts are pack content, covered by the cross-reference check.
- [ ] The sim rejects an order that contains the stated allergen (Vitest).
