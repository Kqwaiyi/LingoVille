# 25 — The restaurant: table, meal, bill and dietary recommendations

**What to build:** At the restaurant, the Player gets a table (#8), orders a meal (#9) and pays the bill (#11). The Player can also ask the server for a recommendation that fits a dietary restriction (#10) and order it. A restaurant meal is a Comfort Purchase that fills Hunger and lifts Mood.

**Blocked by:** 24 — Bookshop and Comfort Purchases

**Spec:** [spec.md](../spec.md): Goal Interactions (#8, #9, #10, #11); Economy

**Status:** done

- [x] Interactions #8 (`seat_guest`), #9 (`serve_order`), #10 (`serve_order`) and #11 (`settle_bill`) are defined, with their completion functions and effects, and work in all four packs.
- [x] The restaurant menu, with dietary facts for each dish, is pack content, covered by the cross-reference check.
- [x] The sim rejects an order that breaks the stated restriction (Vitest).
- [x] The restaurant meal counts as a Comfort Purchase (Mood) at about 0.25 Shift.
- [x] The restaurant is closed on Mondays.

## Comments

- **Table and bill in the save (v13):** `GameState.restaurant` is `{ seated, bill }`. #8 seats the Character. #9 and #10 serve the meal on the spot (Hunger, Thirst, Mood) and put it on the bill rather than charging. #11 charges the whole bill at menu prices, then the Character leaves the table. Walking out (or fainting) gives up the table, but an unpaid bill stays open until it's paid. It isn't debt and costs no Mood. The migration from v12 gives every save no table and an empty bill.
- **Effects:** three new effect kinds: `seatGuest`, `orderMeal` and `settleBill`. `orderMeal` is only served to a seated Character, and only if the bill could be paid with it on (otherwise `cannot_afford`). The sim passes its own bill to `resolveCompletion`, so the price conversion stays in content and the bill is never something the store or the model supplies.
- **Dietary check:** #10's `serve_order` takes a required `restriction` (a `DietaryNoteId`). `resolveCompletion` rejects any dish that breaks it with `invalid_arguments`, naming the dish and what's in it, and the NPC is told to recommend one that keeps to it. A new fact source, `dietary`, tells the server what's in each dish and which needs it suits, from `Item.contains` (#22's dietary facts). Every pack's local dish keeps to these facts.
- **Comfort Purchase:** the four dishes have `comfort: 'meal'` (`MOOD.changes.comfortPurchase.meal`, 5). A drink on its own isn't a Comfort Purchase. In every pack a dish and a drink come to about 0.25 Shift once rounded (`items.test.ts`).
- **Which key (decided):** E at the server takes the bill while anything is on it, takes the order at the Character's table, and otherwise gets a table. F at the table asks for a recommendation (at any step, labelled "Press F to ask for a recommendation"). Away from a table, F is still the hiring application (#28) until the Character is a server. T chats. E is labelled "Press E to pay" for the bill.
- **No café customs:** the restaurant interactions don't get the café's `customs` facts, which say there's no table service and mention a tip jar.
- **Mock:** the server asks how many and where to sit, reads both back and calls `seat_guest`. It takes a meal order the barista's way. For a recommendation, it asks what the guest doesn't eat, recommends the first dish that keeps to it and, if the game rejects a dish the guest named, recommends one that fits. It reads the bill total from FACTS (`readBillTotal`) and asks cash or card. All four packs are covered in `mockVoiceSession.test.ts`, and `e2e/restaurant.spec.ts` is the ja smoke (table → meal → bill).
- **Closed Mondays** was already in `places.ts` and `places.test.ts` (from 13a), in all four packs. The de pack also closes on Sundays.
- **No tipping in en:** the en restaurant's `placeFacts` (from #22) said "Tipping about 10% is usual for table service", against the spec's "en (UK), with no tipping". It now says there is no tipping. The server hiring and Shift prompts read it too.
- **#10 with nothing to avoid:** the goal tells the server to say everything on the menu is fine. The completion needs a restriction, so that conversation ends without one.
- **Open question (walking out):** a meal is eaten when it's ordered and paid for with the bill, and walking out with the bill unpaid costs nothing (the bill stays open, the server won't seat the Character again until it's paid). Whether walking out should cost something (charge the bill, debt, a Mood hit) is a design decision still to make: [25b](25b-restaurant-walk-out.md).
- **Not done:** prompts changed (four new server sessions and the `dietary` and `bill` facts), so this needs a passing `npm run eval` before merging. It hasn't been run.
