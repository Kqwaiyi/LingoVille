# 21 — Cashier Job

**What to build:** The Player gets hired at the supermarket (#27) and works cashier Shifts. They scan items, toggle bag and points card, fetch items from behind the counter, and pick coins for change in the pack's currency.

**Blocked by:** 20 — Full barista Shift and Job skills

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Life Skills

**Status:** ready-for-agent

- [ ] Hiring interaction #27, with the same name check and retry rules as the barista.
- [ ] Cashier templates B (pays, bag/points or not) and I (pays cash, item from behind the counter).
- [ ] Scanner and toggles UI, plus a coin tray with the pack's denominations.
- [ ] Exact checks cover items, toggles and change (Vitest).
- [ ] The Cashier skill's mechanics aid is coin suggestions.
