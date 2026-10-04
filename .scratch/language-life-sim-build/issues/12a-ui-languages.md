# 12a — UI in four languages and the Native Language screen

**What to build:** Every UI string in the game so far is available in Japanese, Chinese, English and German. New game opens on a Native Language screen that pre-selects the Player's browser language, and choosing a language switches the whole UI live.

**Blocked by:** None — can start immediately

**Spec:** [spec.md](../spec.md): UI localization; Onboarding (screen 1)

**Status:** ready-for-agent

- [ ] react-i18next with typed resources for ja, zh, en and de, covering every UI string so far. `changeLanguage()` switches the UI live.
- [ ] Screen 1 pre-selects the first `ja`/`zh`/`en`/`de` base tag in `navigator.languages`, and otherwise English. The choice is stored in device settings.
- [ ] A missing key in any of the four resources fails a test.
- [ ] German strings fit in the dock and the conversation column.
