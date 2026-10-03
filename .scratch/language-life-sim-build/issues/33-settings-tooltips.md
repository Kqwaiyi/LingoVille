# 33 — Settings, pause menu and tooltips

**What to build:** Settings holds every device setting:

- volume sliders;
- the input mode, and push-to-talk vs open mic;
- reading aids and Show romaji;
- tooltips on/off;
- the Native Language, which switches the UI live;
- a Retry microphone button.

Esc opens a pause menu. One-time tooltips explain new systems the first time they come up, and never repeat on that browser. A credits screen credits CC-BY creators.

**Blocked by:** 05 — Speak to NPCs with a real voice, 12 — New game setup and UI languages, 16 — Fainting and the hospital, 19 — Barista hiring and a first Shift

**Spec:** [spec.md](../spec.md): Save model (device settings); Onboarding (tooltips); UI and HUD

**Status:** ready-for-agent

- [ ] Every device setting in the spec can be changed and persists per browser.
- [ ] Open mic uses automatic voice activity detection in `VoiceSession`.
- [ ] Retry microphone switches from the Typed Fallback back to Speaking once the mic works.
- [ ] The "🎤 off. Enable in Settings" chip appears at most once a day while the mic is off.
- [ ] The pause menu has Resume, Settings and Skip tutorial (while the First Morning is running).
- [ ] The tooltip system shows cards above the dock with "Got it". It covers Shifts, Fainting, the Journal (after the first Recap closes), open mic and the Typed Fallback. Seen tooltips are stored per browser, all tooltips can be turned off, and they fire even if the tutorial was skipped.
- [ ] A credits screen is reachable from Settings.
