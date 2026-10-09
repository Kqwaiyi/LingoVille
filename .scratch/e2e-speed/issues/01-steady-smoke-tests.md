# 01: Steady smoke tests

**What to build:** Every smoke test waits on something the Player can see before it acts, so the suite passes the same way however fast or busy the machine is. Today `smallTalk` (pressing T before the Typed reply field exists) and `directions` (a 50ms held-key side-step) fail at 4 workers, and `shift`'s network-drop test fails with tracing off. This ticket fixes those three and any other test that fails when the suite is repeated at 2 workers.

Walking is the main source of timing dependence. Add one shared e2e helper that holds a key until a given prompt appears and then releases it, and move the hand-rolled held-key walks onto it. Helpers that press a key to open something, such as T, E or F, wait for that thing before returning. Review each fixed `waitForTimeout`:
- culturePacks, places and town: replace with a wait on something visible, or keep it with a comment saying what real-time behaviour it measures.
- dock's clock test: keep its wait, since it measures real time.

The Playwright config defaults don't change here: tracing, workers and the reply delay stay as they are. See the spec's Solution step 1 and Implementation Decisions ("Racy tests").

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `npx playwright test --workers=2 --repeat-each=3 --trace=off` passes with no failures
- [ ] `smallTalk`, `directions` and `shift`'s network-drop test wait on visible state, not on timing
- [ ] No held-key walk depends on how long the key is held; each ends when its prompt appears, through the shared helper
- [ ] Every remaining `waitForTimeout` in `e2e/` has a comment naming the real-time behaviour it measures
- [ ] No test is removed and no assertion is weakened
- [ ] The e2e `AGENTS.md` states the rule: wait on something the Player sees, never on a fixed sleep or a timed key hold
- [ ] `npm run lint` and `npm run typecheck` pass
