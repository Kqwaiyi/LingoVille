# 08 — Save slots, backups, export and import

**What to build:** The title screen becomes the full menu (Continue · Load a save · New game · Import a save · Settings) over the live town. The Player has up to 4 slots, shown as cards with the Character's name, Target Language, day, money and last played. A slot can be exported with its Journal to JSON, imported into an empty slot, and deleted only by typing the Character's name. A damaged save falls back to this morning's backup, or offers Export raw and Delete.

**Blocked by:** 06 — Recap, hear-it-said and the Journal, 07 — Autosave and Continue

**Spec:** [spec.md](../spec.md): Save model; UI and HUD (Title)

**Status:** done

- [x] 4 slots, each holding any Target Language. Continue loads the most recent.
- [x] When all 4 slots are full, New game is greyed out with "Delete a save to start a new one".
- [x] The left menu sits over the live scene, with a slow camera drift and a dark gradient. The Character (a placeholder until ticket 30) stands in the right third. The centre panel follows the highlighted item. ↑ ↓ Enter Esc navigate, with key hints at the bottom left.
- [x] A start-of-day backup per slot rotates at each new day. Load falls back from the main save to the start-of-day backup ("Loaded this morning's save"), then to a "This save couldn't be loaded" card with Export raw and Delete. Nothing is deleted automatically.
- [x] Export writes one JSON per slot, named `insomniacs-<name>-<lang>-day<N>.json`, with the save, its Journal and backup metadata. Import works only into an empty slot, through the same Zod and migration path, and a bad file is rejected with a plain message.
- [x] Delete needs the Character's name typed, and removes the save, its backups and its Journal.
- [x] `navigator.storage.persist()` is called on the first write. If it's refused, a one-time dismissable callout appears at the bottom right.
- [x] `store` Vitest covers the export → import round trip, rejecting a bad import, the start-of-day fallback, and Journal entries migrating independently.
