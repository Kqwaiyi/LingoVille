# 01: Steady smoke tests

**What to build:** Every smoke test waits on something the Player can see before it acts, so the suite passes the same way however fast or busy the machine is. Today `smallTalk` (pressing T before the Typed reply field exists) and `directions` (a 50ms held-key side-step) fail at 4 workers, and `shift`'s network-drop test fails with tracing off. This ticket fixes those three and any other test that fails when the suite is repeated at 2 workers.

Walking is the main source of timing dependence. Add one shared e2e helper that holds a key until a given prompt appears and then releases it, and move the hand-rolled held-key walks onto it. Helpers that press a key to open something, such as T, E or F, wait for that thing before returning. Review each fixed `waitForTimeout`:
- culturePacks, places and town: replace with a wait on something visible, or keep it with a comment saying what real-time behaviour it measures.
- dock's clock test: keep its wait, since it measures real time.

The Playwright config defaults don't change here: tracing, workers and the reply delay stay as they are. See the spec's Solution step 1 and Implementation Decisions ("Racy tests").

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `npx playwright test --workers=2 --repeat-each=3 --trace=off` passes with no failures
- [x] `smallTalk`, `directions` and `shift`'s network-drop test wait on visible state, not on timing
- [x] No held-key walk depends on how long the key is held; each ends when its prompt appears, through the shared helper
- [x] Every remaining `waitForTimeout` in `e2e/` has a comment naming the real-time behaviour it measures
- [x] No test is removed and no assertion is weakened
- [x] The e2e `AGENTS.md` states the rule: wait on something the Player sees, never on a fixed sleep or a timed key hold
- [x] `npm run lint` and `npm run typecheck` pass

## Comments

- smallTalk had nothing visible to wait on: during the barista's goodbye the Typed reply field stayed on screen while lines typed into it were silently dropped. With the dev's go-ahead, the field is now read-only whenever the NPC can't take a turn (the goodbye, Reconnecting…), via `selectCanTakeTurn`, and the test waits for an editable field.
- `walkUntil` (`e2e/walk.ts`) looks for prompt text every frame and lets go of the keys in that same frame, so a walk stops within a frame's step of its prompt. It sends the key-up itself, which leans on the scene reading walk keys from window events.
- places keeps one timed walk, as this ticket allows: nothing visible shows that the Character got no further in a closed café. If frames are slower than the clock's cap, it walks less far, so the test can only get weaker, never flaky.
- `npx playwright test --workers=2 --repeat-each=3 --trace=off`: 285 passed in 21.7 min. The full suite once at 2 workers with tracing off took 7.6 min.
