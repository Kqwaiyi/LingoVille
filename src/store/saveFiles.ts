import { z } from 'zod';
import { JOURNAL_SCHEMA_VERSION, parseJournalEntry, type Journal, type JournalEntry } from './journal.ts';
import { parseSave, SAVE_SCHEMA_VERSION, type Save, type Saves } from './saves.ts';

// A slot as one file: its save, its Journal and what its backups are, so the
// Player can back up a life or move it to another browser. Export is per slot;
// import goes into an empty slot only, through the same migrations and Zod
// checks as a load. Delete removes the save, its backups and its Journal.

/** What a slot is kept in: its save and backups, and its Journal apart. */
export type SlotStores = { saves: Saves; journal: Journal };

const SAVE_FILE_FORMAT = 'insomniacs-save';
const SAVE_FILE_VERSION = 1;

const SaveFileSchema = z.object({
  format: z.literal(SAVE_FILE_FORMAT),
  formatVersion: z.int(),
  exportedAt: z.string(),
  save: z.unknown(),
  journal: z.array(z.unknown()),
  backups: z.array(z.unknown()),
});

/** A file ready to download. */
export type SaveFile = { fileName: string; contents: string };

/** Why an import was refused, for a plain message. */
export type ImportProblem = 'notASaveFile' | 'newerVersion' | 'damaged' | 'slotNotEmpty';

export class ImportRefused extends Error {
  constructor(
    readonly problem: ImportProblem,
    detail: string,
  ) {
    super(`Import refused (${problem}): ${detail}`);
  }
}

/** Keeps the Character's name in a file name, minus anything a file system would refuse. */
function fileNamePart(text: string) {
  return text.trim().replace(/[\s\\/:*?"<>|.]+/g, '-').replace(/^-+|-+$/g, '') || 'save';
}

const versionOf = (raw: unknown) =>
  typeof raw === 'object' && raw !== null && 'schemaVersion' in raw && typeof raw.schemaVersion === 'number' ? raw.schemaVersion : null;

/** `insomniacs-<name>-<lang>-day<N>.json`: the slot's save, its Journal (oldest first) and its backups' metadata. */
export async function exportSave({ saves, journal }: SlotStores, slotId: string, now = new Date()): Promise<SaveFile> {
  const loaded = await saves.load(slotId);
  if (!loaded) throw new Error(`There's no save in ${slotId} to export`);
  const { save } = loaded;
  const contents = {
    format: SAVE_FILE_FORMAT,
    formatVersion: SAVE_FILE_VERSION,
    exportedAt: now.toISOString(),
    save,
    journal: (await journal.list(slotId)).reverse(),
    backups: await saves.backups(slotId),
  } satisfies z.infer<typeof SaveFileSchema>;
  const { characterName, targetLanguage } = save.game.identity;
  return {
    fileName: `insomniacs-${fileNamePart(characterName)}-${targetLanguage}-day${save.game.clock.day}.json`,
    contents: JSON.stringify(contents, null, 2),
  };
}

/** Everything stored for a slot, as found, for a save that can't be loaded. */
export async function exportRawSave({ saves, journal }: SlotStores, slotId: string, now = new Date()): Promise<SaveFile> {
  const { save, backups } = await saves.raw(slotId);
  const contents = { format: 'insomniacs-raw', exportedAt: now.toISOString(), slotId, save, backups, journal: await journal.raw(slotId) };
  return { fileName: `insomniacs-${slotId}-raw.json`, contents: JSON.stringify(contents, null, 2) };
}

/** Reads a whole exported file, or says why it can't be imported. Writes nothing. */
function readSaveFile(contents: string): { save: Save; journal: JournalEntry[] } {
  let json: unknown;
  try {
    json = JSON.parse(contents);
  } catch {
    throw new ImportRefused('notASaveFile', 'it is not JSON');
  }
  const file = SaveFileSchema.safeParse(json);
  if (!file.success) throw new ImportRefused('notASaveFile', z.prettifyError(file.error));
  if (file.data.formatVersion > SAVE_FILE_VERSION) throw new ImportRefused('newerVersion', `file format v${file.data.formatVersion}`);

  const read = <T>(raw: unknown, newest: number, parse: (raw: unknown) => T, what: string): T => {
    if ((versionOf(raw) ?? 0) > newest) throw new ImportRefused('newerVersion', `${what} is v${versionOf(raw)}`);
    try {
      return parse(raw);
    } catch (error) {
      throw new ImportRefused('damaged', `${what}: ${error instanceof Error ? error.message : error}`);
    }
  };
  return {
    save: read(file.data.save, SAVE_SCHEMA_VERSION, parseSave, 'the save'),
    journal: file.data.journal.map((entry, i) => read(entry, JOURNAL_SCHEMA_VERSION, parseJournalEntry, `Journal entry ${i + 1}`)),
  };
}

/**
 * Imports an exported file into an empty slot. The whole file is checked
 * before anything is written; a refusal is an `ImportRefused` saying why.
 */
export async function importSave({ saves, journal }: SlotStores, slotId: string, contents: string): Promise<Save> {
  const file = readSaveFile(contents);
  if ((await saves.raw(slotId)).save !== undefined) throw new ImportRefused('slotNotEmpty', `${slotId} holds a save`);

  const save = await saves.restore(slotId, file.save);
  try {
    await journal.restore(slotId, file.journal);
  } catch (error) {
    // Half an import is no import: take back the save this import just wrote.
    await saves.remove(slotId);
    throw error;
  }
  return save;
}

/** Removes a slot's save, its backups and its Journal. */
export async function deleteSave({ saves, journal }: SlotStores, slotId: string): Promise<void> {
  await saves.remove(slotId);
  await journal.remove(slotId);
}
