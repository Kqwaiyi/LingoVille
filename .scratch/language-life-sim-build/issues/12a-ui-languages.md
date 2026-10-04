# 12a — UI in four languages and the Native Language screen

**What to build:** Every UI string in the game so far is available in Japanese, Chinese, English and German. New game opens on a Native Language screen that pre-selects the Player's browser language, and choosing a language switches the whole UI live.

**Blocked by:** None — can start immediately

**Spec:** [spec.md](../spec.md): UI localization; Onboarding (screen 1)

**Status:** done

- [x] react-i18next with typed resources for ja, zh, en and de, covering every UI string so far. `changeLanguage()` switches the UI live.
- [x] Screen 1 pre-selects the first `ja`/`zh`/`en`/`de` base tag in `navigator.languages`, and otherwise English. The choice is stored in device settings.
- [x] A missing key in any of the four resources fails a test.
- [x] German strings fit in the dock and the conversation column.

## Comments

- Until the Player chooses, device settings start in the language `navigator.languages` suggests (`pickNativeLanguage`), so the title is already in it and screen 1 pre-selects whatever device settings hold. Finishing setup stores the language even if the Player kept the pre-selected one, so a second save on the same browser pre-fills it, which is one of 12b's checks.
- `newGame()` now opens setup (`screen: 'setup'`); `finishSetup()` starts the First Morning from the dev setup and `leaveSetup()` goes back. 12b adds its screens between the two.
- A Journal page shows its headings in the Native Language it was written in, even after the Player changes it.
- German fit is checked by `e2e/languages.spec.ts`: nothing in the dock or the conversation column (chat, Help, closing card, Recap) runs out of its box.
- Screen 1 doesn't promise that Settings can change the language: Settings has no Native Language option until 33a.
