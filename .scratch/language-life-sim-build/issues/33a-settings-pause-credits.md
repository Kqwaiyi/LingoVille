# 33a — Settings, pause menu and credits

**What to build:** Settings holds every device setting: volume sliders, the input mode, push-to-talk vs open mic, reading aids and Show romaji, tooltips on/off, and the Native Language, which switches the UI live. A Retry microphone button switches back to Speaking once the mic works. Esc outside a conversation opens a pause menu with Resume and Settings, and the game is paused while it's open. A credits screen credits CC-BY creators.

**Blocked by:** 12c — Mic check and the mic-denied path

**Spec:** [spec.md](../spec.md): Save model (device settings); UI and HUD; Time and clock (paused)

**Status:** ready-for-agent

- [ ] Every device setting in the spec can be changed and persists per browser.
- [ ] Open mic uses automatic voice activity detection in `VoiceSession`.
- [ ] Retry microphone switches from the Typed Fallback back to Speaking once the mic works.
- [ ] The "🎤 off. Enable in Settings" chip appears at most once a day while the mic is off.
- [ ] The pause menu has Resume and Settings, and leaves room for Skip tutorial (added in ticket 34a).
- [ ] The clock scale is 0 while the pause menu is open.
- [ ] A credits screen is reachable from Settings and reads from the same list as `CREDITS.md`.
