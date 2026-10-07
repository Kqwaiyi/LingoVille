# 24 — Bookshop and Comfort Purchases

**What to build:** Comfort Purchases exist, and each lifts Mood. At the bookshop, the Player buys a book or magazine (#18), buys a wrapped gift (#19) or asks for a recommendation by taste (#20). Gifts and flowers go into the inventory, ready to give. At the café, cake or a special drink can now be ordered as a Comfort Purchase.

**Blocked by:** 13b — Greybox town of 11 places and tram travel, 15 — Sleep, Mood sources and the Mood modifier

**Spec:** [spec.md](../spec.md): Economy (Comfort Purchases); Goal Interactions (#18, #19, #20)

**Status:** done

- [x] Comfort Purchases are content priced at 0.1–0.3 Shift. Each lifts Mood by an amount set in the tuning module (Vitest).
- [x] Interactions #18 (`complete_purchase`), #19 (`complete_purchase(wrap)`) and #20 are defined and work in all four packs.
- [x] Café cake or a special drink can be ordered at the café as a Comfort Purchase.
- [x] Gift items (wrapped gifts, flowers) are stored in the inventory (Vitest).

## Comments

- **Comfort Purchases as content:** an item with `comfort` (a `ComfortKind`: `cafe`, `reading` or `gift`) is a Comfort Purchase. `COMFORT_PURCHASES` lists them, and `items.test.ts` checks each costs `ECONOMY.comfortPurchaseInShifts` (0.1–0.3), before and after each pack rounds it. The Mood lift per kind is `MOOD.changes.comfortPurchase`. It comes on top of the success lift, once per kind per purchase however many are bought, so buying five cakes doesn't farm Mood. The restaurant meal (25) and the bathhouse (27) add their own kinds.
- **New goods (all four packs, glossed):** the café's `cake` and `special-drink` (`CAFE_COMFORTS`); the bookshop's `mystery-novel`, `cookbook`, `travel-book` and `magazine` (`READING_SOLD`), each with an English `about` (its taste) that every pack's local book keeps to; and the gifts `flowers`, `chocolates` and `scented-candle` (`GIFTS_SOLD`).
- **Café:** `CAFE_MENU` is still the everyday menu that Shift Customers order from. `CAFE_COUNTER` (the menu plus its Comfort Purchases) is what the order interaction and the menu board read. Shift Customers don't order them yet.
- **Bookshop interactions:** all three use the `serveOrder` effect over `complete_purchase`. #19's args add `wrap`, which is flavour only (wrapping is free, like the supermarket's bag). A new fact source, `stock`, writes "For sale: …" lines with each book's taste. The bookshop gets no café `customs`. They read wrong in a shop ("no table service", "tip jar").
- **Gifts are kept:** `OrderLine` now carries `gift` and `comfort`. In `applyInteractionOutcome`, a `purchase` keeps every line as before, and any other order keeps only its gift lines. Gifts never go off (`expiresOnDay: null`), so cooking never picks them.
- **Which key (decided):** there's one shopkeeper, with three Goal Interactions. E sells a book (#18), and from the Advanced band (C1–C2) E is the recommendation (#20) instead. #20's goal also sells a book asked for by name. F buys a gift (#19) at any step, and T chats. `Bringing` gained `step`, which the store passes from `proficiencyStep`. The F prompt reads "Press F to buy a gift" (`prompt.buyGift`, picked by the interaction itself, so a later F that serves an order isn't labelled a gift).
- **Mock:** the shopkeeper reads back a book with its price and sells it with `complete_purchase`. Selling a gift, it first asks whether to wrap it, then reads back the gift, price and wrap (`giftNpc`). `orderNpc` takes the completion's name. All four packs are covered in `mockVoiceSession.test.ts`, with `e2e/bookshop.spec.ts` for the ja smoke.
- **Not done:** prompts changed (the café's FACTS gained cake and a special drink, and there are three new bookshop sessions), so this needs a passing `npm run eval` before merging. It hasn't been run.
