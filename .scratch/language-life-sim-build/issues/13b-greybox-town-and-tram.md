# 13b — Greybox town of 11 places and tram travel

**What to build:** The Player can walk a greybox town with all 11 places, each with placeholders for its staff. "Press E to talk — <role>" appears near each available NPC, and windows are lit only while a place is open. At a tram stop, the Player chooses another stop, time passes, and the Character arrives there. Trams are free and run 6:00–1:00.

**Blocked by:** 13a — Places, opening hours and closing time

**Spec:** [spec.md](../spec.md): Town and places; Architecture and modules (positions); Economy (trams free)

**Status:** done

- [x] Greybox (or kit) layout of home, café, supermarket, convenience store, restaurant, clinic/hospital/pharmacy, park, 2–3 tram stops, bookshop/gift shop, bathhouse/gym and town office/post office.
- [x] Each place has the staff roles from the places table, with "Press E to talk — <role>" near each available NPC.
- [x] Windows are lit only while a place is open.
- [x] Only the Character's current place id is in sim state, and it updates as the Character walks between places. Positions live in the Rapier world.
- [x] Choosing a tram stop advances the clock by the trip time and moves the Character to that stop (Vitest for the sim side).
- [x] Trams run 6:00–1:00 and cost nothing. Outside those hours, the stop says no tram is running.
- [x] The place line updates on arrival, whether the Character walks or takes the tram.

## Comments

- Trams are one place id, `tram-stop`, as 13a left them. The 3 stops (`TRAM_LINE` in `content/townNpcs.ts`: Old Town, Town Centre, Market Street) are content, not sim state. The world knows which platform the Character is on (`tramStopAt`), and it reports that as the interactable. A save keeps only `tram-stop`, so Continue at a tram stop always starts on the first platform (`SPAWN_POINTS`).
- Sim: `rideTram(state, stopsAway, tramHours)` is the rule. It refuses when no tram runs or when `stopsAway` is 0, and otherwise `tick`s the trip time (`tramTripMinutes`, `TRAM.minutesPerStop` in tuning) and sets `placeId: 'tram-stop'`. Money never changes. Only boarding needs a running tram, so the last one may arrive after 01:00.
- Store: E at a stop calls `openTram` (only while the trams run), which shows `TramPanel`. Choosing a stop calls `rideTram(stopId)`, which sets `tramArrival`, and the Character teleports to that platform with the camera snapped. A ride isn't an autosave trigger. The trams' hours are the tram stop's (`selectTramHours`). Outside them the prompt reads "No tram is running · Trams run 06:00–01:00" and E does nothing.
- The park and tram stops are `OPEN_AIR_PLACES` (`content/places.ts`). They have no door, so their hours never keep anyone out, and the place line shows "Tram stop · Closed now" at night instead of staying stuck on the last building.
- Staff: `TOWN_NPCS` (`content/townNpcs.ts`) lists everyone in the places table, with their role, place and whose hours they keep. The landlord keeps the `landlord` service's 8:00–20:00, and passers-by keep the trams' hours. They're all to become Named NPCs (CONTEXT.md) except the passers-by. Only the barista has a persona and a conversation yet, so E on anyone else shows a "nothing to talk about yet" toast (`nothingToSay`). **23a and the tickets that give each role a conversation replace that toast.** i18n `roles.*` is now keyed by role (`RoleId`), not NPC id. The barista's NPC id and role happen to match, so the old `roles.${npcId}` reads still work.
- World: `town.ts` lays out 9 buildings (7 facing the street from the north, the clinic and bathhouse from the south), the park, rails and 3 island platforms down the middle of the street. Home and the café keep their old positions. `interactableAt` picks the tap, then the nearest on-duty person within talk range in the same place, then the platform's stop. Passers-by are only drawn or offered while the trams run, so at night they never hide the "no tram" line. Each building has two front windows that are lit (emissive) only while the place is open. The clinic goes dark at 17:00 even though the Fainting ward stays open; 31b's lighting can revisit that.
- Leaving a building onto the street (no place) leaves the place line on the last place. That was already true and still is.
