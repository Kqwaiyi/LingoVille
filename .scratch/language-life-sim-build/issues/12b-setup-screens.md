# 12b — Target Language, self-assessment, name and appearance

**What to build:** After choosing a Native Language, the Player picks a Target Language (each one naming its Culture Pack), describes their level in one plain sentence, names their Character and picks an Appearance Preset. The save is built from these answers instead of the fixed dev setup.

**Blocked by:** 12a — UI in four languages and the Native Language screen, 11 — Four Culture Packs and local prices

**Spec:** [spec.md](../spec.md): Onboarding; Sim interface (`createSave`)

**Status:** ready-for-agent

- [ ] Screen 2 offers only the three languages that aren't the Native Language, each naming its pack ("English: set in a UK town").
- [ ] Screen 3 maps four self-descriptions to A1, A2, B1 and B2, and takes the Character's name.
- [ ] Screen 4 is an Appearance Preset picker over the preset pool, with placeholder visuals until ticket 30a.
- [ ] `createSave(setup)` builds the save from these answers, replacing the fixed dev setup (Vitest).
- [ ] A second save on the same browser pre-fills the Native Language.
- [ ] Playwright (mock mode): through the setup screens into the town.
