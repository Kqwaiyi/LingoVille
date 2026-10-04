# 24 — Bookshop and Comfort Purchases

**What to build:** Comfort Purchases exist, and each lifts Mood. At the bookshop, the Player buys a book or magazine (#18), buys a wrapped gift (#19) or asks for a recommendation by taste (#20). Gifts and flowers go into the inventory, ready to give. At the café, cake or a special drink can now be ordered as a Comfort Purchase.

**Blocked by:** 13b — Greybox town of 11 places and tram travel, 15 — Sleep, Mood sources and the Mood modifier

**Spec:** [spec.md](../spec.md): Economy (Comfort Purchases); Goal Interactions (#18, #19, #20)

**Status:** ready-for-agent

- [ ] Comfort Purchases are content priced at 0.1–0.3 Shift. Each lifts Mood by an amount set in the tuning module (Vitest).
- [ ] Interactions #18 (`complete_purchase`), #19 (`complete_purchase(wrap)`) and #20 are defined and work in all four packs.
- [ ] Café cake or a special drink can be ordered at the café as a Comfort Purchase.
- [ ] Gift items (wrapped gifts, flowers) are stored in the inventory (Vitest).
