# 17a — Supermarket and convenience store: groceries, inventory, finding an item and counter food

**What to build:** At the supermarket, the Player pays for groceries (#4), choosing a bag and a points card. Groceries go into an inventory and go off after a few days. The Player can also ask where an item is (#5), which puts a marker on it. At the convenience store, the Player buys a counter snack or a heated bento (#7).

**Blocked by:** 13b — Greybox town of 11 places and tram travel

**Spec:** [spec.md](../spec.md): Goal Interactions (#4, #5, #7); Economy; Save model (inventory)

**Status:** done

- [x] Interaction #4 (`complete_purchase(bag, card)`) is defined.
- [x] Inventory records item id, quantity and expiry day. `tick` handles expired items (Vitest).
- [x] Grocery prices are the cheapest food, at about 0.06 Shift per meal.
- [x] The Player can see what's in the inventory.
- [x] Interaction #5 (`point_to(item)`) is defined, and success puts a marker on the item in the world.
- [x] Interaction #7 (`serve_order`) is defined, and success raises Hunger.
- [x] #4, #5 and #7 all work in mock and real modes, in all four packs, and pass the cross-reference check.
