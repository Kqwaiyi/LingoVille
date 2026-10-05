# 19c — Shift saves, abandonment and the combined Shift Recap

**What to build:** A Shift survives problems fairly. It saves after every customer, and a reload ends the Shift with pay for the customers already served. A customer lost to a network drop is replaced and doesn't count. Walking away from a customer counts as a failure. When a Shift ends, one combined Recap opens for the whole Shift. It has up to 3 corrections across all customers, new words and one Journal entry, and the Shift's results count as listening evidence for Proficiency.

**Blocked by:** 19b — A Shift of single-drink customers

**Spec:** [spec.md](../spec.md): Jobs and Shifts (including Shift Recap); Voice pipeline (connection failure); Save model; Recap and Journal; Decisions made before ticketing (11)

**Status:** done

- [x] The Shift saves after every customer (customers served, pay so far). Done in 19b: the Shift (customers, served, failed, the customer at the counter) is in the save.
- [x] A reload mid-Shift ends the Shift with pay for the customers already served (Vitest on the load path). Done in 19b (`src/store/shift.test.ts`).
- [x] A network abandonment replaces the customer and doesn't count, with a "The customer had to step away" toast. A player abandonment counts as a failure and is docked (Vitest, at B1 where the dock isn't 0).
- [x] Playwright (mock mode): a network-abandonment path in a Shift.
- [x] A single `/api/recap` call over the whole Shift's transcript when it ends. The request builder has a snapshot for the Shift case. Each customer carries their order and how the sim's exact check found them served; one lost to the network isn't sent. It opens with the pay on the Shift-end card. A reload saves no conversations, so a Shift it ends has no Recap.
- [x] One Journal entry and one CEFR estimate per Shift. Journal entries are v4: a `shift` kind beside `goal`, with every customer's lines in order.
- [x] Shift results feed listening evidence into Proficiency (Vitest). `applyShiftEvidence`: serving every order is evidence of the step the customers spoke at, each missed one pulls lower (`PROFICIENCY.shiftListening`), and lines the Player had translated count for nothing as listening. The whole Shift counts as one piece of evidence.
