# 02: Tracing off by default

**What to build:** Passing smoke tests stop paying for traces nobody reads. The smoke config records no trace by default, and a developer debugging a failure re-runs that one test with `--trace=on`. The fixture that fails a test on any uncaught page error stays, so a crash in the 3D scene is still named. See the spec's Solution step 2 and Implementation Decisions ("Tracing").

**Blocked by:** 01 (Steady smoke tests)

**Status:** done

- [x] The smoke config's `trace` is `'off'`, with no retries added
- [x] The e2e `AGENTS.md` says how to get a trace for a failing test (`--trace=on`)
- [x] The uncaught-error fixture is unchanged and `uncaughtErrors.spec.ts` still passes
- [x] `npm run test:e2e` passes
- [x] The full-suite wall-clock time, before and after, is recorded under `## Comments` on the spec
