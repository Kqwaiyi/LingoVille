# 19d — Combined Shift Recap

**What to build:** When a Shift ends, one combined Recap opens for the whole Shift. It has up to 3 corrections across all customers, new words and one Journal entry. The Shift's results count as listening evidence for Proficiency.

**Blocked by:** 19b — A Shift of single-drink customers

**Spec:** [spec.md](../spec.md): Jobs and Shifts (Shift Recap); Recap and Journal; Decisions made before ticketing (11)

**Status:** ready-for-agent

- [ ] A single `/api/recap` call over the whole Shift's transcript when it ends. The request builder has a snapshot for the Shift case.
- [ ] One Journal entry and one CEFR estimate per Shift.
- [ ] Shift results feed listening evidence into Proficiency (Vitest).
