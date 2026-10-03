# store

Zustand wiring between `sim` and world/UI, plus save/load and migrations (IndexedDB).

**Rules**
- The store calls `sim` functions and saves. World and UI read through selectors only.
- Saves are validated with Zod on load and upgraded by ordered migrations, with a pre-migration backup. Unknown content ids fail loudly.
- The Journal (`journal.ts`) is its own append-only IndexedDB database, keyed by slot. Entries have their own `schemaVersion` and Zod schema, and keep the rendered text in the Native Language they were written in.

**Testing**: Vitest on the load path, stored bytes → loaded state or a clear failure (migrations, backups, export/import round trip). Wiring that isn't a `sim` rule (such as the clock pausing while the tab is hidden) is tested as store actions in → selector values out, using `createGameStore` rather than the shared `gameStore`. Conversations are tested by passing `createGameStore` a fake `OpenVoiceSession` that the test speaks for, and Recaps with a fake `requestRecap` whose answer the test releases. IndexedDB tests import `fake-indexeddb/auto` and open a fresh database each.

`npx vitest run src/store`
