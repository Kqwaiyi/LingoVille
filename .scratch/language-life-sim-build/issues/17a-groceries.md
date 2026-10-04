# 17a — Pay for groceries, inventory and expiry

**What to build:** At the supermarket, the Player pays for groceries (#4), choosing a bag and a points card. Groceries go into an inventory and go off after a few days.

**Blocked by:** 13b — Greybox town of 11 places

**Spec:** [spec.md](../spec.md): Goal Interactions (#4); Economy; Save model (inventory)

**Status:** ready-for-agent

- [ ] Interaction #4 (`complete_purchase(bag, card)`) is defined and works in mock and real modes, in all four packs.
- [ ] Inventory records item id, quantity and expiry day. `tick` handles expired items (Vitest).
- [ ] Grocery prices are the cheapest food, at about 0.06 Shift per meal.
- [ ] The Player can see what's in the inventory.
