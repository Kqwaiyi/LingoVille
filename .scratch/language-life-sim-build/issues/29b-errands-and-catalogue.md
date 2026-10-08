# 29b — Refunds, directions, town office, post office and the catalogue check

**What to build:** At the supermarket, the Player returns a faulty item (#6) and gets their money back. At a tram stop, the Player asks which tram goes to a place (#25), which adds a route marker. At the town office, the Player registers their address (#23). At the post office, they send a parcel home (#24). With these in, every Goal Interaction in the catalogue is in the game, and a test proves it.

**Blocked by:** 13b — Greybox town of 11 places and tram travel, 17a — Supermarket and convenience store: groceries, inventory, finding an item and counter food, 18 — Rent, the Newcomer Discount and the landlord, 24 — Bookshop and Comfort Purchases, 25 — The restaurant: table, meal, bill and dietary recommendations, 27 — Bathhouse, gym and Fitness, 28b — Clinic, pharmacy and the hospital bill, 29a — Café orders with options and allergens

**Spec:** [spec.md](../spec.md): Goal Interactions (#6, #23, #24, #25, catalogue)

**Status:** done

- [x] Interaction #6 (`refund(item, reason)`) is defined. Success removes the item from the inventory and refunds its price (Vitest).
- [x] Interaction #25 (`give_directions(stop)`) is defined. Success adds a route marker.
- [x] Interactions #23 (`register_resident(fields)`) and #24 (`ship(destination, speed)`) are defined, with their effects.
- [x] #6, #23, #24 and #25 all work in all four packs.
- [x] Registering an address is recorded in the save, as flavour only.
- [x] The town office and post office are open 9:00–17:00 on weekdays.
- [x] A `content` test asserts that all 25 non-hiring Goal Interactions are defined and cross-reference cleanly in every pack.

## Comments

- **Which key (decided):** #6 (`return-an-item`, A) is a new key, **R** at the cashier, offered while the Character has nothing to pay for and holds any grocery from the supermarket (gone off or not: the cashier is the one to refuse it). E stays finding an item and F the cashier hiring, so neither is lost. At the town office's clerk, E sends a parcel (#24, `send-a-parcel`, I) and F registers the address (#23, `register-address`, A) until it is registered. E at a passer-by asks the way (#25, `ask-for-directions`, B); passers-by have no Small Talk.
- **Refund (#6):** `refund(item, reason)` over the groceries on the shelves; `reason` is flavour. The sim (`refundItem`) takes one in-date unit out of the inventory and pays back its shelf price in the Character's pack. It refuses an item the Character hasn't got, and one past its date, as `invalid_arguments` naming the item. A new `returns` fact source tells the cashier the policy. The closing card shows `+¥360`.
- **Registration (#23):** `register_resident(fields)` takes `{ name, address, nationality }`. Like hiring, the sim checks the name (`wrong_name` if misheard), and the clerk session has no `learn_name`. Success sets `possessions.addressRegistered` (already in the save, so no migration) and the card says "Address registered". Registering twice is `invalid_arguments`. A `registration` fact source, and each pack's town-office facts (the 転入届, the Anmeldung, the electoral register, 住宿登记), tell the clerk what the form is.
- **Parcel (#24):** `ship(destination, speed)`, speed `sea`, `air` or `express` (`SHIPPING_SPEEDS`), charged at `ECONOMY.postageInShifts` (0.2/0.35/0.6: ¥1,200/¥2,100/¥3,600) converted per pack, `cannot_afford` if short. It lifts Mood by `MOOD.changes.parcelSent` (3) on top of the success boost. Destination is flavour. A `post` fact source gives each speed's price and time.
- **Directions (#25) and the passer-by:** passers-by stay unnamed (GLOSSARY: **Passer-by**). An interaction's `npcId` can now be `'passer-by'` (`InteractionNpcId`), and a conversation partner can be a `PasserById`. `buildPasserBySession` plays a nameless local at their stop (`PASSER_BY_STOPS`) with a Shift Customer voice, offering only `give_directions` and `not_understood`. The sim and store keep no NPC Memory for them (`namedNpcOf`): no Familiarity, usual, on-the-house, casual register, name or gifts. The `tramLine` fact source names each stop by its new pack name (`tramStops` in every pack) and the places to get off for (`STOP_PLACES`, matching the world layout). Success returns `directedTo`, which the store keeps as `routeMarker` (not saved) until the Character reaches that stop's platform, by tram or on foot: a bobbing arrow over its platform, and "Get off here" beside it in the tram panel. Journal goal entries can now name a passer-by, at their stop's local name (`localNpcPlaceName`).
- **Decisions from the review (judgement calls):**
  - #23 is "flavour only", but the clerk's form checks the name like hiring does (`wrong_name`), so getting your own name across is the language task; nothing else depends on it.
  - #24's catalogue row says only "Mood ↑"; the parcel is charged postage, like every other service here, and lifts Mood more than a plain success.
  - A refund pays back the current shelf price, which is what was paid (prices are fixed per pack). Buying and returning is a wash in money, as finding an item is in Mood.
  - The passer-by reads back the stop and waits for the Player to confirm before `give_directions`, as the spec's flow asks.
  - The postage ratios are in the shared price-conversion check (`culturePackProblems`).
  - Left as they were: `buildPasserBySession` repeats `buildNpcSession`'s block list, and each new effect kind is spread over the usual sites (noted in 27 and 28b too).
- **Hours:** the town office already kept 9:00–17:00, closed Saturday and Sunday, in every pack; `content/places.test.ts` and `store/errands.test.ts` now cover it.
- **Catalogue check:** `content/catalogue.test.ts` lists #1–#25 from the spec with their place, completion and band, and runs the cross-reference check over them in all four packs.
- **Removed:** the `nothingToSay` toast. Every town NPC now has something on E, so it could no longer show.
- **Mock:** the cashier hears the item and what is wrong (one line or two) and reads back the refund; the clerk takes the form one field at a time, or the destination then the speed, and reads back; a passer-by names the stop for the place it hears. All four packs in `mockVoiceSession.test.ts`; Playwright smokes in `e2e/directions.spec.ts`, `e2e/townOffice.spec.ts` and the refund in `e2e/groceries.spec.ts`.
- **Not done:** prompts changed (four new sessions, a passer-by builder, four new fact sources, the hint and Recap wording for a passer-by), so this needs a passing `npm run eval` before merging. It hasn't been run, and there are no eval cases for #6, #23, #24 or #25 yet.
