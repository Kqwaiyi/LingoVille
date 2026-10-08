# 31b — Day–night lighting

**What to build:** Days visibly pass through morning, midday, golden hour and night. Windows and street lights come on at dusk, and a lit window still means a place is open.

**Blocked by:** 31a — Kit art, palette and fog

**Spec:** [spec.md](../spec.md): Art and audio

**Status:** done

- [x] Four keyframed lighting presets, blended by sun angle and colour from the game clock.
- [x] Street lights switch on at dusk.
- [x] Windows are lit only while a place is open, and stand out at night.

## Comments

- **The rule lives in `sim`.** `daylight(minuteOfDay)` (`src/sim/daylight.ts`) says which two presets to blend and how far, where the key light stands, and whether the lamps (street lights and open places' windows) are on. Its times are `DAYLIGHT` in `tuning.ts`: morning in full at 07:00, midday at 12:30, golden hour at 18:00 and night at 20:30; night holds until 05:00, then blends into morning. Tested in `daylight.test.ts`.
- **Sun angle.** The sun rises in the east at 06:00, crosses the southern sky (highest at 12:45) and sets in the west at 19:30. The moon carries on from the west, round the northern sky and back to the east by sunrise. That is backwards for a real moon, but the shadow-casting light hands over without a jump. It never sinks below 0.25 rad, so shadows never stretch the length of the town.
- **What each preset looks like** is in `src/world/Lighting.tsx`, all palette colours: sky and fog, the sun or moon's colour and strength, the sky/ground ambient light and how brightly lamps glow. Morning is blush and butter, midday sky-blue and white, golden hour peach and lamplight, night denim with lavender ambient: dark enough to read as night, light enough to play in. The store's `selectDaylight` is read once a frame through `gameStore.getState()` (never `useGame`: it's a new object each call); `selectLampsOn` re-renders only when it flips.
- **Lamps** come on at 19:00 (between golden hour and sunset) and go off at 06:30 (`lampsOnAt`, `lampsOffAt`). While on, the bulb (the `white` underside of the head, `LAMP_BULBS` in `townArt.ts`) glows lamplight and a soft pool of light lies on the pavement below. No real point lights: twelve of them would weigh on every material in the scene. `tooling/townArt.test.ts` now fails art whose street light has lost its bulb.
- **Windows** come on at dusk, as the ticket's summary asks, and only while their place is open. By day an open place's glass is clear (`sky`); a closed place's is dark (`charcoal`) at any hour, so a lit window always means open. 31a lit open windows all day; that changed here. Lit windows and bulbs share one lamplight material whose glow rises from golden hour into night, so open places stand out after dark. `Piece` takes `open` (the glass) and `lit` (the lamps), and only a wall run's window piece gets them, so nothing else is rebuilt at dusk.
- **No Playwright test**: the change is only visible in the 3D scene, and the smoke has no 3D visual tests. Checked by screenshots at 07:00, 12:30, 18:00, 19:30, 22:00 and 23:00.
- **Title screen**: the live scene behind the title is lit by the store's current clock, like the rest of the scene.
