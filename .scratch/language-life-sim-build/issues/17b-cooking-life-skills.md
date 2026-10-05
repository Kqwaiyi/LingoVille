# 17b — Cooking and Life Skills

**What to build:** At home the Player cooks groceries into a meal. The Cooking skill (0–5 stars) makes home meals more filling and more pleasant, and lowers the risk of food poisoning. A skills page shows all five Life Skills as stars.

**Blocked by:** 17a — Supermarket and convenience store: groceries, inventory, finding an item and counter food, 15 — Sleep, Mood sources and the Mood modifier

**Spec:** [spec.md](../spec.md): Life Skills; Economy

**Status:** done

- [x] Life Skill framework: 5 skills with levels 0–5, an XP curve from the tuning module, XP × the Mood modifier and no decay. Goal Interactions and Small Talk never raise Life Skills (Vitest).
- [x] `cook` uses up groceries. The Hunger it restores depends on Cooking level: less than a bento at level 0, and more than a bento plus a small Mood lift at level 5. It gives XP per meal, at most 3 meals a day (Vitest).
- [x] The food-poisoning risk, which falls with level and rises with expired food, is recorded for Illness.
- [x] A skills page shows each skill as stars.

## Comments

- **Framework:** `sim/lifeSkills.ts` has `lifeSkillLevel(xp)` and `lifeSkillLevels(state)` (public), plus `gainLifeSkillXp` (XP × the Mood modifier) and `todaysCounters` for the gym and Shift work to reuse. XP never goes down anywhere.
- **Cooking:** `cook(state)` only works at home, at the new stove (`HOME_STOVE`, E). Each grocery unit cooks one meal. Sim can't import content, so a grocery is "an inventory item with an expiry day", which holds while only groceries go off. It cooks the fresh grocery that goes off soonest, and uses gone-off food only when nothing fresh is left. Hunger is linear in level, from `LIFE_SKILLS.homeMealHunger.atZero` (0.35, below a bento) to `.atMax` (0.6), with `MOOD.changes.goodHomeMeal` at level 5 only. A 4th meal in a day still cooks but gives no XP. XP uses the Mood before the meal's lift. Cooking takes no game time (the spec doesn't say). With no groceries, the store shows a `nothingToCook` toast.
- **Food poisoning:** only gone-off groceries carry a risk: `ILLNESS.expiredFoodPoisoningChance` at Cooking 0, reduced by up to `cookingFoodPoisoningReductionAtMax` at level 5. It builds up as `character.foodPoisoningChance` (combined as independent chances), and nothing reads it yet. **Illness should roll it and reset it to 0**, and should decide whether cheap food ("more likely from expired or cheap food") or groceries close to expiry add any risk too. Save schema 6 adds the field (migration 5 → 6 sets 0).
- **Skills page:** a Skills button in the dock opens a panel of the 5 skills as ★/☆ (`selectLifeSkillLevels`, memoised by the XP object).
- **Not covered:** Small Talk doesn't exist yet, so only "Goal Interactions never raise Life Skills" is tested. The Small Talk issue should add its half. E2E covers the skills page and the stove with no groceries. Cooking with groceries is tested at the sim and store seams.
- **Tidy-ups from the review (judgement calls):**
  - `Skills()` in `Dock.tsx` copies `Inventory()`'s popover, and `hud.css` lists `.skills` beside every `.inventory` rule. A shared `DockPopover` would remove both.
  - tap/stove/bed is switched on in three places (`interactableAt`, and the key handler and the prompt in `InteractionPrompt.tsx`). One map from interactable to action and prompt key would gather them.
  - `selectLifeSkillLevels` repeats `selectInventory`'s WeakMap memo.
  - `.skills-stars` has a literal colour, not a token.
