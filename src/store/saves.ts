import { createStore, entries, get, set, update, type UseStore } from 'idb-keyval';
import { z } from 'zod';
import { CAFE_ITEM_IDS, CULTURE_PACKS, INTERACTIONS, NAMED_NPCS, type NamedNpcId } from '../content/index.ts';
import {
  DEBT_KINDS,
  ILLNESS_IDS,
  JOB_IDS,
  LANGUAGE_CODES,
  LIFE_SKILL_IDS,
  PLACE_IDS,
  PROFICIENCY_STEPS,
  type GameState,
  type LanguageCode,
} from '../sim/index.ts';

// Saves: one Character's whole life per slot, in IndexedDB. A save is the sim
// state plus a little metadata. Every load goes through the ordered migrations
// and then Zod, so a save is either the game as it was or a loud failure.
// Content is referenced by id, and an id the game no longer knows fails loudly.

export const SAVE_SCHEMA_VERSION = 2;

const PACK_IDS = Object.keys(CULTURE_PACKS) as [LanguageCode, ...LanguageCode[]];
const NPC_IDS = Object.keys(NAMED_NPCS) as [NamedNpcId, ...NamedNpcId[]];
const INTERACTION_IDS = Object.values(INTERACTIONS).map((interaction) => interaction.id) as [string, ...string[]];

const meter = z.number().min(0);
const day = z.int().min(1);

const NpcMemorySchema = z.object({
  familiarity: z.number().min(0),
  todaysGain: z.object({ day, amount: z.number().min(0) }),
  timesMet: z.int().min(0),
  knowsName: z.boolean(),
  usualOrder: z.object({ interactionId: z.enum(INTERACTION_IDS), args: z.unknown() }).nullable(),
  lastTopic: z.string().nullable(),
  favouriteKnown: z.boolean(),
  lastGiftDay: day.nullable(),
  registerOffered: z.boolean(),
});

const GameStateSchema = z.object({
  rngState: z.int().min(0),
  identity: z.object({
    characterName: z.string(),
    targetLanguage: z.enum(LANGUAGE_CODES),
    culturePackId: z.enum(PACK_IDS),
    // Checked against the Appearance Preset pool once it is content (ticket 30).
    appearancePresetId: z.string(),
  }),
  clock: z.object({ day, minuteOfDay: z.number().min(0) }),
  placeId: z.enum(PLACE_IDS),
  character: z.object({
    health: meter,
    hunger: meter,
    thirst: meter,
    mood: meter,
    moneyInShifts: z.number(),
    illness: z.object({ illnessId: z.enum(ILLNESS_IDS), onsetDay: day }).nullable(),
  }),
  rent: z.object({ dueDay: day, owedInShifts: z.number().min(0) }),
  debts: z.array(z.object({ kind: z.enum(DEBT_KINDS), amountInShifts: z.number().min(0) })),
  paymentPlans: z.array(
    z.object({ debtKind: z.enum(DEBT_KINDS), instalmentInShifts: z.number().min(0), nextDueDay: day }),
  ),
  proficiencyStep: z.enum(PROFICIENCY_STEPS),
  progression: z.object({
    proficiencyScore: z.number().min(0),
    highestStep: z.enum(PROFICIENCY_STEPS),
    newcomerDiscountStep: z.enum(PROFICIENCY_STEPS),
    lifeSkillXp: z.record(z.enum(LIFE_SKILL_IDS), z.number().min(0)),
    today: z.object({ day, homeMeals: z.int().min(0), gymSessions: z.int().min(0) }),
  }),
  possessions: z.object({
    inventory: z.array(z.object({ itemId: z.enum(CAFE_ITEM_IDS), quantity: z.int().min(1), expiresOnDay: day.nullable() })),
    gymMembershipUntilDay: day.nullable(),
    addressRegistered: z.boolean(),
    jobsHired: z.array(z.enum(JOB_IDS)),
    shift: z.object({ jobId: z.enum(JOB_IDS), customersServed: z.int().min(0), payInShifts: z.number().min(0) }).nullable(),
  }),
  phrasebook: z.array(
    z.object({ text: z.string(), reading: z.string(), gloss: z.string(), glossLanguage: z.enum(LANGUAGE_CODES), dayAdded: day }),
  ),
  onboarding: z.object({ firstMorningStepsDone: z.int().min(0) }),
  people: z.partialRecord(z.enum(NPC_IDS), NpcMemorySchema),
}) satisfies z.ZodType<GameState>;

