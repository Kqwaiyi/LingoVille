# 34b — First café order, closing card and the full smoke test

**What to build:** The First Morning's café order can't fail. The Help tab pulses if the Player goes quiet. Without a mic, the tutorial teaches the Typed Fallback. The morning ends with a card showing the Player's money, "Rent is due on day 7" and a hint that three places are hiring. One end-to-end smoke test proves the whole first session works in mock mode, from a fresh browser to Continue.

**Blocked by:** 34a — First Morning steps and banner

**Spec:** [spec.md](../spec.md): Onboarding (First Morning); Goal Interactions (Patience); Testing Decisions (Playwright smoke)

**Status:** done

- [x] Patience can't run out in the First Morning café order (Vitest).
- [x] The Help tab pulses after about 10 s of silence or the first not-understood turn. Help is pointed to, never forced.
- [x] Without a mic, the tutorial teaches the Typed Fallback. Open mic is never taught here.
- [x] The closing card shows money, "Rent is due on day 7" and the hint that three places are hiring.
- [x] Playwright (mock mode): setup (5 screens) → First Morning → café order with the Typed Fallback → closing card → Recap → Journal entry exists → reload → Continue lands in the same state.
- [x] The existing smoke tests are folded into it or kept, with no duplicated paths.

## Comments

- **The café order.** `isFirstMorningCafeOrder(state, interaction)` (`sim/firstMorning.ts`): any `serveOrder` at the café while the First Morning is under way. Walking in completes the walk, so in practice it's the order on the breakfast step. Hiring at the café isn't an order, and neither is any order once the First Morning is over or skipped.
- **Patience.** `startPatience(step, tier, { canRunOut: false })` for that order. Patience then stops at 1: the barista's face still goes puzzled and strained, and every turn not understood still counts as Proficiency evidence, but the order can't fail.
- **Help pulse.** `helpPulse` on the conversation goes `waiting` → `pulsing` → `found`. It pulses at the first turn not understood (the tool or the unreadable-turn backstop), or after `FIRST_MORNING.helpPulseAfterSilentSeconds` (10 real seconds) with no turn since the barista finished a line. Typing in the field isn't being quiet: each keystroke (`draftTypedLine`) starts the quiet over. Time with the tab hidden doesn't count either. Opening Help makes it `found`, and it never pulses again in that conversation. Help is never opened for the Player. In the column, the tab pulses (no animation with reduced motion), with "Stuck? Try Help" beside it. Only the café order pulses, not other conversations during the First Morning.
- **How to answer.** `selectFirstMorningOrderPrompt`: a line over the input bar until the order is decided. It says `type` (the Typed Fallback: T, type, Enter) without a mic, `holdSpace` with one, and `say` (only "tell the barista what you'd like") with open mic on. **Open mic isn't taught here:** its one-time tooltip isn't offered in the café order, so it comes up at the next conversation. The Typed Fallback's tooltip still shows there as before (it adds how to turn the mic on).
- **Closing card.** `selectFirstMorningCard`, set by a store subscription when the First Morning goes from a step to done (not skipped) during play, never on a load or a new game. It shows back in town once the conversation is over (after its closing card and Recap), and waits behind screens and panels like the tooltips. It's at the top centre where the banner was, under a toast's place, so it doesn't cover the middle of the scene. It shows the money, "Rent is due on day {{day}}" from the save's `rent.dueDay`, and the places hiring: `HIRING_PLACES` in `content`, the places of the hire interactions (café, supermarket, restaurant). The count in "{{number}} places are hiring" comes from that list too, not from the string. It closes with Got it, which has focus.
  - Any way of finishing shows it, for example a meal cooked at home.
  - It isn't saved: a reload before Got it doesn't bring it back. Saving it would need a save migration for a card the Player has mostly read by then.
  - Still not decided (from 34a): the First Morning doesn't end with day 1.
- **Existing tests.** A new game is in the First Morning, so its café order can't fail. The store tests whose order has to fail (`orderDrink`, `recap`) now start with the tutorial skipped, and so does the open mic tooltip test. In e2e, the gibberish test uses `talkToTheBarista(page, { skipTutorial: true })`.
- **Smoke.** `smoke.spec.ts`, "the first session". The mic is refused, and the game goes through all 5 setup screens to the café door (`?spawn=cafe`: starting in the doorway counts as walking there, so the banner asks for breakfast). Then the café order typed, the read-back, nothing charged before confirming, the closing card, See Recap, Done, the First Morning card, the entry in the Journal, reload, and Continue: the same money, the Journal entry, no banner or card, at the café.
  - **Folded into it** (removed where they were, with a comment pointing to the smoke): `continue.spec`'s order, reload, Continue; `orderDrink.spec`'s typed order to the closing card; `micCheck.spec`'s order after a refused mic (that test now ends at the mic check's Start); and `recap.spec`'s Done then J.
  - **New in `firstMorning.spec`:** the café order outlasts more gibberish than A1 Patience allows (no closing card, and the field still takes a line). The nudge shows, and clicking Help hides it for good. It doesn't order: the smoke does that.
  - The 10-second pulse is covered by Vitest with fake timers, not by a real wait in Playwright.
  - Kept: `recap.spec`'s See Recap test orders as setup for checking the lined page (corrections, new words, 🔊). The smoke checks only the Recap's outcome.
  - The full suite passed: 110, plus the one expected failure in `uncaughtErrors.spec.ts`.
