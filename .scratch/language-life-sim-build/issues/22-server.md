# 22 — Server Job

**What to build:** The Player gets hired at the restaurant (#28) and works server Shifts. They take single dish + drink orders, and serve tables of 2–3 with dietary requests, using an order pad with notes.

**Blocked by:** 20 — Full barista Shift and Job skills

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Life Skills

**Status:** ready-for-agent

- [ ] Hiring interaction #28, with the same name check and retry rules as the barista.
- [ ] Server templates B (single dish + drink) and A (a table of 2–3 with a dietary request).
- [ ] Order pad UI with dietary notes.
- [ ] Exact checks cover every diner's order and note (Vitest).
- [ ] The Server skill's mechanics aid is quick-pick dietary notes.
