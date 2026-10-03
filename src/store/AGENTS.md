# store

Zustand wiring between `sim` and world/UI, plus save/load and migrations (IndexedDB).

**Rules**
- The store calls `sim` functions and saves. World and UI read through selectors only.
- Saves are validated with Zod on load and upgraded by ordered migrations, with a pre-migration backup. Unknown content ids fail loudly.

**Testing**: Vitest on the load path, stored bytes → loaded state or a clear failure (migrations, backups, export/import round trip).

`npx vitest run src/store`
