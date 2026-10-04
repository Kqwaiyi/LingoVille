# 12c — Mic check and the mic-denied path

**What to build:** The last setup screen is a skippable mic check with a live level meter. A Player who denies the mic, or has none, lands in the Typed Fallback with nothing locked. A browser that has already passed the mic check skips it next time.

**Blocked by:** 12b — Target Language, self-assessment, name and appearance

**Spec:** [spec.md](../spec.md): Onboarding (screen 5); Save model (device settings)

**Status:** done

- [x] Screen 5 has a live level meter, a recommendation to use headphones, Skip, and a Skip tutorial option.
- [x] A denied or missing mic sets the input mode to the Typed Fallback in device settings.
- [x] A passed mic check is recorded in device settings, and a second save skips the screen.
- [x] Playwright (mock mode): a mic-denied path that lands in the Typed Fallback.

## Comments

- `SETUP_STEPS` ends with `micCheck`. `nextSetupStep` skips it once the device settings say `micCheckPassed`, so the appearance is the last screen then. `selectSetupIsLast` drives the Start label.
- The store opens the mic through a new `openMic` dep (`openBrowserMic` in `voice/browserIo.ts`, an analyser read every 100 ms on the same 0–1 scale as the worklet's level). The check passes at `MIC_CHECK.heardLevel` (`tuning.ts`). Start waits until the check hears the Player or finds no mic. Skip goes on at any time and leaves the input mode as it was. A refusal sets `inputMode: 'typed'` even if it arrives after Skip.
- Skip tutorial is a checkbox on the last setup screen: the mic check, or the appearance for a browser that has passed it. It goes into the save as `onboarding.firstMorningSkipped`, through `NewGameSetup.skipFirstMorning`. The save schema is v3, and the migration sets `false`. Nothing reads it yet: 34a should.
- Typed Fallback in a conversation: a "🎤 off" chip takes the mic button's place, Space doesn't listen, and the voice session gets `typedOnly`, so it never asks for the mic. The "Enable in Settings" wording and Retry microphone are 33a's.
- Not handled: a mic that passed the check and later goes missing or is refused mid-game. The Live session only logs it, and the input mode stays `mic`. That belongs with Retry microphone in 33a.
- The smoke's Chromium has a fake mic (flags in `playwright.config.ts`) that beeps about once a second, so the check can pass. `goThroughSetup` presses Skip on the mic check. The mic-denied e2e test stubs `getUserMedia` to refuse.
