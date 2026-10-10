# 33b — One-time tooltips

**What to build:** One-time tooltips explain new systems the first time they come up, and never repeat on that browser. They can all be turned off.

**Blocked by:** 33a — Settings, pause menu and credits, 16 — Fainting, hospital debt and NPC-initiated conversations, 19b — A Shift of single-drink customers

**Spec:** [spec.md](../spec.md): Onboarding (tooltips); UI and HUD

**Status:** done

- [x] The tooltip system shows cards above the dock with "Got it".
- [x] It covers Shifts, Fainting, the Journal (after the first Recap closes), open mic and the Typed Fallback.
- [x] Seen tooltips are stored per browser and never repeat in another save. All tooltips can be turned off, and they fire even if the tutorial was skipped.

## Comments

- **Store.** `offerTooltip(id)` is called where each system first comes up: `startShift` (`shift`), `wakeInWard` (`fainting`), `openConversation` in the Typed Fallback (`typedFallback`) or with open mic (`openMic`), and wherever a Recap closes (`journal`): Done, Skip Recap, Leave or Esc on the closing card (`endAndOfferJournal`), and closing a Shift's pay card that has a Recap. A failed Recap counts too, since its conversation still goes to the Journal. A conversation ended by Fainting doesn't offer it: the Player never closed that Recap.
- **Seen.** `offerTooltip` reads the device settings and drops any id in `tooltipsSeen`, so a tooltip never shows twice on a browser, in any save. Tooltips that come up together wait in `tooltipsDue` and show one at a time (Got it is `dismissTooltip`). `selectTooltip` hides the card behind the pause menu, the Journal, the Fainting screen, the voice-unavailable screen, the tram panel and a Shift's pay card. An id counts as seen once the card is actually visible (a store subscription), so one still waiting behind a screen when the page closes comes back later. `markSeen` is shared with the persist-refused callout.
- **Off.** With tooltips off, nothing is offered or marked seen, so a tooltip still comes up the first time its system does after they're turned back on. Turning them off clears the queue and hides the card. Nothing reads the tutorial state, so they fire after Skip tutorial too (tested through setup).
- **UI.** `TooltipCard` sits centred above the dock, above the "Press E" prompt line, at `bottom: 204px`. In a conversation it centres on the scene left of the column, like the dock. It's a `status` named by its title. The strings are under `tooltip.*` in all four languages.
- **Not covered.** No store test covers the Journal tooltip after a Shift's Recap (the code path is `closeShiftEnd`). Open mic and Shifts are tested only in the store: the mock ignores open mic, and the Shift smoke is long.
- **Smoke.** `e2e/tooltips.spec.ts`: the Typed Fallback card shows above the dock and doesn't come back in a new save in another tab; the Journal card shows after Skip Recap; the Fainting card shows after Wake up; with tooltips off, none show. One full run failed `server.spec.ts`'s hiring step (the mock answered "仕事はありますか？" with the menu greeting, as 33a saw in `shift.spec.ts`). It passed 3/3 on repeat, and 106 others passed.
