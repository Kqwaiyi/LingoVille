# 25b — Recommendation within a dietary restriction

**What to build:** At the restaurant, the Player asks the server for a recommendation that fits a dietary restriction (#10) and orders it.

**Blocked by:** 25a — Get a table, order a meal and pay

**Spec:** [spec.md](../spec.md): Goal Interactions (#10)

**Status:** ready-for-agent

- [ ] Interaction #10 (`serve_order`) is defined and works in all four packs.
- [ ] Dietary facts for each dish are pack content, covered by the cross-reference check.
- [ ] The sim rejects an order that breaks the stated restriction (Vitest).
