# 34a — First Morning steps and banner

**What to build:** After setup, the Player learns the game by living the first morning in the real town: drink water, walk to the café and order breakfast. A banner at the top centre, with an arrow, a distance and a world marker, shows where to go next. Any equivalent action completes a step. The First Morning can be skipped.

**Blocked by:** 12c — Mic check and the mic-denied path, 17a — Supermarket and convenience store: groceries, inventory, finding an item and counter food, 33a — Settings, pause menu and credits

**Spec:** [spec.md](../spec.md): Onboarding (First Morning); UI and HUD

**Status:** done

- [x] A top-centre banner with an arrow, a distance and a world marker for each step. Prompts never block.
- [x] Any equivalent action completes a step, for example buying a drink at the supermarket (Vitest).
- [x] First Morning progress is in the save.
- [x] The First Morning can be skipped from setup (Skip tutorial) or from the pause menu.

## Comments

- **Steps.** `FIRST_MORNING_STEPS` in `sim/firstMorning.ts`: `drink`, `walkToCafe`, `breakfast`. `firstMorningStep(state)` is the one to do, or null once it's over or skipped. The save keeps a count (`onboarding.firstMorningStepsDone`), so steps are done in order.
- **Equivalent actions.** The sim's own actions do the steps, through `completeFirstMorningStep`:
  - **The drink:** `drinkWater`, or anything drunk in an order.
  - **The walk:** `enterPlace` into the café.
  - **Breakfast:** any café order (even just a drink), food eaten anywhere, or a meal from `cook`.
  - A step done also completes every step before it, so the prompts never send the Player back. For example, walking into the café first skips the drink, and a bento at the convenience store ends the morning.
  - Failures, groceries (which fill nothing until cooked) and anything else that fills no meter don't count.
- **The ticket's example doesn't exist in this game.** The supermarket sells no drinks (`GROCERIES_SOLD` is vegetables, eggs and noodles), so "buying a drink at the supermarket" can't happen. The Vitest uses a juice at the restaurant instead. If the supermarket ever sells a drink, a `purchase` of it would count, because the rule reads what an order restores, not where it was bought.
- **Save.** `onboarding` was already in the save. Doors and outcomes save as before. At home, drinking water or cooking saves at once when it does a step (`setGameSavingFirstMorning`), so a reload right after doesn't lose it.
- **Skip.**
  - **From setup:** the existing Skip tutorial checkbox, now covered end to end (`skipTutorial` in `e2e/title.ts`).
  - **From the pause menu:** "Skip the tutorial" shows in `.pause-actions` while a step is left (`selectSkippableFirstMorning`). It skips the rest, saves and resumes.
- **Banner.**
  - `FirstMorningBanner` is a pill at the top centre: an arrow, the step's prompt, and the distance in metres. It's a `region` named "First Morning", with `pointer-events: none`.
  - `selectFirstMorningBanner` hides it under the same screens and panels as the tooltips (the shared `inTownUncovered`), and in conversations too. The café order's guidance is 34b's.
  - A toast shows below the banner rather than over it.
- **Marker and guide.**
  - `FirstMorningMarker` (`world/Marker.tsx`) puts the red arrow over the step's spot: the tap, then the café door, then the barista.
  - From outside a spot's place, where its roof would hide the arrow, the marker hangs over the place's door instead.
  - Each frame it measures the distance and the bearing against the camera (rounded to the metre and to 5°), and passes them to the store as `firstMorningGuide`, which changes only when the rounded values do. The guide is never saved.
- **Not decided:** the First Morning doesn't end with day 1. Ignored, its banner stays until it's done or skipped. 34b's closing card may want to settle this.
- **Smoke.** `e2e/firstMorning.spec.ts`:
  - the banner's prompt and distance; the tap, then the café; the step kept through Continue;
  - Skip the tutorial in the pause menu, gone for good after Continue;
  - Skip the tutorial at setup.
  - The full suite passed: 110, plus the one expected failure in `uncaughtErrors.spec.ts`.
