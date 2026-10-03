# 04 — Order a drink and pay

**What to build:** The Player orders a drink at the café (Goal Interaction #1) by typing to the mock barista. The barista reads the order back and the Player confirms. The drink is served, payment is taken automatically, Thirst and Mood rise, and a closing card shows something like "Hot latte · −¥450 · Mood ↑". If the Character can't afford it, the barista says so and the conversation continues. Gibberish turns cost hidden Patience. At zero, the barista ends politely and the interaction fails, with a small Mood dip and no charge.

**Blocked by:** 03 — Talk to the barista (mock NPC, typed)

**Spec:** [spec.md](../spec.md): Goal Interactions; Economy; Sim interface

**Status:** done

- [x] `defineInteraction` content schema: place, NPC role, one goal, facts from the Culture Pack, a completion function with typed arguments, a band and the effect on success. One Zod schema produces both the tool declaration and the argument validator, and a `content` test proves it.
- [x] Interaction #1 is defined, with one Culture Pack's café menu. Prices are authored as ratios of a Shift's base pay.
- [x] The prompt requires a read-back and confirmation before the completion function is called, and the mock NPC follows that rule.
- [x] `applyInteractionOutcome` validates the arguments and checks affordability (money is never in the prompt). Success applies payment, the effect and a small Mood boost. Failure has no effect or charge and a smaller Mood dip. Abandonment costs nothing. Vitest covers each case.
- [x] Patience starts from the step table in the tuning module. It drops on `not_understood()` or an empty or unreadable transcript, never on a clarifying re-ask. At 0 the NPC ends the conversation as failed.
- [x] Patience appears only as a placeholder NPC expression (real faces come in ticket 30), never as a number.
- [x] The closing card shows the outcome and effects with Skip Recap and See Recap. See Recap may be disabled until ticket 06.
- [x] Playwright (mock mode): walk to the café, order a drink with the Typed Fallback, then see the closing card and the money drop.

## Comments

**2026-10-03 (implemented):** Zod is now a dependency. `defineInteraction` (`src/content/defineInteraction.ts`) checks the authored data against a Zod schema when it loads: place, NPC, one goal, fact sources, completion, band and effect. The completion's own Zod object produces both the Live tool declaration (`toToolDeclaration` maps Zod's JSON Schema to the OpenAPI subset) and `parseArgs`. `defineInteraction.test.ts` proves the declaration and the validator agree. The effect on success is typed: `serveOrder` only type-checks on a completion whose arguments name menu items, and `none` is flavour only. Interaction #1 uses `serve_order(items[{item, quantity}])`, with the item constrained to the café menu ids.

The café menu (`src/content/cafe.ts`) authors each price once, as a Shift ratio: latte 0.075 (¥450), coffee 0.0625, tea 0.05. Each pack gives local names. All four packs got names so the four-pack snapshots and the mock keep working. The NPC's facts come from `interactionFacts` and list the menu with prices formatted by `formatLocalMoney`. The prompt now requires a read-back with the price, then confirmation, before `serve_order`, and says what each tool answer means (`served`, `cannot_afford`, `invalid_arguments`; `noted` and `out_of_patience` for `not_understood`).

`applyInteractionOutcome(state, interaction, outcome)` lives in `sim`. It validates the arguments, adds up the order, checks affordability, pays, restores Thirst (`WELL_BEING.cafeDrinkThirst`) and lifts Mood. Failure dips Mood without a charge, and abandonment returns the state unchanged. The reported `moodChange` is the change after clamping. `MOOD.changes.goalInteractionFailure` went from −4 to −2, because the spec says the dip must be smaller than the +4 gain. Patience is a sim value type (`startPatience`, `newPlayerTurn`, `losePatience` (at most once per turn, floor 0), `isOutOfPatience`, `npcExpression`) plus the `isUnreadableTranscript` backstop.

The store answers tool calls. The completion goes through `applyInteractionOutcome`, and `not_understood` costs Patience. An unreadable typed turn costs Patience directly, and if that uses up the last of it, `OUT_OF_PATIENCE_SCENE` goes to the NPC instead of the line. A decided outcome is applied at once, and the NPC's next completed turn (the goodbye) closes the session and shows the closing card. Esc, Leave or walking away during the goodbye skips to the card, and Esc or Skip Recap on the card closes it. `VoiceSession` gained `onToolCall` and `sendToolResponse`. The scripted mock recognises a small vocabulary per pack. It reads back a menu item with its price, calls `serve_order` only after a yes, re-asks after a no, and calls `not_understood` for a line with no word it knows.

UI: the column header shows a placeholder face (🙂 relaxed, 😕 puzzled, 😟 strained), labelled for screen readers, and never a number. The closing card replaces the input bar: "Hot latte · −¥450 · Mood ↑" or "No charge · Mood ↓", with Skip Recap and a disabled See Recap. The dock's money now shows minor units when they aren't zero (£97.50), so a purchase never looks rounded away. The Playwright smoke covers the order and the gibberish-to-failure path.

**2026-10-03 (review follow-ups, left for later tickets):**
- The Playwright order starts at the café door (`?spawn=cafe`, the ticket 03 precedent) rather than walking across town from home.
- Ticket 05: `newPlayerTurn` resets the once-per-turn guard on every player turn. A real model's `not_understood` for turn N that arrives after the Player has sent turn N+1 would be charged to turn N+1. Tie tool calls to turns when the real session lands. Also check that the goodbye is the first `turnComplete` after a tool response with real Live.
- Ticket 11: prices aren't rounded to local price points yet, and the starting balance is still 1.7 Shifts (¥10,200), not ¥10,000. Glosses are English-only (`CAFE_ITEMS[*].gloss`). Menus, with their price ratios, should move into the full Culture Pack schema.
- Tickets 09, 23 and 34 cover the deferred Patience rules: frozen while Help is open, +1 for a friend, and the First Morning floor.
- UI strings are still English until i18n (ticket 12). `src/ai` changed, but `npm run eval` doesn't exist yet (ticket 35).
