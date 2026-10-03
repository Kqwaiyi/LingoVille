# 11 — Four Culture Packs and local prices

**What to build:** The same café becomes a Japanese, Chinese, German or UK café, depending on the save's Culture Pack. The menu, signs, food, currency and small props change, and prices look natural in ¥, 元, € and £. Pointing at a sign or menu within range shows its reading aid and a Translate option.

**Blocked by:** 04 — Order a drink and pay, 10 — Reading aids for Chinese and Japanese

**Spec:** [spec.md](../spec.md): Content model; Economy; Reading aids (world text)

**Status:** ready-for-agent

- [ ] Culture Pack schema and data for ja, zh, de and en:
  - menus and goods, with prices as ratios of a Shift's pay;
  - currency and rounding rules, customs, sign strings and opening-hour overrides;
  - ambient one-shot ids, and item glosses in the three other Native Languages;
  - slots for persona localisations and appearance tables.
- [ ] Price conversion is ratio × the pack's anchor (¥6,000 / 240元 / €60 / £60 per Shift), rounded to local price points. Starting balances are ¥10,000 / 400元 / €100 / £100.
- [ ] The `content` cross-reference check fails when an item an interaction refers to is missing from any pack, when a gloss is missing in any of the three other Native Languages, or when a price doesn't convert.
- [ ] Signs and menus are canvas textures generated from pack strings. Pointing at one shows a tooltip with its library reading aid and a Translate option from the authored glosses.
- [ ] The dev setup can pick any pack, and the café interaction works in all four.
