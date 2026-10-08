# 29a — Café orders with options and allergens

**What to build:** At the café, the Player orders a drink and food with options (#2), and orders while avoiding an allergen (#3).

**Blocked by:** None — can start immediately

**Spec:** [spec.md](../spec.md): Goal Interactions (#2, #3)

**Status:** done

- [x] Interactions #2 and #3 (`serve_order`) are defined, with their effects, and work in all four packs.
- [x] Item options and allergen facts are pack content, covered by the cross-reference check.
- [x] The sim rejects an order that contains the stated allergen (Vitest).

## Comments

- **Which key (decided):** E at the barista takes the order by the band, as at the bookshop: #1 at A1–A2, #2 (`order-with-options`) at B1–B2 and #3 (`order-avoiding-allergen`) at C1–C2. F stays the hiring application (#26) until the Character is a barista. At the Advanced band the barista asks about food allergies before every order, and the customer can say they have none: #3's `serve_order` takes a required `allergen`, one of `milk`, `egg`, `wheat` or `none`.
- **Options:** #2 and #3 share a café `serve_order` whose lines can say how a drink made to order is made: `size`, `temperature` and `extras`. Coffee and tea are made to order (`MADE_TO_ORDER_EXTRAS` in `items.ts`, which the barista Shift templates now read too). The line schema rejects options on anything else, an extra the drink doesn't take, and a drink made to order with no size or no hot or iced. Options cost nothing and are flavour, apart from what milk adds for an allergy. A new `drinkOptions` fact source names each option by its pack name and id.
- **Allergens are pack content:** each pack has local names for the three allergens (`allergens`) and says which are in each of its café items (`cafeAllergens`), by what the local item is made with: a German Butterbrezel has no egg, a Japanese melon bread does, and the zh mango smoothie has no milk. Adding milk to a drink adds milk (`EXTRA_ALLERGENS`). A new `allergens` fact source tells the barista, naming each allergen by its local name and id. The cross-reference check fails a pack that says nothing of the allergens in an item an allergen-aware interaction sells.
- **Rejection:** `resolveCompletion` rejects a #3 order with the stated allergen in it as `invalid_arguments`, naming the item by its local name and saying it has the allergen in it. Vitest covers it in `src/sim/cafe.test.ts` (and in every pack in `defineInteraction.test.ts`).
- **Prompts:** #2 and #3 get their own read-back rules (how each drink is made, and the allergen), and pass the game's error on. A usual made to order is named with how it's made, and a #3 usual with the allergy, so "the usual?" can be served exactly.
- **Mock:** the fake barista asks about allergies (#3), takes items and options in any order, asks the size and then hot or iced of a drink made to order, reads the whole order back with its total and serves it on a yes. If the game rejects an order, it says what has the allergen in it and takes the rest of the order on. All four packs are covered in `mockVoiceSession.test.ts`. There's no new Playwright smoke: the store and UI paths are #1's.
- **Not done:** prompts changed (two new barista sessions, the `drinkOptions` and `allergens` facts, and the usual's options), so this needs a passing `npm run eval` before merging. It hasn't been run.
- **Left for later:** the closing card and Recap name what was served without its options ("Filter coffee", not "Filter coffee (Large, Iced)").
