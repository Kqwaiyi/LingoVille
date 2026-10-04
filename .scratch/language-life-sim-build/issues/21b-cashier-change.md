# 21b — Cash, change and items behind the counter

**What to build:** Harder cashier customers pay cash and ask for an item from behind the counter. The Player fetches it and picks coins for change in the pack's currency. The Cashier skill suggests coins.

**Blocked by:** 21a — Cashier hiring and scanning, 20b — Barista skill, translated customers and overwork

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Life Skills

**Status:** ready-for-agent

- [ ] Cashier template I (pays cash, item from behind the counter).
- [ ] A coin tray with the pack's denominations, in all four packs.
- [ ] The exact check covers the fetched item and the change (Vitest).
- [ ] The Cashier skill earns XP per customer, and its mechanics aid is coin suggestions.
