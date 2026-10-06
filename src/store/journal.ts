import { createStore, del, get, set, update, type UseStore } from 'idb-keyval';
import { z } from 'zod';
import { SegmentSchema } from '../ai/index.ts';
import { INTERACTIONS, NAMED_NPCS, type NamedNpcId } from '../content/index.ts';
import { JOB_IDS } from '../sim/index.ts';

// The Journal: every Recap the Player has had, kept per slot in its own IndexedDB
// database, apart from the save. Entries are only ever added. Each holds the
// text as it was rendered, in the Native Language it was written in, so later
// changes to prompts or settings never rewrite history.

export const JOURNAL_SCHEMA_VERSION = 5;

const LANGUAGES = ['ja', 'zh', 'en', 'de'] as const;
// Content is referenced by id, and an id the game no longer knows fails loudly.
const NPC_IDS = Object.keys(NAMED_NPCS) as [NamedNpcId, ...NamedNpcId[]];
const INTERACTION_IDS = Object.values(INTERACTIONS).map((interaction) => interaction.id) as [string, ...string[]];

// What every entry has, whatever it is a Recap of.
const shared = {
  schemaVersion: z.literal(JOURNAL_SCHEMA_VERSION),
  id: z.string(),
  /** When it was written, in real time. */
  writtenAt: z.string(),
  placeName: z.string(),
  /** The game time the conversation (or Shift) ended. */
  day: z.int(),
  minuteOfDay: z.number(),
  targetLanguage: z.enum(LANGUAGES),
  nativeLanguage: z.enum(LANGUAGES),
  /** The Recap as shown, or null if it couldn't be written. */
  recap: z
    .object({
      outcome: z.string(),
      corrections: z.array(z.object({ said: z.string(), natural: z.string(), why: z.string() })),
      newWords: z.array(z.object({ base: z.string(), reading: z.string(), gloss: z.string() })),
    })
    .nullable(),
  lines: z.array(
    z.object({
      speaker: z.enum(['npc', 'player']),
      text: z.string(),
      typed: z.boolean().optional(),
      /** An NPC line's reading aid (zh and ja), as corrected by the time the entry was written. */
      reading: z.array(SegmentSchema).optional(),
      /** In a Shift's entry, which customer (from 1, in the order the Player dealt with them) the line was said with. */
      customer: z.int().min(1).optional(),
    }),
  ),
  helpLog: z.array(z.object({ afterLine: z.int().min(0), kind: z.enum(['hint', 'phrasebook', 'translate']), text: z.string() })),
  noHelpNeeded: z.boolean(),
};

const JournalEntrySchema = z.discriminatedUnion('kind', [
  /** A Goal Interaction's Recap. */
  z.object({
    ...shared,
    kind: z.literal('goal'),
    npcId: z.enum(NPC_IDS),
    /** The NPC's name as the Character knew it then, or null if they didn't know it yet. */
    npcName: z.string().nullable(),
    interactionId: z.enum(INTERACTION_IDS),
    outcome: z.enum(['success', 'failure']),
  }),
  /** Small Talk's lighter Recap. It can't fail, so it has no outcome. */
  z.object({
    ...shared,
    kind: z.literal('smallTalk'),
    npcId: z.enum(NPC_IDS),
    /** The NPC's name as the Character knew it then, or null if they didn't know it yet. */
    npcName: z.string().nullable(),
  }),
  /** A whole Shift's one combined Recap, with every customer's lines in order. */
  z.object({
    ...shared,
    kind: z.literal('shift'),
    jobId: z.enum(JOB_IDS),
    /** How many Shift Customers the Shift had, and how many were served right. */
    customers: z.int().min(1),
    served: z.int().min(0),
  }),
]);

export type JournalEntry = z.infer<typeof JournalEntrySchema>;
/** What the game hands the Journal; the Journal stamps the rest. */
export type NewJournalEntry = DistributiveOmit<JournalEntry, 'schemaVersion' | 'id' | 'writtenAt' | 'noHelpNeeded'>;
/** What a Journal page shows, whether or not it has been stored yet. */
export type JournalPage = DistributiveOmit<JournalEntry, 'schemaVersion' | 'id' | 'writtenAt'>;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** The "No Help needed" sticker shows only when the Help log is empty. */
export function journalPage(entry: NewJournalEntry): JournalPage {
  return { ...entry, noHelpNeeded: entry.helpLog.length === 0 };
}

