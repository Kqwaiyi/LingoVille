import { createStore, delMany, entries, get, promisifyRequest, set, type UseStore } from 'idb-keyval';
import { z } from 'zod';
import {
  APPEARANCE_PRESET_IDS,
  CULTURE_PACKS,
  DIETARY_NOTE_IDS,
  drinkModifiersSchema,
  INTERACTIONS,
  ITEM_IDS,
  menuPrice,
  NAMED_NPCS,
  SHIFT_TEMPLATES,
  type ItemId,
  type NamedNpcId,
} from '../content/index.ts';
import {
  DEBT_KINDS,
  ECONOMY,
  ILLNESS_IDS,
  JOB_IDS,
  LANGUAGE_CODES,
  LIFE_SKILL_IDS,
  PLACE_IDS,
  PROFICIENCY_STEPS,
  weeklyRent,
  type GameState,
  type LanguageCode,
  type ProficiencyStep,
} from '../sim/index.ts';

// Saves: one Character's whole life per slot, in IndexedDB. A save is the sim
// state plus a little metadata. Every load goes through the ordered migrations
// and then Zod, so a save is either the game as it was or a loud failure.
// Content is referenced by id, and an id the game no longer knows fails loudly.

export const SAVE_SCHEMA_VERSION = 15;

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
  lastOrder: z.object({ interactionId: z.enum(INTERACTION_IDS), args: z.unknown(), inARow: z.int().min(1) }).nullable(),
  lastTopic: z.string().nullable(),
  favouriteKnown: z.boolean(),
  lastGiftDay: day.nullable(),
  lastOnTheHouseDay: day.nullable(),
  registerOffered: z.boolean(),
});

/** One line of items in the inventory. */
const orderLine = z.object({ itemId: z.enum(ITEM_IDS), quantity: z.int().min(1) });

/** One line of a Shift Customer's order: a café drink made to order says how it's made. */
const shiftOrder = z
  .array(
    orderLine.extend({ modifiers: drinkModifiersSchema.optional() }),
  )
  .readonly();

/** What a customer at the supermarket till wants besides their shopping rung up. */
const checkout = z.object({
  bag: z.boolean(),
  pointsCard: z.boolean(),
  fromBehindTheCounter: z.enum(ITEM_IDS).nullable(),
  cashHanded: z.number().positive().nullable(),
  changeDue: z.number().min(0).nullable(),
});

/** One diner at a restaurant table: their dish, their drink and any dietary need. */
const diner = z.object({ dish: z.enum(ITEM_IDS), drink: z.enum(ITEM_IDS), note: z.enum(DIETARY_NOTE_IDS).nullable() });

const SHIFT_TEMPLATE_IDS = Object.values(SHIFT_TEMPLATES).flatMap((templates) => templates.map(({ id }) => id)) as [string, ...string[]];