const SaveSchema = z.object({
  schemaVersion: z.literal(SAVE_SCHEMA_VERSION),
  slotId: z.string(),
  /** Real time, as ISO strings. */
  createdAt: z.string(),
  lastPlayedAt: z.string(),
  game: GameStateSchema,
});

export type Save = z.infer<typeof SaveSchema>;

/** A stored save in some older shape. Migrations only touch what changed. */
type StoredSave = { schemaVersion: number; game: Record<string, unknown> } & Record<string, unknown>;

/**
 * Ordered migrations: `MIGRATIONS[n]` upgrades a save from version n + 1 to
 * n + 2. A migration that renames or drops content remaps or removes its ids.
 */
const MIGRATIONS: readonly ((save: StoredSave) => StoredSave)[] = [
  // 1 → 2: saves gain the personal phrasebook, empty.
  (save) => ({ ...save, schemaVersion: 2, game: { ...save.game, phrasebook: [] } }),
];

/** Saves are keyed by slot id. Backups sit beside them under `<slotId>/…`. */
const backupKey = (slotId: string, name: string) => `${slotId}/${name}`;
const isSlotKey = (key: IDBValidKey): key is string => typeof key === 'string' && !key.includes('/');

export type Saves = {
  /** Saves the game into a slot, keeping when the save was created. Returns it as stored. */
  write(slotId: string, game: GameState): Promise<Save>;
  /** The slot's save, upgraded if it was old, or null if the slot is empty. Rejects, naming the slot, if it can't be loaded. */
  load(slotId: string): Promise<Save | null>;
  /** The save played most recently, or null if there are none. */
  mostRecent(): Promise<Save | null>;
  /** The ids of the slots that hold a save. */
  usedSlots(): Promise<string[]>;
};

export function createSaves(openStore: () => UseStore, { now = () => new Date() } = {}): Saves {
  let store: UseStore | null = null;
  const db = () => (store ??= openStore());

  const fail = (slotId: string, why: string): never => {
    throw new Error(`The save in ${slotId} can't be loaded: ${why}`);
  };

  const load = async (slotId: string): Promise<Save | null> => {
    const raw = await get<unknown>(slotId, db());
    if (raw === undefined) return null;
    if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw) || typeof raw.schemaVersion !== 'number') {
      return fail(slotId, 'it has no schemaVersion');
    }

    let save = raw as StoredSave;
    const from = save.schemaVersion;
    if (from > SAVE_SCHEMA_VERSION) return fail(slotId, `it was made by a newer version of the game (v${from})`);
    if (from < 1) return fail(slotId, `schemaVersion ${from} was never used`);
    if (from < SAVE_SCHEMA_VERSION) {
      await set(backupKey(slotId, `pre-migration-v${from}`), raw, db());
      for (let version = from; version < SAVE_SCHEMA_VERSION; version++) save = MIGRATIONS[version - 1]!(save);
    }

    const parsed = SaveSchema.safeParse(save);
    if (!parsed.success) return fail(slotId, z.prettifyError(parsed.error));
    if (from < SAVE_SCHEMA_VERSION) await set(slotId, parsed.data, db());
    return parsed.data;
  };

  const usedSlots = async () => (await entries(db())).map(([key]) => key).filter(isSlotKey);

  return {
    write: async (slotId, game) => {
      const playedAt = now().toISOString();
      let stored: Save | null = null;
      await update<unknown>(
        slotId,
        (old) => {
          const createdAt =
            typeof old === 'object' && old !== null && 'createdAt' in old && typeof old.createdAt === 'string' ? old.createdAt : playedAt;
          stored = SaveSchema.parse({ schemaVersion: SAVE_SCHEMA_VERSION, slotId, createdAt, lastPlayedAt: playedAt, game });
          return stored;
        },
        db(),
      );
      return stored!;
    },
    load,
    mostRecent: async () => {
      // Pick by the stored timestamp first, so a damaged save in another slot never stands in the way.
      const latest = (await entries<IDBValidKey, unknown>(db()))
        .filter(([key]) => isSlotKey(key))
        .map(([key, value]) => {
          const lastPlayedAt = typeof value === 'object' && value !== null && 'lastPlayedAt' in value ? value.lastPlayedAt : '';
          return { slotId: key as string, lastPlayedAt: typeof lastPlayedAt === 'string' ? lastPlayedAt : '' };
        })
        .sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt))[0];
      return latest ? load(latest.slotId) : null;
    },
    usedSlots,
  };
}

/** The browser's saves, in their own IndexedDB database. */
export const browserSaves = createSaves(() => createStore('insomniacs-saves', 'saves'));
