# 02 — Walk to the café and watch the clock

**What to build:** The Player starts at home in a greybox town with a home and a café, and walks the Character in third person to the café. The dock at the bottom centre shows ring gauges for Health, Hunger, Thirst and Mood, the clock ("Day 1 · weekday") and money. Hunger and Thirst empty as time passes, and Health falls only once one of them hits zero. Tap water at home refills Thirst for free. Switching browser tabs pauses the game.

**Blocked by:** 01 — Project skeleton and guardrails

**Spec:** [spec.md](../spec.md): Sim interface; Time and clock; Well-being and Mood; UI and HUD

**Status:** ready-for-agent

- [ ] `createSave` (with a fixed dev setup for now) returns First Morning state: day 1, 07:00, at home, about 1.7 Shifts of money, Health full, Hunger about 60%, Thirst about 40%, Mood neutral, rent due at the end of day 7, and a seeded RNG state.
- [ ] `tick` empties Hunger over about 1 game day and Thirst over about ½ day. Health drains only while Hunger or Thirst is at 0. The rates come from the tuning module. Vitest covers each rule as state in → state out.
- [ ] `drinkWater` refills Thirst at no cost.
- [ ] Game time advances by real delta × time scale (1 real minute = 1 game hour). Delta is capped at 250 ms, and the scale is 0 while the tab is hidden.
- [ ] R3F with Rapier's kinematic character controller and a third-person camera, colliding with the greybox buildings.
- [ ] The store wires `sim` to the world and UI, which read state only through selectors.
- [ ] The dock shows the four ring gauges, the time, "Day N · weekday" and money.
