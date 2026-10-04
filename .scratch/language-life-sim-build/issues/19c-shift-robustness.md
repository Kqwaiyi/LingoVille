# 19c — Shift saves, reloads and abandonment

**What to build:** A Shift survives problems fairly. It saves after every customer, and a reload ends the Shift with pay for the customers already served. A customer lost to a network drop is replaced and doesn't count. Walking away from a customer counts as a failure.

**Blocked by:** 19b — A Shift of single-drink customers

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Voice pipeline (connection failure); Save model

**Status:** ready-for-agent

- [ ] The Shift saves after every customer (customers served, pay so far).
- [ ] A reload mid-Shift ends the Shift with pay for the customers already served (Vitest on the load path).
- [ ] A network abandonment replaces the customer and doesn't count. A player abandonment counts as a failure and is docked (Vitest).
- [ ] Playwright (mock mode): a network-abandonment path in a Shift.
