# 07 — Autosave and Continue

**What to build:** The game saves itself after each outcome, through doors, on tab hide, at a new day and every ~2 minutes, with a brief, silent "Saved ✓" under the clock. After reloading the page, a title screen offers Continue. It puts the Character back where they were (at the place's entrance, or in bed if at home), with everything as it was.

**Blocked by:** 04 — Order a drink and pay

**Spec:** [spec.md](../spec.md): Save model

**Status:** ready-for-agent

- [ ] The save object has every field group in the spec's Save model, including the RNG state and the personal phrasebook. It is stored in IndexedDB via `idb-keyval` and validated with Zod and a `schemaVersion`.
- [ ] Ordered migrations exist, with one trivial test migration. A pre-migration backup is written before migrating.
- [ ] Content is referenced by id, and an unknown id on load fails loudly.
- [ ] Autosave triggers:
  - after each outcome (before the Recap);
  - at a new day and at doors;
  - on `visibilitychange`→hidden and on `pagehide`;
  - every ~2 real minutes.
- [ ] A conversation is never saved in progress: after a reload mid-conversation, it never happened.
- [ ] `store` Vitest covers the save → load round trip, the migration path and the unknown-id failure.
- [ ] A minimal title screen with Continue loads the most recent save. New game uses the fixed dev setup until ticket 12.
- [ ] Device settings live in one record per browser, outside saves.
- [ ] Playwright (mock mode): order a drink, reload, Continue, and money and place match.
