# Spec: Faster, steadier smoke suite

Status: ready-for-agent

The Playwright smoke suite (`npm run test:e2e`) takes about 15 minutes. This spec cuts that time without dropping any test or what it checks. Terms follow `GLOSSARY.md`.

## Problem Statement

Running the smoke suite takes about 15 minutes, so the dev and AFK agents run it rarely. Regressions in what the Player sees then go unnoticed until late.

Profiling on the dev's machine (RTX 3060 laptop, 16 threads) showed where the time goes:

- **Rendering isn't the bottleneck.** Headless Chromium draws the town on the GPU at 54–58 fps, and a fresh page reaches the title screen in about 1.1s.
- **The suite runs one test at a time.** 94 tests average about 9.5s each.
- **Tracing runs on every test.** `trace: 'retain-on-failure'` records DOM snapshots and a screencast for every step, then throws them away when the test passes. That costs about 1–2s per test: in one measurement a short test took 3.6s with tracing and 1.6s without.
- **The scripted fake NPC waits 600ms** before every greeting, reply and tool call. A single conversation pays this several times, and a Shift pays it dozens of times.
- **Most tests click through the whole of setup.** That means the title screen, Native Language, Target Language, name and level, and Appearance Preset, while the scene boots, even when the test is about the café or the clinic. Clicks during scene boot took about 1.2s each.
- **Several tests are racy.** At 4 workers, `smallTalk` (pressing T before the Typed reply field exists) and `directions` failed. With tracing off, `shift`'s network-drop test failed. These tests depend on timing rather than on what the Player sees, so any speed-up exposes them.
- **Simply adding workers doesn't help enough.** At `--workers=4` the run took 9.0 min instead of about 15, but each test ran about 2× slower and two failed.

## Solution

The full smoke suite runs in about a third of the time and passes reliably. No test is removed and no assertion is weakened.

1. **Fix the racy tests first.** Each test waits on something the Player can see before acting, never on a fixed sleep or on how far a held key moves in N milliseconds. A wait is the right tool only when the behaviour under test is itself measured in real time.
2. **Turn tracing off by default.** A developer re-runs a failing test with `--trace=on` to get a trace. The fixture that fails a test on any uncaught page error stays, so crashes are still named.
3. **Make the fake NPC's reply delay configurable.** In mock mode the gateway hands the browser a reply delay, read from an env var and defaulting to the current 600ms. The smoke config sets it short, so ordering stays asynchronous but takes milliseconds.
4. **Add a skip-setup shortcut.** A dev-only URL parameter starts a new game straight into the town with default answers, skipping the title screen, setup and the mic check. It works alongside the existing `?at=`, `?day=`, `?spawn=`, `?faint` and `?ill`. Tests about the title screen, setup, the mic check, Continue or save slots still go through the real screens.
5. **Run 2 workers by default,** once the suite passes repeatedly at that level.

## User Stories

1. As a developer, I want the full smoke suite to finish in a fraction of its current 15 minutes, so that I run it before every commit rather than once a day.
2. As an AFK agent, I want the smoke suite to be fast enough to run after each ticket, so that I catch regressions in what the Player sees before handing work back.
3. As a developer, I want every smoke test to pass the same way on every run, so that a red run always means a real regression.
4. As a developer, I want the smoke suite to pass with 2 workers, so that I can use more of my machine without inviting flakes.
5. As a developer, I want the suite to pass under `--repeat-each` at 2 workers, so that I have evidence the races are gone, not just unlucky.
6. As a developer, I want no smoke test to depend on how far the Character moves while a key is held for a fixed time, so that frame rate under load can't make it miss an NPC.
7. As a developer, I want each held-key walk to end when the prompt for the target appears, so that walking is as fast as the scene allows and never overshoots.
8. As a developer, I want pressing T or E in a test to wait until the conversation column or Typed reply field is ready, so that a key press is never lost to a still-opening conversation.
9. As a developer, I want the network-drop test to wait for the retry it is checking, so that it passes however quickly the fake NPC answers.
10. As a developer, I want every fixed `waitForTimeout` in the smoke suite either replaced by a wait on something visible or justified with a comment saying what real-time behaviour it measures, so that sleeps don't creep back in.
11. As a developer, I want tracing off by default in the smoke config, so that passing tests don't pay for recording traces nobody reads.
12. As a developer, I want the e2e `AGENTS.md` to say how to get a trace for a failing test (`--trace=on`), so that switching tracing off doesn't hide how to debug.
13. As a developer, I want the fixture that fails a test on any uncaught page error kept, so that a crash in the 3D scene is still named even without a trace.
14. As a developer, I want the fake NPC's reply delay to come from the gateway in mock mode, so that the browser code doesn't decide its own test timing and the voice module's rule that session settings come from the token response still holds.
15. As a developer, I want the reply delay to default to 600ms when the env var isn't set, so that `npm run dev` in mock mode still feels like a real NPC thinking.
16. As a developer, I want the smoke config to set a short reply delay, so that each NPC turn takes milliseconds instead of 600.
17. As a developer, I want the gateway to refuse a malformed reply-delay value at startup, so that a typo doesn't silently fall back to a slow or zero delay.
18. As a developer, I want the fake NPC to still answer asynchronously even with a short delay, so that tests keep exercising the same ordering as the real Live session.
19. As a developer, I want a dev-only URL parameter that starts a new game straight into the First Morning with default answers, so that tests about the town don't spend seconds on setup screens they aren't checking.
20. As a developer, I want that parameter to take an optional Target Language, so that culture-pack and language tests can skip setup too.
21. As a developer, I want the skip-setup parameter to combine with `?at=`, `?day=`, `?spawn=`, `?faint` and `?ill`, so that a test can start a ready-made game anywhere and anytime it already can.
22. As a developer, I want the skip-setup parameter to skip the mic check too, so that a test doesn't depend on whether this browser has passed it.
23. As a developer, I want the skip-setup parameter to do nothing in a production build, like the other dev parameters, so that a Player can never reach it.
24. As a developer, I want the shared e2e helper to start a new game through the shortcut by default, and through the real screens only when a test asks, so that most specs speed up without being edited one by one.
25. As a developer, I want the tests about the title screen, setup, the mic check, Continue and save slots to keep going through the real screens, so that those screens are still covered end to end.
26. As a developer, I want the smoke config to run 2 workers by default with a comment saying why 2, so that the next person doesn't jump straight to 4 and bring the flakes back.
27. As a developer, I want the suite's before and after timings recorded on the spec, so that I can tell whether the change paid off.
28. As a reviewer, I want each change to land as its own commit, so that I can see what each one saved and revert one alone if it causes trouble.

