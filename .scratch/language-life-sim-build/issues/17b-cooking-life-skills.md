# 17b — Cooking and Life Skills

**What to build:** At home the Player cooks groceries into a meal. The Cooking skill (0–5 stars) makes home meals more filling and more pleasant, and lowers the risk of food poisoning. A skills page shows all five Life Skills as stars.

**Blocked by:** 17a — Pay for groceries, inventory and expiry, 15b — Mood sources and the Mood modifier

**Spec:** [spec.md](../spec.md): Life Skills; Economy

**Status:** ready-for-agent

- [ ] Life Skill framework: 5 skills with levels 0–5, an XP curve from the tuning module, XP × the Mood modifier and no decay. Goal Interactions and Small Talk never raise Life Skills (Vitest).
- [ ] `cook` uses up groceries. The Hunger it restores depends on Cooking level: less than a bento at level 0, and more than a bento plus a small Mood lift at level 5. It gives XP per meal, at most 3 meals a day (Vitest).
- [ ] The food-poisoning risk, which falls with level and rises with expired food, is recorded for Illness.
- [ ] A skills page shows each skill as stars.
