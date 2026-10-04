# 28c — Pharmacy and cures

**What to build:** At the pharmacy, the Player gets medicine (#14). The right medicine cures at once, but the wrong one doesn't cure at all. Flu is different: the fever reducer stops the Health drain at once, and the flu clears only after the next sleep.

**Blocked by:** 28b — Clinic check-in and diagnosis, 15a — Bed and sleep

**Spec:** [spec.md](../spec.md): Illness; Goal Interactions (#14); Decisions made before ticketing (7)

**Status:** ready-for-agent

- [ ] Interaction #14 (`dispense(medicine)`) is defined and works in all four packs.
- [ ] `dispense` cures only if the medicine matches the Illness (Vitest).
- [ ] The fever reducer stops flu's Health drain at once, but the flu clears only after the next sleep (Vitest).
