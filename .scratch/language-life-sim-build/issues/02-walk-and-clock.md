# 02 — Walk to the café and watch the clock

**What to build:** The Player starts at home in a greybox town with a home and a café, and walks the Character in third person to the café. The dock at the bottom centre shows ring gauges for Health, Hunger, Thirst and Mood, the clock ("Day 1 · weekday") and money. Hunger and Thirst empty as time passes, and Health falls only once one of them hits zero. Tap water at home refills Thirst for free. Switching browser tabs pauses the game.

**Blocked by:** 01 — Project skeleton and guardrails

**Spec:** [spec.md](../spec.md): Sim interface; Time and clock; Well-being and Mood; UI and HUD

**Status:** done

- [x] `createSave` (with a fixed dev setup for now) returns First Morning state: day 1, 07:00, at home, about 1.7 Shifts of money, Health full, Hunger about 60%, Thirst about 40%, Mood neutral, rent due at the end of day 7, and a seeded RNG state.
- [x] `tick` empties Hunger over about 1 game day and Thirst over about ½ day. Health drains only while Hunger or Thirst is at 0. The rates come from the tuning module. Vitest covers each rule as state in → state out.
- [x] `drinkWater` refills Thirst at no cost.
- [x] Game time advances by real delta × time scale (1 real minute = 1 game hour). Delta is capped at 250 ms, and the scale is 0 while the tab is hidden.
- [x] R3F with Rapier's kinematic character controller and a third-person camera, colliding with the greybox buildings.
- [x] The store wires `sim` to the world and UI, which read state only through selectors.
- [x] The dock shows the four ring gauges, the time, "Day N · weekday" and money.

## Comments

**2026-10-03 (implemented):** Sim rules are in `src/sim` (`createSave`, `tick`, `drinkWater`, `gameMinutesFor`, `weekdayOf`), with Vitest per rule. Money is held in Shifts in sim state (`moneyInShifts`); `content/currency.ts` converts it with each pack's Shift anchor for display, so the dev save shows ¥10,200 rather than the pack's rounded ¥10,000 until ticket 11 adds local price points. Day 1 is a Monday. `drinkWater` only works with `placeId` home. The place id is the last building interior the Character entered (walking onto the street keeps it). The store (`src/store/gameStore.ts`) holds the tab-hidden flag and the nearby interactable; the time scale is a selector, ready for the conversation and Help scales. Greybox buildings have no roofs so the follow camera can see in; drag the mouse to orbit, WASD/arrows to walk. Walk speed and interact range are in `tuning.ts` (`MOVEMENT`). Dock strings are English until i18n lands (ticket 12). Playwright covers the dock, the clock pausing on a hidden tab, and walking to the tap and pressing E.