## Implementation Decisions

- **Order of work.** Fix the races first. Then turn tracing off, add the configurable reply delay, add skip-setup, and set 2 workers last. Each step goes in its own commit with a timing of the full suite.
- **Racy tests.** Fix the known ones: `smallTalk` (T before the field exists), `directions` (a 50ms held-key side-step), and `shift`'s network-drop test. Also fix any other test that fails under `--repeat-each` at 2 workers. Review each existing `waitForTimeout`:
  - culturePacks, places and town: replace with a visible wait, or justify in a comment.
  - dock's clock test: keep its wait, since it measures real time.

  Helpers in `e2e/` that press a key to open something wait for that thing to be visible before returning.
- **Tracing.** Set the smoke config's `trace` to `'off'`. Add no retries, so flakes stay visible rather than retried away.
- **Reply delay contract.** In mock mode only, the gateway's token response gains an optional reply delay in milliseconds, read from a new env var such as `GEMINI_MOCK_REPLY_MS`.
  - Missing means 600.
  - A value that isn't a non-negative integer stops the gateway at startup with a message naming the variable.
  - Real-mode token responses don't change.
- **Reply delay in the browser.** The voice module's session opener passes the delay from the token response to the mock VoiceSession. The mock VoiceSession waits that long instead of its hard-coded 600ms, and still always defers through the event loop, never calling back synchronously.
- **Smoke config.** The smoke config passes the short delay in its web server env alongside `GEMINI_MOCK=1`. The suggested value is about 50ms, small but not zero.
- **Skip-setup.** A new dev-only URL parameter works like the existing ones in the store, which are read only when `import.meta.env.DEV`. For example, `?newGame` or `?newGame=de`.
  - It starts a new game with the e2e defaults: English Native Language, Japanese Target Language unless named, A1, the name Sam and the first Appearance Preset.
  - It counts the mic check as passed or skipped for this game, and lands in the First Morning with the scene booting.
  - The other dev parameters keep their meaning when combined with it.
- **e2e helpers.** `startNewGame` uses skip-setup unless a test passes an option to go through the screens, and the answers it already accepts map onto the parameter. Specs about the title screen, setup, the mic check, Continue and save slots opt into the real screens. Every other spec's assertions stay unchanged.
- **Workers.** Set the smoke config's `workers` to 2 only after the suite passes `--repeat-each=3` at 2 workers. Update its comment: 4 workers on the dev's machine roughly doubled each test's duration and surfaced flakes.
- **Docs.**
  - The e2e `AGENTS.md` covers the trace flag, the skip-setup helper and the "wait on something visible" rule.
  - The voice and server `AGENTS.md` files mention that the reply delay comes from the token response.
  - `.env.example` lists the new env var.

## Testing Decisions

- **What makes a good test here.** Test behaviour at the highest seam, through public interfaces: what the gateway returns and what the mock VoiceSession emits and when, not their internals. The smoke suite itself is the top seam and proves the speed-up.
- **Seam 1: the smoke suite.** Success means:
  - The full suite passes at 2 workers, and passes `--repeat-each=3` at 2 workers.
  - Wall-clock time before and after each step is recorded on this spec.
  - Every existing spec still runs with the same assertions.
  - One smoke test covers skip-setup directly, starting a game with `?newGame` plus `?spawn=` and `?at=` and reaching an NPC prompt. Prior art: `e2e/smoke.spec.ts`, `e2e/setup.spec.ts`.
