import 'fake-indexeddb/auto';
import { createStore, get, set } from 'idb-keyval';
import { describe, expect, it } from 'vitest';
import { createSave, type GameState } from '../sim/index.ts';
import { createSaves, DEV_SETUP, SAVE_SCHEMA_VERSION } from './index.ts';

let databases = 0;
/** Saves over their own fresh IndexedDB database, with the raw store so a test can plant or read stored bytes. */
function freshSaves(now = () => new Date('2026-10-03T09:00:00Z')) {
  const raw = createStore(`saves-test-${++databases}`, 'saves');
  return { saves: createSaves(() => raw, { now }), raw };
}

/** A game well under way, with every field group filled in. */
function lived(): GameState {
  const game = createSave(DEV_SETUP);
  return {
    ...game,
    rngState: 123456789,
    clock: { day: 3, minuteOfDay: 14 * 60 + 25.5 },
    placeId: 'cafe',
    character: { ...game.character, moneyInShifts: 1.25, mood: 61, illness: { illnessId: 'cold', onsetDay: 2 } },
    rent: { dueDay: 7, owedInShifts: 2 },
    debts: [{ kind: 'hospital', amountInShifts: 1.5 }],
    paymentPlans: [{ debtKind: 'hospital', instalmentInShifts: 0.5, nextDueDay: 5 }],
    progression: {
      ...game.progression,
      proficiencyScore: 0.8,
      lifeSkillXp: { ...game.progression.lifeSkillXp, barista: 9 },
      today: { day: 3, homeMeals: 1, gymSessions: 0 },
    },
    possessions: {
      inventory: [{ itemId: 'tea', quantity: 2, expiresOnDay: null }],
      gymMembershipUntilDay: 33,
      addressRegistered: true,
      jobsHired: ['barista'],
      shift: { jobId: 'barista', customersServed: 2, payInShifts: 0.3 },
    },
    phrasebook: [{ text: 'ラテ', reading: 'らて', gloss: 'latte', glossLanguage: 'en', dayAdded: 1 }],
    onboarding: { firstMorningStepsDone: 2 },
    people: {
      barista: {
        familiarity: 4,
        todaysGain: { day: 3, amount: 1 },
        timesMet: 3,
        knowsName: true,
        usualOrder: { interactionId: 'order-drink', args: { items: [{ item: 'latte', quantity: 1 }] } },
        lastTopic: 'the house blend',
        favouriteKnown: false,
        lastGiftDay: null,
        registerOffered: false,
      },
    },
  };
}

describe('saves', () => {
  it('loads back exactly the game that was saved, RNG state and phrasebook included', async () => {
    const { saves } = freshSaves();
    const game = lived();

    await saves.write('slot-1', game);

    const loaded = await saves.load('slot-1');
    expect(loaded?.game).toEqual(game);
    expect(loaded).toMatchObject({ schemaVersion: SAVE_SCHEMA_VERSION, slotId: 'slot-1' });
  });

  it('survives a reload: new saves over the same database read the same game', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());

    expect((await createSaves(() => raw).load('slot-1'))?.game).toEqual(lived());
  });

  it('has nothing to load from an empty slot', async () => {
    const { saves } = freshSaves();

    expect(await saves.load('slot-1')).toBeNull();
    expect(await saves.mostRecent()).toBeNull();
  });

  it('keeps when the save was created, and stamps when it was last played on every write', async () => {
    let clock = new Date('2026-10-03T09:00:00Z');
    const { saves } = freshSaves(() => clock);

    await saves.write('slot-1', createSave(DEV_SETUP));
    clock = new Date('2026-10-04T20:30:00Z');
    await saves.write('slot-1', lived());

    expect(await saves.load('slot-1')).toMatchObject({
      createdAt: '2026-10-03T09:00:00.000Z',
      lastPlayedAt: '2026-10-04T20:30:00.000Z',
    });
  });

  it('continues the most recently played slot', async () => {
    let clock = new Date('2026-10-03T09:00:00Z');
    const { saves } = freshSaves(() => clock);

    await saves.write('slot-1', createSave(DEV_SETUP));
    clock = new Date('2026-10-03T10:00:00Z');
    await saves.write('slot-2', lived());
    expect((await saves.mostRecent())?.slotId).toBe('slot-2');

    clock = new Date('2026-10-03T11:00:00Z');
    await saves.write('slot-1', createSave(DEV_SETUP));
    expect((await saves.mostRecent())?.slotId).toBe('slot-1');
    expect((await saves.usedSlots()).sort()).toEqual(['slot-1', 'slot-2']);
  });

  it('upgrades an old save through the migrations, after backing up the bytes it found', async () => {
    const { saves, raw } = freshSaves();
    const beforePhrasebooks: Partial<GameState> = lived();
    delete beforePhrasebooks.phrasebook;
    const v1 = {
      schemaVersion: 1,
      slotId: 'slot-1',
      createdAt: '2026-10-01T09:00:00.000Z',
      lastPlayedAt: '2026-10-02T09:00:00.000Z',
      game: beforePhrasebooks,
    };
    await set('slot-1', v1, raw);

    const loaded = await saves.load('slot-1');

    expect(loaded?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded?.game).toEqual({ ...lived(), phrasebook: [] });
    expect(loaded?.lastPlayedAt).toBe(v1.lastPlayedAt);
    expect(await get('slot-1/pre-migration-v1', raw)).toEqual(v1);
    // The upgraded save is stored, so the next load needs no migration.
    expect(await get('slot-1', raw)).toMatchObject({ schemaVersion: SAVE_SCHEMA_VERSION });
  });

  it('fails loudly, naming the field, when a save refers to content the game no longer has', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());
    const stored = (await get<{ game: GameState }>('slot-1', raw))!;
    await set('slot-1', { ...stored, game: { ...stored.game, placeId: 'library' } }, raw);

    await expect(saves.load('slot-1')).rejects.toThrow(/slot-1.*placeId/s);
  });

  it('fails loudly on an unknown Named NPC or item id', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());
    const stored = (await get<{ game: GameState }>('slot-1', raw))!;

    await set('slot-1', { ...stored, game: { ...stored.game, people: { ghost: stored.game.people.barista } } }, raw);
    await expect(saves.load('slot-1')).rejects.toThrow(/people/);

    const inventory = [{ itemId: 'espresso-tonic', quantity: 1, expiresOnDay: null }];
    await set('slot-1', { ...stored, game: { ...stored.game, possessions: { ...stored.game.possessions, inventory } } }, raw);
    await expect(saves.load('slot-1')).rejects.toThrow(/inventory/);
  });

  it('refuses a save from a newer version of the game', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());
    const stored = (await get<object>('slot-1', raw))!;
    await set('slot-1', { ...stored, schemaVersion: SAVE_SCHEMA_VERSION + 1 }, raw);

    await expect(saves.load('slot-1')).rejects.toThrow(/newer/);
  });
});
