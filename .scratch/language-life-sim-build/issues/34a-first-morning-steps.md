# 34a — First Morning steps and banner

**What to build:** After setup, the Player learns the game by living the first morning in the real town: drink water, walk to the café and order breakfast. A banner at the top centre, with an arrow, a distance and a world marker, shows where to go next. Any equivalent action completes a step. The First Morning can be skipped.

**Blocked by:** 12c — Mic check and the mic-denied path, 17a — Pay for groceries, inventory and expiry, 33b — Pause menu and credits screen

**Spec:** [spec.md](../spec.md): Onboarding (First Morning); UI and HUD

**Status:** ready-for-agent

- [ ] A top-centre banner with an arrow, a distance and a world marker for each step. Prompts never block.
- [ ] Any equivalent action completes a step, for example buying a drink at the supermarket (Vitest).
- [ ] First Morning progress is in the save.
- [ ] The First Morning can be skipped from setup (Skip tutorial) or from the pause menu.