- **Seam 2: the gateway, via `createGateway` in Vitest.**
  - In mock mode, the token response carries the configured reply delay, and 600 when unset.
  - A malformed value is rejected.
  - Real mode carries no reply delay.

  Prior art: `server/gateway.test.ts`.
- **Seam 3: the mock VoiceSession in Vitest.**
  - With fake timers, a reply arrives after the delay it was given and not before, and after 600ms when none is given.
  - With a delay of 0, events still arrive asynchronously.

  Prior art: the existing mock VoiceSession tests under `src/voice`.
- **No new seams.** Skip-setup is tested only through the smoke suite, as the other dev URL parameters are.
- **No evals.** None of this touches `server/config.ts`, prompts or real Gemini, so no `npm run eval` is needed.

## Out of Scope

- Removing, merging or shortening any smoke test, or weakening any assertion.
- Building the app and testing it with `vite preview` instead of the dev server. Page load measured about 1.1s, so it isn't worth the build step for now.
- Changing the game's real frame rate, physics or rendering for tests, or adding a "test mode" that renders less.
- Retries in the Playwright config.
- CI setup. The suite runs locally on the dev's machine.
- Changing the real Live session's timing or the 600ms default players see in mock-mode `npm run dev`.

## Further Notes

- Baseline from profiling on 2026-10-09:
  - The full serial run takes about 15 min, as the dev reports.
  - A 12-test subset (smoke, setup, dock, shift) took 1.9 min serial.
  - The full suite at `--workers=4` took 9.0 min, with 2 failures (directions, smallTalk) and per-test durations about 2× the serial ones.
  - With tracing off, 3 files ran in 1.1 min vs. 1.3 min with tracing, and `shift`'s network-drop test failed.
- Expected savings, as estimates to check against measurements:
  - Tracing: about 2–3 min.
  - Reply delay: about 2–3 min.
  - Skip-setup: about 2s per test that uses it.
  - 2 workers: roughly halves what's left.
  - Target: the full suite in about 5 min at 2 workers.
- After step 1 (steady tests), on 2026-10-09: the full suite at `--workers=2 --trace=off` took 7.6 min, and `--repeat-each=3` at 2 workers passed 285/285 in 21.7 min.
- In mock-mode `npm run dev` for manual play, the delay stays 600ms unless the dev sets the env var.

## Comments

- Step 2 (tracing off), on 2026-10-09, `npm run test:e2e` (1 worker):
  - Before, with `trace: 'retain-on-failure'`: 94 passed and 1 failed in 13.1 min (791s wall-clock).
  - After, with `trace: 'off'`: 95 passed in 9.2 min (551s wall-clock), about 4 min saved.
  - The failed test took 9.4s, about as long as it takes to pass with tracing, so it barely skews the comparison.
  - The failure was `culturePacks`' café in the `de` pack, a flake that isn't about tracing. Its trace shows the walk let go on "Press E to talk — Barista", which was gone a frame later, so E opened nothing. The Character's prompt is set from the position it asks the physics engine for, which a render frame with no physics step drops. The fix is left to a separate task, outside this spec.
- Step 3 (configurable reply delay), on 2026-10-09, `npm run test:e2e` (1 worker):
  - Before, the step 2 run above with the fake NPC at 600ms: 95 passed in 551s wall-clock.
  - After, with `GEMINI_MOCK_REPLY_MS=50`: 93 passed and 2 failed in 8.8 min (531s wall-clock), about 20s saved. The two failures each spent about 5s waiting on an assertion, so the true saving is a little more.
  - That is well short of the 2–3 min estimate. Most tests have only a few NPC turns. The delay itself works: `shift.spec.ts` alone took 35.7s at 50ms against 46.7s at 600ms.
  - Both failures are flakes unrelated to the delay: `readingAids`' "hiding reading aids…" and `slots`' persist-callout test. Each reloads straight after a click whose device-settings write lands in the background, so the reload can beat the write. Both passed 10/10 under `--repeat-each=5`. The fix is left to a separate task.
- Step 4 (skip-setup shortcut), on 2026-10-09, `npm run test:e2e` (1 worker):
  - Before, the step 3 run above: 93 passed and 2 failed in 531s wall-clock.
  - After, with `startNewGame` going through `?newGame` by default: 96 passed and 1 failed in 7.6 min (459s wall-clock), about 70s saved. The suite now has 97 tests, 2 of them new for the shortcut.
  - Specs whose answers the shortcut can't carry (`level: 2` in cashier and server, `native: 'de'` in culturePacks and languages) still go through setup, as do continue, setup and slots by `throughScreens`.
  - The first run after the change failed `directions` 3 times in 6. Starting straight in the town, the walk began before the scene had put the Character on the platform, so `stepAsideOnThePlatform`'s "until the prompt goes" ended at once. It now waits for the prompt to show first, and passed 5/5 under `--repeat-each`.
  - The one failure was the `readingAids` reload flake from step 3, which doesn't start a game and passed 5/5 on its own. `townOffice` failed once in the first run, a prompt-flicker flake like step 2's `culturePacks` one, and passed 5/5 on its own.