/** A stored entry in some older shape. Migrations only touch what changed. */
type StoredEntry = { schemaVersion: number } & Record<string, unknown>;

/**
 * Ordered migrations, apart from the save's: `MIGRATIONS[n]` upgrades an entry
 * from version n + 1 to n + 2. Entries are migrated as they're read and never
 * rewritten, so the Journal stays as it was written.
 */
const MIGRATIONS: readonly ((entry: StoredEntry) => StoredEntry)[] = [
  // 1 → 2: entries keep the NPC's name. Older ones never knew it.
  (entry) => ({ ...entry, schemaVersion: 2, npcName: null }),
  // 2 → 3: NPC lines may keep their reading aid. Older ones have none.
  (entry) => ({ ...entry, schemaVersion: 3 }),
  // 3 → 4: a Shift gets its own kind of entry. Older ones are all Goal Interactions'.
  (entry) => ({ ...entry, schemaVersion: 4 }),
  // 4 → 5: Small Talk gets its own kind of entry. Older ones are all Goal Interactions' or Shifts'.
  (entry) => ({ ...entry, schemaVersion: 5 }),
];

/** Reads one stored entry as an entry of today's version, through the migrations. Throws, saying why, if it can't. */
export function parseJournalEntry(raw: unknown): JournalEntry {
  const from = typeof raw === 'object' && raw !== null && 'schemaVersion' in raw ? raw.schemaVersion : undefined;
  if (typeof from !== 'number') throw new Error('it has no schemaVersion');
  if (from > JOURNAL_SCHEMA_VERSION) throw new Error(`it was written by a newer version of the game (v${from})`);
  if (from < 1) throw new Error(`schemaVersion ${from} was never used`);
  let entry = raw as StoredEntry;
  for (let version = from; version < JOURNAL_SCHEMA_VERSION; version++) entry = MIGRATIONS[version - 1]!(entry);
  const parsed = JournalEntrySchema.safeParse(entry);
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
  return parsed.data;
}

export type Journal = {
  /** Adds an entry to the slot's Journal, and returns it as stored. */
  append(slotId: string, entry: NewJournalEntry): Promise<JournalEntry>;
  /** Every entry in the slot's Journal, newest first. Rejects, naming the slot, if any entry can't be read. */
  list(slotId: string): Promise<JournalEntry[]>;
  /** The slot's entries as stored, oldest first, readable or not. */
  raw(slotId: string): Promise<unknown[]>;
  /** Puts a whole Journal, oldest first, into a slot, in place of any it had. */
  restore(slotId: string, entries: JournalEntry[]): Promise<void>;
  /** Removes the slot's Journal. */
  remove(slotId: string): Promise<void>;
};

export function createJournal(openStore: () => UseStore): Journal {
  let store: UseStore | null = null;
  const entries = () => (store ??= openStore());

  return {
    append: async (slotId, entry) => {
      const stored = JournalEntrySchema.parse({
        ...journalPage(entry),
        schemaVersion: JOURNAL_SCHEMA_VERSION,
        id: crypto.randomUUID(),
        writtenAt: new Date().toISOString(),
      });
      await update<unknown[]>(slotId, (old) => [...(old ?? []), stored], entries());
      return stored;
    },
    list: async (slotId) => {
      const raw = (await get<unknown[]>(slotId, entries())) ?? [];
      return raw
        .map((entry, i) => {
          try {
            return parseJournalEntry(entry);
          } catch (error) {
            throw new Error(`The Journal for ${slotId} can't be read: entry ${i + 1} ${error instanceof Error ? error.message : error}`);
          }
        })
        .reverse();
    },
    raw: async (slotId) => (await get<unknown[]>(slotId, entries())) ?? [],
    restore: async (slotId, restored) => {
      await set(slotId, restored.map((entry) => JournalEntrySchema.parse(entry)), entries());
    },
    remove: (slotId) => del(slotId, entries()),
  };
}

/** The browser's Journal, in its own IndexedDB database. */
export const browserJournal = createJournal(() => createStore('insomniacs-journal', 'entries'));
