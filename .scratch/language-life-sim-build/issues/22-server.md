# 22 — The server job: single orders and tables with dietary notes

**What to build:** The Player gets hired at the restaurant (#28) and works server Shifts, taking single dish + drink orders on an order pad. Harder customers come as a table of 2–3 with a dietary request, and the Player takes every diner's order and notes on the pad. The Server skill offers quick-pick dietary notes.

**Blocked by:** 20b — Barista skill, translated customers and overwork

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Goal Interactions (#28); Life Skills

**Status:** ready-for-agent

- [ ] Hiring interaction #28, with the same name check and retry rules as the barista.
- [ ] Server template B (single dish + drink).
- [ ] Server template A (a table of 2–3 with a dietary request).
- [ ] Order pad UI, with per-diner orders and dietary notes.
- [ ] The exact check covers the dish and the drink, and for tables every diner's order and note (Vitest).
- [ ] The Server skill earns XP per table, and its mechanics aid is quick-pick dietary notes.
