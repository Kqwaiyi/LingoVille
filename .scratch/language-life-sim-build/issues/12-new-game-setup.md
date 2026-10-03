# 12 — New game setup and UI languages

**What to build:** New game walks the Player through five screens in their Native Language:

1. Native Language, pre-selected from the browser.
2. Target Language, with its Culture Pack named.
3. A self-assessment sentence, plus the Character's name.
4. An Appearance Preset.
5. A skippable mic check with a live level meter.

Denying the mic switches to the Typed Fallback with nothing locked. The whole UI is available in Japanese, Chinese, English and German.

**Blocked by:** 05 — Speak to NPCs with a real voice, 08 — Save slots, backups, export and import, 11 — Four Culture Packs and local prices

**Spec:** [spec.md](../spec.md): Onboarding; UI localization

**Status:** ready-for-agent

- [ ] react-i18next with typed resources for ja, zh, en and de, covering every UI string so far. `changeLanguage()` switches the UI live.
- [ ] Screen 1 pre-selects the first `ja`/`zh`/`en`/`de` base tag in `navigator.languages`, and otherwise English.
- [ ] Screen 2 offers only the three languages that aren't the Native Language, each naming its pack ("English: set in a UK town").
- [ ] Screen 3 maps four self-descriptions to A1, A2, B1 and B2, and takes the Character's name.
- [ ] Screen 4 is an Appearance Preset picker over the preset pool, with placeholder visuals until ticket 30.
- [ ] Screen 5 is the mic check, with a level meter, a recommendation to use headphones, Skip, and a Skip tutorial option. A denied or missing mic sets the input mode to the Typed Fallback in device settings.
- [ ] `createSave(setup)` builds the save from these answers, replacing the fixed dev setup.
- [ ] A second save on the same browser pre-fills the Native Language, and skips the mic check if it has already passed.
- [ ] German strings fit in the dock and the column.
- [ ] Playwright (mock mode) covers two paths: through the five screens into the town, and a mic-denied path that lands in the Typed Fallback.
