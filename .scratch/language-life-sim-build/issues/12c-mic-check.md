# 12c — Mic check and the mic-denied path

**What to build:** The last setup screen is a skippable mic check with a live level meter. A Player who denies the mic, or has none, lands in the Typed Fallback with nothing locked. A browser that has already passed the mic check skips it next time.

**Blocked by:** 12b — Target Language, self-assessment, name and appearance

**Spec:** [spec.md](../spec.md): Onboarding (screen 5); Save model (device settings)

**Status:** ready-for-agent

- [ ] Screen 5 has a live level meter, a recommendation to use headphones, Skip, and a Skip tutorial option.
- [ ] A denied or missing mic sets the input mode to the Typed Fallback in device settings.
- [ ] A passed mic check is recorded in device settings, and a second save skips the screen.
- [ ] Playwright (mock mode): a mic-denied path that lands in the Typed Fallback.
