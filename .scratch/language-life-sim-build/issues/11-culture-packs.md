# 11 — Four Culture Packs and local prices

**What to build:** The same café becomes a Japanese, Chinese, German or UK café, depending on the save's Culture Pack. The menu, signs, food, currency and small props change, and prices look natural in ¥, 元, € and £. Pointing at a sign or menu within range shows its reading aid and a Translate option.

**Blocked by:** 04 — Order a drink and pay, 10 — Reading aids for Chinese and Japanese

**Spec:** [spec.md](../spec.md): Content model; Economy; Reading aids (world text)

**Status:** done

- [x] Culture Pack schema and data for ja, zh, de and en:
  - menus and goods, with prices as ratios of a Shift's pay;
  - currency and rounding rules, customs, sign strings and opening-hour overrides;
  - ambient one-shot ids, and item glosses in the three other Native Languages;
  - slots for persona localisations and appearance tables.
- [x] Price conversion is ratio × the pack's anchor (¥6,000 / 240元 / €60 / £60 per Shift), rounded to local price points. Starting balances are ¥10,000 / 400元 / €100 / £100.
- [x] The `content` cross-reference check fails when an item an interaction refers to is missing from any pack, when a gloss is missing in any of the three other Native Languages, or when a price doesn't convert.
- [x] Signs and menus are canvas textures generated from pack strings. Pointing at one shows a tooltip with its library reading aid and a Translate option from the authored glosses.
- [x] The dev setup can pick any pack, and the café interaction works in all four.

## Comments

- **2026-10-04, implementation notes.** Items are a shared catalogue (`content/items.ts`: latte, coffee, tea and a café pastry that fills Hunger). Each price ratio is authored once there (drinks 0.05–0.075, the pastry 0.1). Each pack gives every item a local name and glosses. An interaction lists the items it sells (`items`), and its `serve_order` enum is built from that list, so the cross-reference check (`culturePackProblems`) can find an item missing from any pack.
- Prices round to per-pack price steps (¥10 below ¥1,000, 1元 below 100元, €0.10 / £0.05 below 10). The sim charges the rounded menu price (`menuPrice`), not the raw ratio, so the menu, the read-back and the money drop always agree. The check fails a ratio that rounds to nothing or moves more than `ECONOMY.pricePointTolerance`.
- The starting money is now 5/3 Shifts (¥10,000 / 400元 / €100 / £100), so the smoke tests' ¥10,200 became ¥10,000. Money is written the pack's way: ¥450, 18元, 3,60 €, £3.60.
- The order goal now reads "Take the customer's order." because the café sells food. The NPC prompt also gets the pack's opening hours (de 08–18, en 07–18, ja 07–20) and customs. **The prompt snapshots changed, and `npm run eval` hasn't been run** (it needs a real Gemini key).
- Signs (`cafe-name`, `cafe-hours`, `cafe-menu`) are canvas textures painted from `worldSign`. Pointing at one within `MOVEMENT.signReadRangeMetres` shows the tooltip. It stays open for 400 ms after the pointer leaves the sign, and while the pointer is over the tooltip, so Translate can be clicked. Walking out of range always closes it. With no gloss in the Native Language (an en pack for an English speaker), Translate is hidden.
- Dev: `?pack=zh|en|de|ja` picks the pack for New game (`devSetup`, through the store's `newGameSetup` dep). Ticket 12 replaces it with New game setup. The café phrasebooks for zh, en and de are authored too. Appearance tables point at placeholder preset ids (`preset-1`…`4`) until tickets 12 and 30.
