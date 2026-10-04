# 12b — Target Language, self-assessment, name and appearance

**What to build:** After choosing a Native Language, the Player picks a Target Language (each one naming its Culture Pack), describes their level in one plain sentence, names their Character and picks an Appearance Preset. The save is built from these answers instead of the fixed dev setup.

**Blocked by:** 12a — UI in four languages and the Native Language screen, 11 — Four Culture Packs and local prices

**Spec:** [spec.md](../spec.md): Onboarding; Sim interface (`createSave`)

**Status:** done

- [x] Screen 2 offers only the three languages that aren't the Native Language, each naming its pack ("English: set in a UK town").
- [x] Screen 3 maps four self-descriptions to A1, A2, B1 and B2, and takes the Character's name.
- [x] Screen 4 is an Appearance Preset picker over the preset pool, with placeholder visuals until ticket 30a.
- [x] `createSave(setup)` builds the save from these answers, replacing the fixed dev setup (Vitest).
- [x] A second save on the same browser pre-fills the Native Language.
- [x] Playwright (mock mode): through the setup screens into the town.

## Comments

- Setup is one store-driven flow: `setup.step` walks `SETUP_STEPS` (`nativeLanguage → targetLanguage → aboutYou → appearance`) with `setupNext()` / `setupBack()`; `finishSetup()` and `leaveSetup()` are gone. Next stays disabled until a screen is answered (`selectSetupCanGoOn`). The mic check (12c) goes after `appearance`.
- The Target Language is the Culture Pack too. Changing the Native Language to the chosen Target Language forgets it.
- The self-assessment offers `STARTING_STEPS` (A1–B2, in `tuning.ts`), one plain sentence each. Names are trimmed and capped at `CHARACTER_NAME.maxLength`.
- The save's RNG seed comes from the store's `newRngSeed` dep. The `newGameSetup` dep, `devSetup` and the `?pack=` dev parameter are gone: e2e picks the Target Language through setup (`startNewGame(page, { target })`). `DEV_SETUP` stays as the stand-in behind the title screen and the store tests' fixture.
- English can't be learnt in English, so the en pack e2e plays it with German as the Native Language.
- `appearancePresetId` is now typed `AppearancePresetId`, and the save schema checks it against the pool (all existing saves hold `preset-1`).
- Appearance placeholders are CSS head-and-shoulders in each preset's colours (`.appearance-placeholder`), to be replaced in 30a.
