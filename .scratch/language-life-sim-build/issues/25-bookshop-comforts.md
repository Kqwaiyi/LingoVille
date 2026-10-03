# 25 — Bookshop and Comfort Purchases

**What to build:** At the bookshop the Player buys a book or magazine (#18), a wrapped gift (#19) or a recommendation by taste (#20). All five Comfort Purchases work: café cake or a special drink, a book or magazine, a bathhouse visit (ticket 27), a restaurant meal (ticket 24), and flowers or a gift. Each lifts Mood. Gifts go into the inventory.

**Blocked by:** 13 — The whole town: 11 places, hours and trams

**Spec:** [spec.md](../spec.md): Goal Interactions (#18–20); Economy (Comfort Purchases)

**Status:** ready-for-agent

- [ ] Interactions #18–20 are defined and work in all four packs.
- [ ] Comfort Purchases are content priced at 0.1–0.3 Shift. Each lifts Mood by an amount set in the tuning module.
- [ ] Café cake or a special drink becomes orderable at the café as a Comfort Purchase.
- [ ] Gift items (wrapped gifts, flowers) are stored in the inventory, ready for giving in ticket 26.
