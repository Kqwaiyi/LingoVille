# 13a — Places, opening hours and closing time

**What to build:** Every place has opening hours, and Culture Packs can override them. A line above the dock shows the current place and its hours. A closed place can't be entered. Closing time stops new conversations and Shifts from starting, but never cuts one short. In the German pack, nearly everything is shut on Sunday.

**Blocked by:** 11 — Four Culture Packs and local prices

**Spec:** [spec.md](../spec.md): Town and places; Time and clock; Decisions made before ticketing (8)

**Status:** done

- [x] All 11 places and their default hours are content, and packs override them. The de pack closes everything on Sunday except the bathhouse, the Fainting ward, the convenience store and the trams. The restaurant is closed on Mondays (Vitest).
- [x] Closing time only stops new conversations and Shifts from starting; anything already under way finishes (Vitest).
- [x] The place and hours line sits above the dock.
- [x] A closed place can't be entered, and its staff can't be talked to.

## Comments

- `PLACE_IDS` (`sim/state.ts`) now lists all 11 places. Trams are one place id, `tram-stop`; 13b decides whether the 2–3 stops need ids of their own. The world still only builds home and the café: `SPAWN_POINTS` is partial and falls back to home's (`spawnAt`).
- Hours are `OpeningHours` in `sim` (`{ opensAt, closesAt, closedOn: Weekday[] } | null`, null = always open). `closesAt` past 24:00 runs into the next morning, so the trams are `hours(6, 25)`. `isOpen(hours, clock)` is the rule; `enterPlace(state, placeId, hours)` refuses a closed place.
- The defaults are content (`PLACE_HOURS` and `SERVICE_HOURS` in `content/places.ts`). Services are things inside a place with their own hours: the landlord (8:00–20:00) and the Fainting ward (always). Nothing reads them yet: 16 and 18 should, through `placeHours('landlord' | 'fainting-ward', pack)`. Pack overrides replace a whole entry. The de pack shuts the café (8:00–18:00 from ticket 11), supermarket, restaurant, bookshop and landlord on Sunday (the clinic and town office already are by default); home and the park never close.
- The store: its `isPlaceOpen` (`placeHours` + `isOpen`) gates `talk`, and `selectInteractable` hides staff at a closed place, so Press E doesn't show. A conversation already under way is never closed by the clock. **19b's Shift start must check `isPlaceOpen('cafe', game)` the same way.** The Shift half of the Vitest box is therefore 19b's to test: there's no Shift start to gate yet, and nothing ends a Shift on a clock.
- The world: a closed place's doorway gets a solid door, but never while the Character is inside or in the doorway, so they can always walk out at closing time.
- The place line (`PlaceLine` in `Dock.tsx`) is a `role="status"` labelled "Place" above the dock: name · hours · closed days, then Open now / Closed now. Home shows only its name. The café shows its pack name; other places their Native Language name (`places.*`), shared with the title screen's slot cards through `usePlaceName`. en `slots.where` is now "Day 1 · Home" like the other three languages.
- The barista's opening-hours fact now names closed days ("closed on Sundays"), so the de snapshots changed.
- New games start at 07:00 and the de café opens at 08:00, so the First Morning in de reaches a shut café for its first game hour. 34a should decide what the First Morning does about that. For the smoke, a dev-only `?at=9` starts a new game at 09:00 (`devStartHour` dep); `walkToTheBarista` uses it.
