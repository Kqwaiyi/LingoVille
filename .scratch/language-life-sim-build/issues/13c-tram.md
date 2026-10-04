# 13c — Tram fast travel

**What to build:** At a tram stop, the Player chooses another stop, time passes, and the Character arrives there. Trams are free and run 6:00–1:00.

**Blocked by:** 13b — Greybox town of 11 places

**Spec:** [spec.md](../spec.md): Town and places; Economy (trams free)

**Status:** ready-for-agent

- [ ] Choosing a stop advances the clock by the trip time and moves the Character to that stop (Vitest for the sim side).
- [ ] Trams run 6:00–1:00 and cost nothing. Outside those hours, the stop says no tram is running.
- [ ] The place line updates on arrival.
