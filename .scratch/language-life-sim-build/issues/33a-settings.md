# 33a — Settings screen

**What to build:** Settings holds every device setting: volume sliders, the input mode, push-to-talk vs open mic, reading aids and Show romaji, tooltips on/off, and the Native Language, which switches the UI live. A Retry microphone button switches back to Speaking once the mic works.

**Blocked by:** 12c — Mic check and the mic-denied path

**Spec:** [spec.md](../spec.md): Save model (device settings); UI and HUD

**Status:** ready-for-agent

- [ ] Every device setting in the spec can be changed and persists per browser.
- [ ] Open mic uses automatic voice activity detection in `VoiceSession`.
- [ ] Retry microphone switches from the Typed Fallback back to Speaking once the mic works.
- [ ] The "🎤 off. Enable in Settings" chip appears at most once a day while the mic is off.
