# 19c — Shift saves, abandonment and the combined Shift Recap

**What to build:** A Shift survives problems fairly. It saves after every customer, and a reload ends the Shift with pay for the customers already served. A customer lost to a network drop is replaced and doesn't count. Walking away from a customer counts as a failure. When a Shift ends, one combined Recap opens for the whole Shift. It has up to 3 corrections across all customers, new words and one Journal entry, and the Shift's results count as listening evidence for Proficiency.

**Blocked by:** 19b — A Shift of single-drink customers

**Spec:** [spec.md](../spec.md): Jobs and Shifts (including Shift Recap); Voice pipeline (connection failure); Save model; Recap and Journal; Decisions made before ticketing (11)

**Status:** ready-for-agent

- [x] The Shift saves after every customer (customers served, pay so far). Done in 19b: the Shift (customers, served, failed, the customer at the counter) is in the save.
- [x] A reload mid-Shift ends the Shift with pay for the customers already served (Vitest on the load path). Done in 19b (`src/store/shift.test.ts`).
- [ ] A network abandonment replaces the customer and doesn't count. A player abandonment counts as a failure and is docked (Vitest). 19b already does both and tests them in the store; what's left is checking the docks.
- [ ] Playwright (mock mode): a network-abandonment path in a Shift.
- [ ] A single `/api/recap` call over the whole Shift's transcript when it ends. The request builder has a snapshot for the Shift case.
- [ ] One Journal entry and one CEFR estimate per Shift.
- [ ] Shift results feed listening evidence into Proficiency (Vitest).
