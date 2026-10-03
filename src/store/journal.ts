import { createStore, get, update, type UseStore } from 'idb-keyval';
import { z } from 'zod';
import { INTERACTIONS, NAMED_NPCS, type NamedNpcId } from '../content/index.ts';

// The Journal: every Recap the Player has had, kept per slot in its own IndexedDB
// database, apart from the save. Entries are only ever added. Each holds the
// text as it was rendered, in the Native Language it was written in, so later
// changes to prompts or settings never rewrite history.

export const JOURNAL_SCHEMA_VERSION = 1;

const LANGUAGES = ['ja', 'zh', 'en', 'de'] as const;
// Content is referenced by id, and an id the game no longer knows fails loudly.
const NPC_IDS = Object.keys(NAMED_NPCS) as [NamedNpcId, ...NamedNpcId[]];
const INTERACTION_IDS = Object.values(INTERACTIONS).map((interaction) => interaction.id) as [string, ...string[]];

const JournalEntrySchema = z.object({
  schemaVersion: z.literal(JOURNAL_SCHEMA_VERSION),
  id: z.string(),
  /** When it was written, in real time. */
  writtenAt: z.string(),
  kind: z.literal('goal'),
  npcId: z.enum(NPC_IDS),
  interactionId: z.enum(INTERACTION_IDS),
  placeName: z.string(),
  /** The game time the conversation ended. */
  day: z.int(),
  minuteOfDay: z.number(),
  targetLanguage: z.enum(LANGUAGES),
  nativeLanguage: z.enum(LANGUAGES),
  outcome: z.enum(['success', 'failure']),
  /** The Recap as shown, or null if it couldn't be written. */
  recap: z
    .object({
      outcome: z.string(),
      corrections: z.array(z.object({ said: z.string(), natural: z.string(), why: z.string() })),
      newWords: z.array(z.object({ base: z.string(), reading: z.string(), gloss: z.string() })),
    })
    .nullable(),
  lines: z.array(z.object({ speaker: z.enum(['npc', 'player']), text: z.string(), typed: z.boolean().optional() })),
  helpLog: z.array(z.object({ afterLine: z.int().min(0), kind: z.enum(['hint', 'phrasebook', 'translate']), text: z.string() })),
  noHelpNeeded: z.boolean(),
});

export type JournalEntry = z.infer<typeof JournalEntrySchema>;
/** What the game hands the Journal; the Journal stamps the rest. */
export type NewJournalEntry = Omit<JournalEntry, 'schemaVersion' | 'id' | 'writtenAt' | 'noHelpNeeded'>;
/** What a Journal page shows, whether or not it has been stored yet. */
export type JournalPage = Omit<JournalEntry, 'schemaVersion' | 'id' | 'writtenAt'>;

/** The "No Help needed" sticker shows only when the Help log is empty. */
export function journalPage(entry: NewJournalEntry): JournalPage {
  return { ...entry, noHelpNeeded: entry.helpLog.length === 0 };
}

export type Journal = {
  /** Adds an entry to the slot's Journal, and returns it as stored. */
  append(slotId: string, entry: NewJournalEntry): Promise<JournalEntry>;
  /** Every entry in the slot's Journal, newest first. Rejects, naming the slot, if any entry can't be read. */
  list(slotId: string): Promise<JournalEntry[]>;
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
      const parsed = raw.map((entry) => JournalEntrySchema.safeParse(entry));
      const bad = parsed.findIndex((result) => !result.success);
      if (bad >= 0) throw new Error(`The Journal for ${slotId} can't be read: entry ${bad + 1} ${parsed[bad]!.error!.message}`);
      return parsed.map((result) => result.data!).reverse();
    },
  };
}

/** The browser's Journal, in its own IndexedDB database. */
export const browserJournal = createJournal(() => createStore('insomniacs-journal', 'entries'));