const GameStateSchema = z.object({
  rngState: z.int().min(0),
  identity: z.object({
    characterName: z.string(),
    targetLanguage: z.enum(LANGUAGE_CODES),
    culturePackId: z.enum(PACK_IDS),
    // Any id outside the Appearance Preset pool fails loudly. Every save so far holds preset-1, so no migration is needed.
    appearancePresetId: z.enum(APPEARANCE_PRESET_IDS),
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
    foodPoisoningChance: z.number().min(0).max(1),
  }),
  rent: z.object({
    dueDay: day,
    owedInShifts: z.number().min(0),
    extendedThroughDay: day.nullable(),
    remindedOnDay: day.nullable(),
  }),
  debts: z.array(z.object({ kind: z.enum(DEBT_KINDS), amountInShifts: z.number().min(0) })),
  paymentPlans: z.array(
    z.object({ debtKind: z.enum(DEBT_KINDS), instalmentInShifts: z.number().min(0), nextDueDay: day }),
  ),
  wokeInWardOnDay: day.nullable(),
  parkWavedOnDay: day.nullable(),
  proficiencyStep: z.enum(PROFICIENCY_STEPS),
  progression: z.object({
    proficiencyScore: z.number().min(0),
    evidenceSoFar: z.number().min(0),
    highestStep: z.enum(PROFICIENCY_STEPS),
    newcomerDiscountStep: z.enum(PROFICIENCY_STEPS),
    lifeSkillXp: z.record(z.enum(LIFE_SKILL_IDS), z.number().min(0)),
    lastShiftDay: day.nullable(),
    shiftDays: z.array(day),
    today: z.object({ day, homeMeals: z.int().min(0), gymSessions: z.int().min(0) }),
  }),
  possessions: z.object({
    inventory: z.array(orderLine.extend({ expiresOnDay: day.nullable() })),
    gymMembershipUntilDay: day.nullable(),
    addressRegistered: z.boolean(),
    jobsHired: z.array(z.enum(JOB_IDS)),
    shift: z
      .object({
        jobId: z.enum(JOB_IDS),
        customers: z.int().min(1),
        served: z.int().min(0),
        failed: z.int().min(0),
        translated: z.int().min(0),
        customer: z
          .object({
            templateId: z.enum(SHIFT_TEMPLATE_IDS),
            order: shiftOrder,
            changedFrom: shiftOrder.nullable(),
            checkout: checkout.nullable(),
            table: z.array(diner).min(1).readonly().nullable(),
            voiceSeed: z.int().min(0),
          })
          .nullable(),
      })
      .nullable(),
  }),
  restaurant: z.object({ seated: z.boolean(), bill: z.array(orderLine.extend({ priceInShifts: z.number().min(0) })) }),
  phrasebook: z.array(
    z.object({ text: z.string(), reading: z.string(), gloss: z.string(), glossLanguage: z.enum(LANGUAGE_CODES), dayAdded: day }),
  ),
  onboarding: z.object({ firstMorningStepsDone: z.int().min(0), firstMorningSkipped: z.boolean() }),
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

/** The 4 save slots. Any slot can hold any Target Language. */
export const SLOT_IDS = ['slot-1', 'slot-2', 'slot-3', 'slot-4'] as const;
export type SlotId = (typeof SLOT_IDS)[number];

/** A stored save in some older shape. Migrations only touch what changed. */
type StoredSave = { schemaVersion: number; game: Record<string, unknown> } & Record<string, unknown>;

/**
 * Ordered migrations: `MIGRATIONS[n]` upgrades a save from version n + 1 to
 * n + 2. A migration that renames or drops content remaps or removes its ids.
 */
const MIGRATIONS: readonly ((save: StoredSave) => StoredSave)[] = [
  // 1 → 2: saves gain the personal phrasebook, empty.
  (save) => ({ ...save, schemaVersion: 2, game: { ...save.game, phrasebook: [] } }),
  // 2 → 3: the First Morning can be skipped from setup. No save so far skipped it.
  (save) => ({
    ...save,
    schemaVersion: 3,
    game: { ...save.game, onboarding: { ...(save.game.onboarding as object), firstMorningSkipped: false } },
  }),
  // 3 → 4: Recap evidence moves Language Proficiency. No conversation has moved it yet.
  (save) => ({
    ...save,
    schemaVersion: 4,
    game: { ...save.game, progression: { ...(save.game.progression as object), evidenceSoFar: 0 } },
  }),
  // 4 → 5: Health running out faints the Character. No one has fainted yet.
  (save) => ({ ...save, schemaVersion: 5, game: { ...save.game, wokeInWardOnDay: null } }),
  // 5 → 6: cooking gone-off food records a food poisoning chance. Nothing has been cooked yet.
  (save) => ({
    ...save,
    schemaVersion: 6,
    game: { ...save.game, character: { ...(save.game.character as object), foodPoisoningChance: 0 } },
  }),
  // 6 → 7: rent falls due. Nothing ever set what was owed, so this week's rent is owed in full, at the
  // Newcomer Discount for the highest step reached. A save already past its first due day moves on to the
  // next one: the weeks that never fell due are forgiven rather than turned into debt.
  (save) => {
    const { clock, rent, progression } = save.game as {
      clock: { day: number };
      rent: { dueDay: number };
      progression: { highestStep: ProficiencyStep };
    };
    let { dueDay } = rent;
    while (dueDay < clock.day) dueDay += ECONOMY.rentPeriodDays;
    const owedInShifts = weeklyRent(progression.highestStep);
    return {
      ...save,
      schemaVersion: 7,
      game: { ...save.game, rent: { dueDay, owedInShifts, extendedThroughDay: null, remindedOnDay: null } },
    };
  },
  // 7 → 8: Shifts can be worked. No Shift could start before, so none is under way and none was worked.
  (save) => ({
    ...save,
    schemaVersion: 8,
    game: {
      ...save.game,
      progression: { ...(save.game.progression as object), lastShiftDay: null },
      possessions: { ...(save.game.possessions as object), shift: null },
    },
  }),
  // 8 → 9: Shift Customers come from templates, and some change their mind. Every one so far ordered a single drink.
  (save) => {
    const possessions = save.game.possessions as { shift: { customer: object | null } | null };
    const { shift } = possessions;
    const customer = shift?.customer && { templateId: 'barista-single-drink', ...shift.customer, changedFrom: null };
    return {
      ...save,
      schemaVersion: 9,
      game: { ...save.game, possessions: { ...possessions, shift: shift && { ...shift, customer } } },
    };
  },
  // 9 → 10: translated Shift Customers are docked, and working too many days a week costs Mood. No customer under way
  // has been marked translated, and the only Shift day known is the last one.
  (save) => {
    const progression = save.game.progression as { lastShiftDay: number | null };
    const possessions = save.game.possessions as { shift: object | null };
    return {
      ...save,
      schemaVersion: 10,
      game: {
        ...save.game,
        progression: { ...progression, shiftDays: progression.lastShiftDay === null ? [] : [progression.lastShiftDay] },
        possessions: { ...possessions, shift: possessions.shift && { ...possessions.shift, translated: 0 } },
      },
    };
  },
  // 10 → 11: the cashier's till. Only barista Shifts could be worked, so a customer at the counter has no checkout.
  (save) => {
    const possessions = save.game.possessions as { shift: { customer: object | null } | null };
    const { shift } = possessions;
    const customer = shift?.customer && { ...shift.customer, checkout: null };
    return {
      ...save,
      schemaVersion: 11,
      game: { ...save.game, possessions: { ...possessions, shift: shift && { ...shift, customer } } },
    };
  },
  // 11 → 12: restaurant tables. No server Shift could be worked, so a customer at the counter has no table.
  (save) => {
    const possessions = save.game.possessions as { shift: { customer: object | null } | null };
    const { shift } = possessions;
    const customer = shift?.customer && { ...shift.customer, table: null };
    return {
      ...save,
      schemaVersion: 12,
      game: { ...save.game, possessions: { ...possessions, shift: shift && { ...shift, customer } } },
    };
  },
  // 12 → 13: a table and a bill at the restaurant. No one could be seated before, so no one is, and nothing is owed.
  (save) => ({ ...save, schemaVersion: 13, game: { ...save.game, restaurant: { seated: false, bill: [] } } }),
  // 13 → 14: each line of the bill keeps its price, so a bill walked out on can become debt. An open bill is priced from the menu.
  (save) => {
    const game = save.game as { identity: { culturePackId: LanguageCode }; restaurant: { seated: boolean; bill: { itemId: ItemId; quantity: number }[] } };
    const { restaurant, identity } = game;
    // An item the game no longer has is left unpriced, for Zod to name.
    const bill = restaurant.bill.map((line) =>
      ITEM_IDS.includes(line.itemId) ? { ...line, priceInShifts: menuPrice(line.itemId, identity.culturePackId) } : line,
    );
    return { ...save, schemaVersion: 14, game: { ...save.game, restaurant: { ...restaurant, bill } } };
  },
  // 14 → 15: regulars. No order run toward a usual was counted, no one gave anything on the house, and no park regular waved today.
  (save) => {
    const people = Object.fromEntries(
      Object.entries(save.game.people as Record<string, object>).map(([npcId, memory]) => [npcId, { ...memory, lastOrder: null, lastOnTheHouseDay: null }]),
    );
    return { ...save, schemaVersion: 15, game: { ...save.game, people, parkWavedOnDay: null } };
  },
];

/** A loose look at a stored field, for bytes that may not be a readable save. */
function peek(raw: unknown, ...path: string[]): unknown {
  let at = raw;
  for (const key of path) at = typeof at === 'object' && at !== null && key in at ? (at as Record<string, unknown>)[key] : undefined;
  return at;
}
const peekString = (raw: unknown, ...path: string[]) => {
  const found = peek(raw, ...path);
  return typeof found === 'string' ? found : null;
};
const peekNumber = (raw: unknown, ...path: string[]) => {
  const found = peek(raw, ...path);
  return typeof found === 'number' ? found : null;
};

/**
 * Reads stored bytes as a save of today's version: through the ordered
 * migrations, then Zod. Throws, saying why, if they can't be read.
 */
export function parseSave(raw: unknown): Save {
  const from = peekNumber(raw, 'schemaVersion');
  if (from === null) throw new Error('it has no schemaVersion');
  if (from > SAVE_SCHEMA_VERSION) throw new Error(`it was made by a newer version of the game (v${from})`);
  if (from < 1) throw new Error(`schemaVersion ${from} was never used`);
  let save = raw as StoredSave;
  for (let version = from; version < SAVE_SCHEMA_VERSION; version++) save = MIGRATIONS[version - 1]!(save);
  const parsed = SaveSchema.safeParse(save);
  if (!parsed.success) throw new Error(z.prettifyError(parsed.error));
  return parsed.data;
}

function readable(raw: unknown) {
  try {
    parseSave(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Backups sit beside the save under `<slotId>/<name>`: the start-of-day backup,
 * rotated at the first save of each new day and by a save that starts one (waking up); a pre-migration backup per
 * version migrated from; and a damaged main save, kept aside once play goes on
 * from the start-of-day backup rather than written over.
 */
const START_OF_DAY = 'start-of-day';
const backupKey = (slotId: string, name: string) => `${slotId}/${name}`;

export type LoadedSave = {
  save: Save;
  /** The main save couldn't be loaded, so this is this morning's backup. */
  fromBackup: boolean;
};

/** What a slot holds. `lastPlayedAt` is the main save's, as stored, so slots sort the same however they load. */
export type Slot =
  | { slotId: SlotId; status: 'empty' }
  | ({ slotId: SlotId; status: 'ready'; lastPlayedAt: string } & LoadedSave)
  | { slotId: SlotId; status: 'damaged'; lastPlayedAt: string; message: string; characterName: string | null };

/** What an export tells about a backup, without its contents. */
export type BackupInfo = { name: string; schemaVersion: number | null; day: number | null; lastPlayedAt: string | null };

export type Saves = {
  /**
   * Saves the game into a slot, keeping when the save was created. Returns it as stored.
   * With `startsDay`, it also becomes the start-of-day backup, even on the same day number.
   */
  write(slotId: string, game: GameState, options?: { startsDay?: boolean }): Promise<Save>;
  /**
   * The slot's save, upgraded if it was old, or null if the slot is empty. If
   * the main save can't be loaded, this morning's backup is loaded instead.
   * Rejects, naming the slot, if neither can be. Nothing is deleted.
   */
  load(slotId: string): Promise<LoadedSave | null>;
  /** Every slot, in order. */
  slots(): Promise<Slot[]>;
  /** Puts a save into an empty slot, as it was. Rejects if the slot isn't empty. */
  restore(slotId: string, save: Save): Promise<Save>;
  /** Removes the slot's save and all its backups. */
  remove(slotId: string): Promise<void>;
  backups(slotId: string): Promise<BackupInfo[]>;
  /** Everything stored for the slot, as found, readable or not. */
  raw(slotId: string): Promise<{ save: unknown; backups: Record<string, unknown> }>;
};

export function createSaves(openStore: () => UseStore, { now = () => new Date() } = {}): Saves {
  let store: UseStore | null = null;
  const db = () => (store ??= openStore());

  /**
   * Stores a save in one transaction. A damaged main save is kept aside rather
   * than written over, and the start-of-day backup is rotated on a new day, or
   * whenever the save `startsDay`.
   */
  const put = async (slotId: string, next: (old: unknown) => Save, startsDay = false): Promise<Save> =>
    db()('readwrite', (objects) => {
      let stored: Save | null = null;
      let failed: unknown = null;
      const main = objects.get(slotId);
      main.onsuccess = () => {
        const old: unknown = main.result;
        try {
          stored = SaveSchema.parse(next(old));
        } catch (error) {
          failed = error;
          objects.transaction.abort();
          return;
        }
        if (old !== undefined && !readable(old)) objects.put(old, backupKey(slotId, `damaged-${now().toISOString()}`));
        objects.put(stored, slotId);
        const backup = objects.get(backupKey(slotId, START_OF_DAY));
        backup.onsuccess = () => {
          if (startsDay || peekNumber(backup.result, 'game', 'clock', 'day') !== stored!.game.clock.day) {
            objects.put(stored, backupKey(slotId, START_OF_DAY));
          }
        };
      };
      return promisifyRequest(objects.transaction).then(
        () => stored!,
        (error: unknown) => Promise.reject(failed ?? error),
      );
    });

  const load = async (slotId: string): Promise<LoadedSave | null> => {
    const raw = await get<unknown>(slotId, db());
    if (raw === undefined) return null;

    let save: Save;
    try {
      save = parseSave(raw);
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      try {
        return { save: parseSave(await get<unknown>(backupKey(slotId, START_OF_DAY), db())), fromBackup: true };
      } catch {
        throw new Error(`The save in ${slotId} can't be loaded: ${why}`);
      }
    }

    const from = peekNumber(raw, 'schemaVersion')!;
    if (from < SAVE_SCHEMA_VERSION) {
      await set(backupKey(slotId, `pre-migration-v${from}`), raw, db());
      await set(slotId, save, db());
    }
    return { save, fromBackup: false };
  };

  /** The slot's backups, by name. */
  const backupEntries = async (slotId: string) => {
    const prefix = backupKey(slotId, '');
    return (await entries<IDBValidKey, unknown>(db()))
      .filter((entry): entry is [string, unknown] => typeof entry[0] === 'string' && entry[0].startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value] as const);
  };

  return {
    write: (slotId, game, { startsDay = false } = {}) => {
      const playedAt = now().toISOString();
      return put(
        slotId,
        (old) => ({
          schemaVersion: SAVE_SCHEMA_VERSION,
          slotId,
          createdAt: peekString(old, 'createdAt') ?? playedAt,
          lastPlayedAt: playedAt,
          game,
        }),
        startsDay,
      );
    },
    load,
    slots: () =>
      Promise.all(
        SLOT_IDS.map(async (slotId): Promise<Slot> => {
          const raw = await get<unknown>(slotId, db());
          if (raw === undefined) return { slotId, status: 'empty' };
          const lastPlayedAt = peekString(raw, 'lastPlayedAt') ?? '';
          try {
            return { slotId, status: 'ready', lastPlayedAt, ...(await load(slotId))! };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const characterName = peekString(raw, 'game', 'identity', 'characterName');
            return { slotId, status: 'damaged', lastPlayedAt, message, characterName };
          }
        }),
      ),
    restore: (slotId, save) =>
      put(slotId, (old) => {
        if (old !== undefined) throw new Error(`A save can only be restored into an empty slot, and ${slotId} isn't empty`);
        return { ...save, slotId };
      }),
    remove: async (slotId) => {
      const backups = (await backupEntries(slotId)).map(([name]) => backupKey(slotId, name));
      await delMany([slotId, ...backups], db());
    },
    backups: async (slotId) =>
      (await backupEntries(slotId)).map(([name, value]) => ({
        name,
        schemaVersion: peekNumber(value, 'schemaVersion'),
        day: peekNumber(value, 'game', 'clock', 'day'),
        lastPlayedAt: peekString(value, 'lastPlayedAt'),
      })),
    raw: async (slotId) => ({
      save: await get<unknown>(slotId, db()),
      backups: Object.fromEntries(await backupEntries(slotId)),
    }),
  };
}

/** The browser's saves, in their own IndexedDB database. */
export const browserSaves = createSaves(() => createStore('insomniacs-saves', 'saves'));
