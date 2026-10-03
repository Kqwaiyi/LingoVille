# 34 — First Morning

**What to build:** After setup, the Player learns the game by living the first morning in the real town: drink water, walk to the café and order breakfast. A banner at the top centre with an arrow and a world marker shows where to go next, and any equivalent action completes a step. The first café order can't fail. The Help tab pulses if the Player goes quiet. The morning ends with a card showing the Player's money, "Rent is due on day 7" and a hint that three places are hiring.

**Blocked by:** 09 — Help tab, 12 — New game setup and UI languages, 17 — Groceries, cooking and Life Skills, 33 — Settings, pause menu and tooltips

**Spec:** [spec.md](../spec.md): Onboarding (First Morning); UI and HUD

**Status:** ready-for-agent

- [ ] A top-centre banner with an arrow, a distance and a world marker for each step. Prompts never block.
- [ ] Any equivalent action completes a step (for example, buying a drink at the supermarket).
- [ ] Patience can't run out in the First Morning café order.
- [ ] The Help tab pulses after about 10 s of silence or the first not-understood turn. Help is pointed to, never forced.
- [ ] Without a mic, the tutorial teaches the Typed Fallback. Open mic is never taught here.
- [ ] The First Morning can be skipped from setup or from the pause menu. Its progress is in the save.
- [ ] The closing card shows money, "Rent is due on day 7" and the hint that three places are hiring.
- [ ] Full Playwright smoke test in mock mode: setup → First Morning → café order with the Typed Fallback → closing card → Recap → Journal entry exists → reload → Continue lands in the same state.
