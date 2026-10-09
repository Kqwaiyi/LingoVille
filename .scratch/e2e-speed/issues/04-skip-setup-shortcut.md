# 04: Skip-setup shortcut

**What to build:** A smoke test about the town starts a ready-made game straight into the First Morning instead of clicking through the title screen and setup.
- A new dev-only URL parameter, `?newGame` or `?newGame=<target language>`, starts a new game with the e2e defaults: English Native Language, Japanese Target Language unless named, A1, the name Sam and the first Appearance Preset.
- It counts the mic check as done, and combines with `?at=`, `?day=`, `?spawn=`, `?faint` and `?ill`.
- Like those parameters, it is read only in a dev build, so a Player can never reach it.

The shared `startNewGame` e2e helper uses the shortcut by default, mapping the answers it already accepts onto the parameter. It goes through the real screens when a test asks. The specs about the title screen, setup, the mic check, Continue and save slots opt into the real screens, so those screens stay covered end to end.

See the spec's Solution step 4 and Implementation Decisions ("Skip-setup", "e2e helpers").

**Blocked by:** 01 (Steady smoke tests)

**Status:** ready-for-agent

- [ ] A new smoke test starts a game with `?newGame` plus `?spawn=` and `?at=` and reaches an NPC's prompt, with no title or setup screen shown
- [ ] `?newGame=<lang>` starts the game in that Target Language, which a smoke test checks for a non-default language
- [ ] The parameter has no effect in a production build, as with the existing dev parameters
- [ ] `startNewGame` uses the shortcut by default and the real screens on request; the title, setup, mic-check, Continue and save-slot specs use the real screens
- [ ] Every other spec's assertions are unchanged
- [ ] The e2e `AGENTS.md` describes the shortcut and when to opt into the real screens
- [ ] `npm test`, `npm run lint`, `npm run typecheck` and `npm run test:e2e` pass
- [ ] The full-suite wall-clock time, before and after, is recorded under `## Comments` on the spec
