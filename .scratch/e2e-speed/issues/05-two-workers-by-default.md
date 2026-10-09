# 05: Two workers by default

**What to build:** The smoke suite uses more of the dev's machine without inviting flakes. Once the suite passes repeatedly at 2 workers, the smoke config runs 2 workers by default. Its comment explains why not more: on the dev's machine, 4 workers roughly doubled each test's duration and surfaced flakes. Record the final timing against the 15-minute baseline. See the spec's Solution step 5 and Implementation Decisions ("Workers").

**Blocked by:** 02 (Tracing off by default), 03 (Configurable fake NPC reply delay), 04 (Skip-setup shortcut)

**Status:** ready-for-agent

- [ ] `npx playwright test --workers=2 --repeat-each=3` passes with no failures, and any failure it surfaces is fixed by waiting on visible state, as in 01
- [ ] The smoke config's `workers` is 2, with a comment saying why 2 and not 4
- [ ] The e2e `AGENTS.md` describes running the suite with 2 workers by default
- [ ] `npm run test:e2e` passes
- [ ] The final full-suite wall-clock time is recorded under `## Comments` on the spec, against the roughly 15-minute baseline
