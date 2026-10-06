# 20b — Barista skill, translated customers and overwork

**What to build:** The Barista skill rises with each customer served well. It raises pay by 6% a level and makes the grid easier to use, but never helps with listening. Translating a customer's order and then serving it correctly pays normally, minus half a dock. Working too many days in a week costs Mood.

**Blocked by:** 20a — Customer mix and harder barista orders, 17b — Cooking and Life Skills

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Life Skills; Help

**Status:** done

- [x] Barista skill XP is earned per successful customer. Each level adds 6% to pay and unlocks mechanics aids only: a grouped grid and a remembered size (Vitest for pay).
- [x] A tap-translated customer served correctly pays the per-customer amount minus half the failure dock, and gives no listening evidence. Vitest includes the A1–A2 case, where the dock is zero.
- [x] In Shifts, hints for the Player's own lines are free.
- [x] Overwork (working 5–6 days a week) gives a Mood penalty, set in the tuning module (Vitest).

## Comments

- **XP and raise:** `applyShiftCustomer` gives the Job's Life Skill `LIFE_SKILLS.xpPerShiftCustomer` (× Mood modifier) for each customer served correctly, translated or not. `endShift` multiplies what was earned by `1 + ECONOMY.jobLifeSkillPayRaisePerLevel × level`, read at the end of the Shift. The raise applies to earnings, not to docks.
- **Aids:** `jobAids(state, jobId)` (sim) reads `LIFE_SKILLS.jobAidsFromLevel` (default: grouped grid at Barista 1, remembered size at 2). The grouped grid splits the café menu into Drinks and Food (`selectShiftMenu` now returns groups). The remembered size starts each new customer at the size last set this Shift. Hot/iced and extras still reset. Neither aid touches the order or the customer's lines.
- **Translated customers:** `applyShiftCustomer(state, served, { translated })`. The store passes `translated` when the Player tapped Translate on any of the customer's lines before serving. `Shift.translated` counts those served correctly. Each is docked `ECONOMY.translatedCustomerDockShare` (0.5) of the step's failure dock, so there's no dock at A1–A2. A translated customer served wrongly is one ordinary failure. For listening evidence (`applyShiftEvidence`), a customer with **any** translated line now counts for nothing. Before, they counted in proportion to the untranslated share. This applies to customers served wrongly too, so a translated miss no longer pulls the score down. A line translated after the customer was dealt with (while they say goodbye) is reading back: it isn't logged as Help, so the dock and the evidence agree. Translating any line counts, the greeting included, because the ticket's "tap-translated customer" doesn't single out the order line.
- **Hints at a Shift:** `HintRequest` is now a union: `interactionId` (Goal Interaction) or `jobId` (Shift). The Shift prompt writes the staff member's own lines only, and never says, repeats back, guesses or translates the order. Mock mode has canned barista lines. Hints cost nothing (Help is free), and a store test pins full pay after reading them at B1. **The hint prompt changed: needs a passing `npm run eval` before merging.** There are no hint eval cases yet, so a Shift hint case is worth adding.
- **Overwork:** `progression.shiftDays` keeps the days a Shift was paid in the last week. `endShift` takes `MOOD.overworkPenaltyPerShift` once that reaches `MOOD.overworkDaysPerWeek` within `MOOD.overworkWeekDays` (7, today included). The penalty is taken after pay and clamped at 0. A Shift cancelled before any customer (no voice service) doesn't count.
- **Save v10:** adds `shift.translated` (0) and `progression.shiftDays` (seeded from `lastShiftDay`).
- **Review tidy-ups not done (judgement calls):** `'jobId' in request` is tested in both `ai/hint.ts` and the gateway's mock; a `kind` discriminant or a type guard would keep that test in one place. `lifeSkillLevel(xp[jobId])` appears in both `jobAids` and `endShift`. `endShift` now also works out overwork. The Shift hint prompt's examples (size, hot or iced) and `the ${jobId}` wording are barista-specific, so tickets 21 and 22 should give each Job its own role name and examples. Older saves know only their last Shift day, so overwork undercounts during their first week.
- **Not covered:** the Shift-end card doesn't show XP gained or the overwork Mood. The Playwright smoke doesn't cover the grouped grid; it's tested at the store seam.
