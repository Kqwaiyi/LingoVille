# 21 — The cashier job: scanning, cash and change

**What to build:** The Player gets hired at the supermarket (#27) and works cashier Shifts. Customers pay for their items, and the Player scans them and toggles bag and points card as asked. Harder customers pay cash and ask for an item from behind the counter: the Player fetches it and picks coins for change in the pack's currency. The Cashier skill suggests coins.

**Blocked by:** 20b — Barista skill, translated customers and overwork

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Goal Interactions (#27); Life Skills

**Status:** ready-for-agent

- [ ] Hiring interaction #27, with the same name check and retry rules as the barista.
- [ ] Cashier template B (pays, bag/points or not).
- [ ] Scanner and toggles UI.
- [ ] Cashier template I (pays cash, item from behind the counter).
- [ ] A coin tray with the pack's denominations, in all four packs.
- [ ] The exact check covers items, toggles, the fetched item and the change (Vitest).
- [ ] The Cashier skill earns XP per customer, and its mechanics aid is coin suggestions.
