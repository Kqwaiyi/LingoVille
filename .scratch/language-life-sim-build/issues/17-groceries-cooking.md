# 17 — Groceries, cooking and Life Skills

**What to build:** At the supermarket, the Player pays for groceries (#4, with bag and points-card choices) and asks where an item is (#5, which puts a marker on it). At the convenience store they buy a counter snack or heated bento (#7). At home they cook. Groceries are the cheapest food but go off. The Cooking skill (0–5 stars) makes home meals more filling and more pleasant, and lowers the risk of food poisoning.

**Blocked by:** 13 — The whole town: 11 places, hours and trams, 15 — Sleep, late nights and the Mood modifier

**Spec:** [spec.md](../spec.md): Life Skills; Goal Interactions (#4, #5, #7); Economy

**Status:** ready-for-agent

- [ ] Interactions #4, #5 and #7 are defined and work in mock and real modes.
- [ ] Inventory records item id, quantity and expiry day. `tick` handles expired items.
- [ ] `cook` uses up groceries. The Hunger it restores depends on Cooking level: less than a bento at level 0, and more than a bento plus a small Mood lift at level 5. It gives XP per meal, at most 3 meals a day. The food-poisoning risk, which falls with level, is recorded for Illness.
- [ ] Life Skill framework: 5 skills with levels 0–5, an XP curve from the tuning module, XP × the Mood modifier and no decay. Goal Interactions and Small Talk never raise Life Skills (Vitest).
- [ ] A skills page shows each skill as stars.
