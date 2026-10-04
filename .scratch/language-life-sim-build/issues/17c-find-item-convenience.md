# 17c — Find an item, and the convenience store

**What to build:** At the supermarket, the Player asks where an item is (#5), which puts a marker on it. At the convenience store, the Player buys a counter snack or a heated bento (#7).

**Blocked by:** 17a — Pay for groceries, inventory and expiry

**Spec:** [spec.md](../spec.md): Goal Interactions (#5, #7)

**Status:** ready-for-agent

- [ ] Interaction #5 (`point_to(item)`) is defined, and success puts a marker on the item in the world.
- [ ] Interaction #7 (`serve_order`) is defined, and success raises Hunger.
- [ ] Both work in mock and real modes, in all four packs, and pass the cross-reference check.
