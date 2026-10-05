# 17a — Supermarket and convenience store: groceries, inventory, finding an item and counter food

**What to build:** At the supermarket, the Player pays for groceries (#4), choosing a bag and a points card. Groceries go into an inventory and go off after a few days. The Player can also ask where an item is (#5), which puts a marker on it. At the convenience store, the Player buys a counter snack or a heated bento (#7).

**Blocked by:** 13b — Greybox town of 11 places and tram travel

**Spec:** [spec.md](../spec.md): Goal Interactions (#4, #5, #7); Economy; Save model (inventory)

**Status:** done

- [x] Interaction #4 (`complete_purchase(bag, card)`) is defined.
- [x] Inventory records item id, quantity and expiry day. `tick` handles expired items (Vitest).
- [x] Grocery prices are the cheapest food, at about 0.06 Shift per meal.
- [x] The Player can see what's in the inventory.
- [x] Interaction #5 (`point_to(item)`) is defined, and success puts a marker on the item in the world.
- [x] Interaction #7 (`serve_order`) is defined, and success raises Hunger.
- [x] #4, #5 and #7 all work in mock and real modes, in all four packs, and pass the cross-reference check.

## Comments

- **Basket:** the Player takes groceries off the supermarket's shelves with E into a basket (`addToBasket` and `putBackFromBasket` in `sim/basket.ts`, at most `ECONOMY.maxQuantityPerOrderLine` of each). The basket is store state and is never saved. `complete_purchase(bag, card)` charges for the basket the Character brought to the till: the store passes it as `basket` on the success outcome, and `resolveCompletion(raw, packId, basket)` prices it. Going into another place puts everything back. Bags and points cards are free and are flavour only.
- **Cashier:** there's one staff role per counter, so the cashier does both #4 and #5. `interactionStartedWithE('cashier', { shopping })` picks #4 when the basket has anything in it, and #5 when it's empty. The prompt then reads "Press E to pay" instead of "talk". This makes #5 unreachable with shopping in the basket (17c).
- **Effects:** `defineInteraction` has two new effect kinds. `purchase` puts its lines into the inventory instead of consuming them. `pointTo` charges nothing and returns `pointedTo` on the result. The store turns `pointedTo` into `shelfMarker`, which is drawn as a bobbing red cone over `SHELF_SPOTS` (`world/Groceries.tsx`). The marker clears when the Character takes that item or leaves the supermarket. The cashier answers `complete_purchase` with "served", like an order.
- **Expiry:** groceries (items with `meals`) expire `GROCERIES.expiryDays` after the day they were bought. They're gone off after that day (`isGoneOff`) but stay in the inventory, so 17b can cook them at a food-poisoning risk. `tick`, `sleep` and `faint` throw them out once they've been off for `GROCERIES.goneOffDaysKept` days (`throwOutSpoiled`). Content marks each `OrderLine` with `goesOff`, so sim doesn't import content at runtime (that import would create a cycle).
- **Prices and food:** groceries cost 0.06 Shift a meal. The bento costs 0.12 and fills `WELL_BEING.bentoHunger`. The counter snack costs 0.07, which is an invented number: the ratio ladder has none. Groceries fill nothing until they're cooked.
- **Shops by local name:** every shop is now named locally. `localShop` and `localPlaceName` in `content/culturePacks.ts` cover the café, the supermarket and the convenience store. The NPC prompt's FACTS, hints, Recaps, Help's place phrasebook heading and the dock's place line all use them. An always-open place now tells the NPC "X is open 24 hours."
- **Roles:** `convenience-clerk` isn't a role id, so UI labels go through `TOWN_NPCS[npcId].role`.
- **Mock:** `voice/mockVoiceSession.ts` picks its fake NPC from the tools the session offers (`complete_purchase`, `point_to`, `discharge_patient`) and from `voice.npcId` (the clerk or the barista for `serve_order`). The menu is read from the tool declaration's enum.
- **Layout:** the "Keeping your saves" callout moved up to `bottom: 150px`, because the wider dock (now with Inventory) put it over the dock's buttons.
- **Not done:** `npm run eval` hasn't been run against the new goal blocks yet. The behaviour gaps are in 17c.
- **Tidy-ups from the review (judgement calls):**
  - `effect.kind` is checked in several places: `resolveEffect`, `goalBlock`, `applyInteractionOutcome` and three spots in the store. One behaviour map per effect would replace them.
  - The basket total is worked out twice, in `facts.ts` and `BasketPanel.tsx`. It could be a `basketTotal` or a `selectBasketTotal`.
  - `t(\`roles.${TOWN_NPCS[npcId].role}…\`)` is repeated across ConversationColumn, JournalPage and VoiceNotices. It wants a `roleLabel` helper.
  - The "with shopping, the cashier means pay" rule is in both `content/approaches.ts` and `InteractionPrompt.tsx`.
  - `goesOff` is inferred from `meals !== undefined`.
  - `items.test.ts` copies the 0.06 and 0.12 ratios.
  - Basket, Inventory and Groceries aren't in `GLOSSARY.md` yet.
