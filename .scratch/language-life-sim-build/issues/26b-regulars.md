# 26b — Regulars: "the usual?", "on the house", casual register and park waves

**What to build:** After three identical orders, acquaintances offer "the usual?". A friend occasionally gives something "on the house", at most once a week, and offers once to switch to a casual register (Sie→du, keigo→タメ口), which the Recap notes. Park regulars wave the Player over, at most once a day.

**Blocked by:** 23b — Small Talk and Familiarity, 16 — Fainting, hospital debt and NPC-initiated conversations

**Spec:** [spec.md](../spec.md): Named NPCs, Familiarity and NPC Memory; Town and places (NPCs who start conversations)

**Status:** done

- [x] `usualOrder` is set after the same interaction with the same completion arguments 3 times in a row (Vitest). `recordOrder`, run by `applyInteractionOutcome` on success, keeps the run in NPC Memory's new `lastOrder` (`src/sim/regulars.test.ts`).
- [x] From acquaintance up, the NPC offers "the usual?". An accepted "usual" counts as a normal success with small level evidence (Vitest). `usualOffered` feeds the "You and this person" block (snapshot); a yes is the confirmation, and the completion carries the usual's arguments. The small evidence is the existing short-conversation weighting (`regulars.test.ts`).
- [x] "On the house" flavour from a friend, at most once a week, with no discounts otherwise. `rollOnTheHouse` draws it when a friend takes an order, `onTheHouseGiven` records it once the order is served, and the order costs the same (Vitest).
- [x] At friend tier, the register-switch offer is made once (`registerOffered`) and noted in the Recap (Vitest and a snapshot). `casualRegisterDue` / `casualRegisterOffered`; the Recap request carries `registerOffered` (snapshot), and `src/store/smallTalk.test.ts` covers Small Talk and Goal Interactions.
- [x] Park regulars start a conversation by waving the Player over, at most once a day (Vitest). `parkWaveDue` / `parkWaveMade` (`parkWavedOnDay`), and Small Talk opens with the wave scene.

## Comments

- **What counts as an order:** only `serveOrder` and `orderMeal` Goal Interactions build a usual, so paying the same rent three times never becomes "the usual?". Arguments are compared in a canonical form, so "a latte and a tea" equals "a tea and a latte". "In a row" means in a row of successful orders with that NPC: a failure, an abandon or getting a table in between breaks nothing. The usual is kept through a different order, until another one is made 3 times in a row.
- **Save v15:** NPC Memory gains `lastOrder` (the run toward a usual) and `lastOnTheHouseDay` (the weekly cap), and the save gains `parkWavedOnDay`. The migration starts all three empty.
- **"The usual?"** is offered in the interaction the usual was ordered in, from acquaintance up. A yes is the confirmation: the NPC says the price and calls the completion with exactly the usual. The mock NPC greets a regular with "the usual?" in all four packs and serves it on a yes.
- **On the house:** a friend taking an order draws it from the save's RNG (`FAMILIARITY.onTheHouseChance`, 0.2). It is flavour only: a little something mentioned at hand-over, with the order and price unchanged. The week (`onTheHouseCooldownDays`) counts from an order actually served with it, so an abandoned order uses up nothing.
- **Casual register:** each Culture Pack now has `casualRegister` (de Sie→du, ja 敬語→タメ口, zh 您→你, en Mr / Ms→first names). A friend makes the offer in Small Talk or in a Goal Interaction the Player started, but not when the NPC came over (the landlord about rent, the nurse). It counts as made (`registerOffered`) once that conversation reaches its outcome; leaving early means it is offered again next time. The Recap coach is told about it and notes the milestone in the outcome line. There is no fixed UI line for it. Later sessions speak casually but follow the Player's lead if they keep it formal, since the game doesn't know whether the Player accepted.
- **Park waves:** the first time each day the Character comes into the park, one of the park regulars (drawn from the RNG) waves them over and opens Small Talk, holding the Character still as the landlord does. A Player who is busy at that moment is let by.
- **Prompts changed: needs a passing `npm run eval` before merging.** The usual, on-the-house and register lines in "You and this person", the wave scene, and the Recap's register note are all new. The eval hasn't been run.
