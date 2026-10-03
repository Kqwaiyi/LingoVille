import type { GameState } from '../sim/index.ts';
import { SAVE_SCHEMA_VERSION, type Saves } from './saves.ts';

/** Saves for store tests that only remember what they were asked to write, and have nothing to load. */
export function recordingSaves() {
  const written: { slotId: string; game: GameState }[] = [];
  const saves: Saves = {
    write: async (slotId, game) => {
      written.push({ slotId, game });
      return { schemaVersion: SAVE_SCHEMA_VERSION, slotId, createdAt: '', lastPlayedAt: '', game };
    },
    load: async () => null,
    slots: async () => [],
    restore: async (_, save) => save,
    remove: async () => {},
    backups: async () => [],
    raw: async () => ({ save: undefined, backups: {} }),
  };
  return { saves, written };
}
