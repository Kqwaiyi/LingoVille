# 26a — Giving gifts and learning the favourite

**What to build:** In any conversation with a Named NPC, the Player can give a gift from the inventory. One gift per NPC per week counts, and the NPC's favourite counts most. The Player finds out the favourite by asking.

**Blocked by:** 23b — Small Talk and Familiarity, 24 — Bookshop and Comfort Purchases

**Spec:** [spec.md](../spec.md): Named NPCs, Familiarity and NPC Memory

**Status:** done

- [x] `giveGift`: a one-off Familiarity bump, counted once per NPC per week (`lastGiftDay`) and bigger for the favourite (Vitest). `src/sim/familiarity.test.ts`: the gift leaves the inventory, `FAMILIARITY.gift` or `FAMILIARITY.favouriteGift`, a second gift within `giftCooldownDays` is given but doesn't count, each NPC's week is their own, and the bump is outside the daily cap.
- [x] A way to give a gift from the inventory during any conversation with a Named NPC. A **🎁 Gift** button in the input bar opens the gifts held; picking one gives it (`giveGift` in the store, `selectGiftsToGive`), and the NPC is handed it with `giftScene` (`src/store/smallTalk.test.ts`, `e2e/bookshop.spec.ts`).
- [x] `reveal_favourite` is a session tool for Named NPCs and sets `favouriteKnown`. Every Named NPC session offers it (snapshots); the store answers `remembered` and sets `favouriteKnown` (`revealFavourite`).

## Comments

- **Favourites are gifts the bookshop sells (decided with the user).** Each persona now has `favouriteGift`: one of `flowers`, `chocolates` or `scented-candle`, five NPCs each (`src/content/npcs.ts`). Each pack's free-text `favouriteGift` became a local take on that gift ("flowers for the hallway, sweet peas if you can find them"), so the NPC never names a favourite the Player can't buy. `culturePackProblems` checks every pack's text names the persona's gift.
- **What counts:** only a gift given 7 or more days after the last one that counted (`lastGiftDay` is the day of that one). A gift inside the week still leaves the inventory, and the NPC says the Character shouldn't have. A gift is a one-off bump and doesn't use up the per-NPC daily cap, since the favourite's 10 points would otherwise be capped at 6. It lifts no Mood: the spec gives it none.
- **When:** in any conversation with a Named NPC, Small Talk or a Goal Interaction, until its outcome is decided (not while reconnecting). A gift isn't a Small Talk exchange. As with `learn_name`, a gift given mid-conversation is in the live game at once, and a save during the conversation still writes the game from before it.
- **The favourite in the UI:** once the NPC has told it (`favouriteKnown`), the gift list marks that gift "★ Their favourite". Before then, the Player has to ask and understand the answer.
- **`reveal_favourite(gift)`:** it takes the gift as the NPC said it, because Gemini won't take a function with no parameters. The game ignores it: it already knows the favourite.
- **Mock:** any Named NPC thanks the Character for a gift scene (more warmly for the favourite, "you shouldn't have" inside the week), and asked what gift they would like ("好きなプレゼント", "favourite gift", "Lieblingsgeschenk"…), calls `reveal_favourite` and names it by its local name. All four packs are covered in `mockVoiceSession.test.ts`.
- **Prompts changed: needs a passing `npm run eval` before merging.** Every Named NPC session offers `reveal_favourite`, the persona's favourite-gift line now says to tell it when asked, every favourite changed, and gift scenes are new. It hasn't been run.
