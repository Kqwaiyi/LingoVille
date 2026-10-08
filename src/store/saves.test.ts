import 'fake-indexeddb/auto';
import { createStore, get, keys, set, type UseStore } from 'idb-keyval';
import { describe, expect, it } from 'vitest';
import { menuPrice } from '../content/index.ts';
import { createSave, weeklyRent, type GameState, type NpcMemory, type ShiftCustomer } from '../sim/index.ts';
import { createSaves, DEV_SETUP, SAVE_SCHEMA_VERSION, SLOT_IDS } from './index.ts';

let databases = 0;
/** Saves over their own fresh IndexedDB database, with the raw store so a test can plant or read stored bytes. */
function freshSaves(now = () => new Date('2026-10-03T09:00:00Z')) {
  const raw = createStore(`saves-test-${++databases}`, 'saves');
  return { saves: createSaves(() => raw, { now }), raw };
}

/** Plants stored bytes as both the main save and this morning's backup, so a load can't fall back past them. */
async function plant(raw: UseStore, slotId: string, stored: unknown) {
  await set(slotId, stored, raw);
  await set(`${slotId}/start-of-day`, stored, raw);
}

const garbled = { schemaVersion: SAVE_SCHEMA_VERSION, game: { garbled: true } };

/** A game well under way, with every field group filled in. */
function lived(): GameState {
  const game = createSave(DEV_SETUP);
  return {
    ...game,
    rngState: 123456789,
    clock: { day: 3, minuteOfDay: 14 * 60 + 25.5 },
    placeId: 'cafe',
    character: { ...game.character, moneyInShifts: 1.25, mood: 61, illness: { illnessId: 'cold', onsetDay: 2, treated: false } },
    rent: { dueDay: 7, owedInShifts: weeklyRent('A1'), extendedThroughDay: null, remindedOnDay: null },
    debts: [{ kind: 'hospital', amountInShifts: 1.5 }],
    paymentPlans: [{ debtKind: 'hospital', instalmentInShifts: 0.5, nextDueDay: 5 }],
    progression: {
      ...game.progression,
      proficiencyScore: 0.8,
      lifeSkillXp: { ...game.progression.lifeSkillXp, barista: 9 },
      lastShiftDay: 3,
      shiftDays: [1, 3],
      today: { day: 3, homeMeals: 1, gymSessions: 0 },
    },
    possessions: {
      inventory: [{ itemId: 'tea', quantity: 2, expiresOnDay: null }],
      gymMembershipUntilDay: 33,
      addressRegistered: true,
      jobsHired: ['barista'],
      shift: {
        jobId: 'barista',
        customers: 6,
        served: 2,
        failed: 1,
        translated: 1,
        customer: {
          templateId: 'barista-change-of-mind',
          order: [{ itemId: 'tea', quantity: 1, modifiers: { size: 'large', temperature: 'iced', extras: ['lemon'] } }],
          changedFrom: [{ itemId: 'coffee', quantity: 1, modifiers: { size: 'small', temperature: 'hot', extras: ['milk'] } }],
          checkout: null,
          table: null,
          voiceSeed: 4242,
        },
      },
    },
    phrasebook: [{ text: 'ラテ', reading: 'らて', gloss: 'latte', glossLanguage: 'en', dayAdded: 1 }],
    onboarding: { firstMorningStepsDone: 2, firstMorningSkipped: false },
    people: {
      barista: {
        familiarity: 4,
        todaysGain: { day: 3, amount: 1 },
        timesMet: 3,
        knowsName: true,
        usualOrder: { interactionId: 'order-drink', args: { items: [{ item: 'latte', quantity: 1 }] } },
        lastOrder: null,
        lastTopic: 'the house blend',
        favouriteKnown: false,
        lastGiftDay: null,
        lastOnTheHouseDay: null,
        registerOffered: false,
      },
    },
  };
}

/** The same game, a few hours on. */
const later = (game: GameState): GameState => ({ ...game, clock: { ...game.clock, minuteOfDay: game.clock.minuteOfDay + 180 } });
/** The same game, just after midnight. */
const nextDay = (game: GameState): GameState => ({ ...game, clock: { day: game.clock.day + 1, minuteOfDay: 0 } });

/** The game before Shifts could be worked: version 7. No Shift could start, so none was ever under way. */
function beforeShifts() {
  const game = lived();
  const progression: Partial<GameState['progression']> = { ...game.progression };
  delete progression.lastShiftDay;
  delete progression.shiftDays;
  return { ...game, progression, possessions: { ...game.possessions, shift: null } };
}

/** The game before the clinic: version 15. No one was waiting for the doctor or held a prescription, and no Illness was treated. */
function beforeTheClinic() {
  const game: Partial<GameState> = { ...lived() };
  delete game.clinic;
  const illness = game.character!.illness && { illnessId: game.character!.illness.illnessId, onsetDay: game.character!.illness.onsetDay };
  // Stored before `treated` existed, the Illness has none, whatever its type says.
  return { ...game, character: { ...game.character!, illness } } as unknown as Omit<GameState, 'clinic'>;
}

/** The game before regulars: version 14. No order run or "on the house" day in NPC Memory, and no park wave. */
function beforeRegulars() {
  const game: Partial<GameState> = { ...beforeTheClinic() };
  delete game.parkWavedOnDay;
  const people = Object.fromEntries(
    Object.entries(game.people!).map(([npcId, memory]) => {
      const old: Partial<NpcMemory> = { ...memory };
      delete old.lastOrder;
      delete old.lastOnTheHouseDay;
      return [npcId, old];
    }),
  );
  return { ...game, people } as Omit<GameState, 'parkWavedOnDay'>;
}

/** The game before the Character could eat at the restaurant: version 12. No table, no bill. */
function beforeRestaurantBills() {
  const game: Partial<ReturnType<typeof beforeRegulars>> = { ...beforeRegulars() };
  delete game.restaurant;
  return game as Omit<ReturnType<typeof beforeRegulars>, 'restaurant'>;
}

/** The game before restaurant tables: version 11. A Shift Customer had no table. */
function beforeTables() {
  const game = beforeRestaurantBills();
  const customer: Partial<ShiftCustomer> = { ...game.possessions.shift!.customer! };
  delete customer.table;
  return { ...game, possessions: { ...game.possessions, shift: { ...game.possessions.shift!, customer } } };
}

/** The game before the cashier's till: version 10. A Shift Customer had no checkout. */
function beforeTill() {
  const game = beforeTables();
  const customer: Partial<ShiftCustomer> = { ...game.possessions.shift!.customer! };
  delete customer.checkout;
  return { ...game, possessions: { ...game.possessions, shift: { ...game.possessions.shift!, customer } } };
}

/** The game before translated Shift Customers were docked and overwork cost Mood: version 9. */
function beforeOverwork() {
  const game = beforeTill();
  const progression: Partial<GameState['progression']> = { ...game.progression };
  delete progression.shiftDays;
  const shift: Partial<typeof game.possessions.shift> = { ...game.possessions.shift };
  delete shift.translated;
  return { ...game, progression, possessions: { ...game.possessions, shift } };
}

/** What a save from before Shifts is upgraded to: no Shift under way, and none worked yet. */
function withNoShiftYet(): GameState {
  const game = lived();
  return { ...game, progression: { ...game.progression, lastShiftDay: null, shiftDays: [] }, possessions: { ...game.possessions, shift: null } };
}

/** The game before rent fell due: version 6. Nothing ever set what was owed. */
function beforeRent() {
  return { ...beforeShifts(), rent: { dueDay: 7, owedInShifts: 0 } };
}

/** The game before cooking recorded a food poisoning chance: version 5. */
function beforeCooking() {
  const game = beforeRent();
  const character: Partial<GameState['character']> = { ...game.character };
  delete character.foodPoisoningChance;
  return { ...game, character };
}

/** The game before the Character could faint: version 4. */
function beforeFainting() {
  const game: Partial<ReturnType<typeof beforeCooking>> = beforeCooking();
  delete game.wokeInWardOnDay;
  return game as Omit<ReturnType<typeof beforeCooking>, 'wokeInWardOnDay'>;
}

/** The game before conversations moved Language Proficiency: version 3. */
function beforeProficiencyEvidence() {
  const game = beforeFainting();
  const progression: Partial<GameState['progression']> = { ...game.progression };
  delete progression.evidenceSoFar;
  return { ...game, progression };
}

/** The game before the First Morning could be skipped: version 2. */
function beforeSkippingFirstMornings() {
  const game = beforeProficiencyEvidence();
  return { ...game, onboarding: { firstMorningStepsDone: game.onboarding.firstMorningStepsDone } };
}

/** The game before saves had phrasebooks: version 1. */
function beforePhrasebooks() {
  const game: Partial<ReturnType<typeof beforeSkippingFirstMornings>> = beforeSkippingFirstMornings();
  delete game.phrasebook;
  return game;
}

describe('saves', () => {
  it('loads back exactly the game that was saved, RNG state and phrasebook included', async () => {
    const { saves } = freshSaves();
    const game = lived();

    await saves.write('slot-1', game);

    const loaded = await saves.load('slot-1');
    expect(loaded?.save.game).toEqual(game);
    expect(loaded?.save).toMatchObject({ schemaVersion: SAVE_SCHEMA_VERSION, slotId: 'slot-1' });
    expect(loaded?.fromBackup).toBe(false);
  });

  it('survives a reload: new saves over the same database read the same game', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());

    expect((await createSaves(() => raw).load('slot-1'))?.save.game).toEqual(lived());
  });

  it('has nothing to load from an empty slot', async () => {
    const { saves } = freshSaves();

    expect(await saves.load('slot-1')).toBeNull();
    expect(await saves.slots()).toEqual(SLOT_IDS.map((slotId) => ({ slotId, status: 'empty' })));
  });

  it('keeps when the save was created, and stamps when it was last played on every write', async () => {
    let clock = new Date('2026-10-03T09:00:00Z');
    const { saves } = freshSaves(() => clock);

    await saves.write('slot-1', createSave(DEV_SETUP));
    clock = new Date('2026-10-04T20:30:00Z');
    await saves.write('slot-1', lived());

    expect((await saves.load('slot-1'))?.save).toMatchObject({
      createdAt: '2026-10-03T09:00:00.000Z',
      lastPlayedAt: '2026-10-04T20:30:00.000Z',
    });
  });

  it('lists every slot: empty, ready with when it was last played, or damaged', async () => {
    let clock = new Date('2026-10-03T09:00:00Z');
    const { saves, raw } = freshSaves(() => clock);
    await saves.write('slot-1', createSave(DEV_SETUP));
    clock = new Date('2026-10-03T10:00:00Z');
    await saves.write('slot-3', lived());
    await plant(raw, 'slot-4', { ...garbled, lastPlayedAt: '2026-10-02T08:00:00.000Z' });

    const [one, two, three, four] = await saves.slots();

    expect(one).toMatchObject({ slotId: 'slot-1', status: 'ready', lastPlayedAt: '2026-10-03T09:00:00.000Z', fromBackup: false });
    expect(one?.status === 'ready' && one.save.game).toEqual(createSave(DEV_SETUP));
    expect(two).toEqual({ slotId: 'slot-2', status: 'empty' });
    expect(three).toMatchObject({ slotId: 'slot-3', status: 'ready', lastPlayedAt: '2026-10-03T10:00:00.000Z' });
    expect(four).toMatchObject({ slotId: 'slot-4', status: 'damaged', lastPlayedAt: '2026-10-02T08:00:00.000Z', characterName: null });
    expect(four?.status === 'damaged' && four.message).toMatch(/slot-4/);
  });

  it('upgrades an old save through the migrations, after backing up the bytes it found', async () => {
    const { saves, raw } = freshSaves();
    const v1 = {
      schemaVersion: 1,
      slotId: 'slot-1',
      createdAt: '2026-10-01T09:00:00.000Z',
      lastPlayedAt: '2026-10-02T09:00:00.000Z',
      game: beforePhrasebooks(),
    };
    await set('slot-1', v1, raw);

    const loaded = (await saves.load('slot-1'))?.save;

    expect(loaded?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(loaded?.game).toEqual({ ...withNoShiftYet(), phrasebook: [] });
    expect(loaded?.lastPlayedAt).toBe(v1.lastPlayedAt);
    expect(await get('slot-1/pre-migration-v1', raw)).toEqual(v1);
    // The upgraded save is stored, so the next load needs no migration.
    expect(await get('slot-1', raw)).toMatchObject({ schemaVersion: SAVE_SCHEMA_VERSION });
  });

  it('upgrades a save from before the First Morning could be skipped as one that wasn’t skipped', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 2, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeSkippingFirstMornings() }, raw);

    expect((await saves.load('slot-1'))?.save.game).toEqual(withNoShiftYet());
  });

  it('upgrades a save from before conversations moved Proficiency as one with none assessed yet', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 3, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeProficiencyEvidence() }, raw);

    const game = (await saves.load('slot-1'))?.save.game;

    expect(game?.progression.evidenceSoFar).toBe(0);
    expect(game).toEqual(withNoShiftYet());
  });

  it('upgrades a save from before Fainting as a Character who has never fainted', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 4, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeFainting() }, raw);

    const game = (await saves.load('slot-1'))?.save.game;

    expect(game?.wokeInWardOnDay).toBeNull();
    expect(game).toEqual(withNoShiftYet());
  });

  it('upgrades a save from before cooking as a Character with no food poisoning chance', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 5, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeCooking() }, raw);

    const game = (await saves.load('slot-1'))?.save.game;

    expect(game?.character.foodPoisoningChance).toBe(0);
    expect(game).toEqual(withNoShiftYet());
  });

  it("upgrades a save from before rent fell due as one owing this week's rent, with no extension or reminder yet", async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 6, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeRent() }, raw);

    expect((await saves.load('slot-1'))?.save.game).toEqual(withNoShiftYet());
  });

  it('upgrades a save already past its first due day to the next due day, forgiving the weeks that never fell due', async () => {
    const { saves, raw } = freshSaves();
    const game = { ...beforeRent(), clock: { day: 16, minuteOfDay: 600 } };
    await set('slot-1', { schemaVersion: 6, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game }, raw);

    const loaded = (await saves.load('slot-1'))?.save.game;

    expect(loaded?.rent.dueDay).toBe(21);
    expect(loaded?.debts).toEqual(lived().debts);
  });

  it('upgrades a save from before Shifts as one with no Shift under way and none worked yet', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 7, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeShifts() }, raw);

    expect((await saves.load('slot-1'))?.save.game).toEqual(withNoShiftYet());
  });

  it('upgrades a save with a Shift Customer at the counter from before harder customers as a single-drink customer', async () => {
    const { saves, raw } = freshSaves();
    const game = lived();
    const shift = { ...game.possessions.shift!, customer: { order: [{ itemId: 'latte', quantity: 1 }], voiceSeed: 4242 } };
    await set('slot-1', { schemaVersion: 8, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: { ...game, possessions: { ...game.possessions, shift } } }, raw);

    expect((await saves.load('slot-1'))?.save.game.possessions.shift?.customer).toEqual({
      templateId: 'barista-single-drink',
      order: [{ itemId: 'latte', quantity: 1 }],
      changedFrom: null,
      checkout: null,
      table: null,
      voiceSeed: 4242,
    });
  });

  it('upgrades a save from before overwork and translated customers with only its last Shift day worked this week, and none translated', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 9, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeOverwork() }, raw);

    const game = lived();
    expect((await saves.load('slot-1'))?.save.game).toEqual({
      ...game,
      progression: { ...game.progression, shiftDays: [3] },
      possessions: { ...game.possessions, shift: { ...game.possessions.shift!, translated: 0 } },
    });
  });

  it('upgrades a save from before the till with no checkout for the Shift Customer at the counter', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 10, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeTill() }, raw);

    expect((await saves.load('slot-1'))?.save.game).toEqual(lived());
  });

  it('keeps a customer at the till as they were: their shopping, bag, points card, item from behind the counter and cash', async () => {
    const { saves } = freshSaves();
    const game = lived();
    const customer = {
      templateId: 'cashier-pays-cash',
      order: [{ itemId: 'eggs', quantity: 2 }, { itemId: 'stamps', quantity: 1 }],
      changedFrom: null,
      checkout: { bag: true, pointsCard: false, fromBehindTheCounter: 'stamps', cashHanded: 5, changeDue: 0.6 },
      table: null,
      voiceSeed: 7,
    } as const;
    const atTheTill = { ...game, possessions: { ...game.possessions, shift: { ...game.possessions.shift!, jobId: 'cashier' as const, customer } } };
    await saves.write('slot-1', atTheTill);

    expect((await saves.load('slot-1'))?.save.game).toEqual(atTheTill);
  });

  it('upgrades a save from before restaurant tables with no table for the Shift Customer at the counter', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 11, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeTables() }, raw);

    expect((await saves.load('slot-1'))?.save.game).toEqual(lived());
  });

  it('upgrades a save from before restaurant meals with no table and nothing on the bill', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 12, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeRestaurantBills() }, raw);

    expect((await saves.load('slot-1'))?.save.game).toEqual(lived());
  });

  it("keeps the Character's restaurant table and an unpaid bill as they were", async () => {
    const { saves } = freshSaves();
    const game: GameState = { ...lived(), restaurant: { seated: true, bill: [{ itemId: 'fish-dish', quantity: 1, priceInShifts: 0.2 }] } };
    await saves.write('slot-1', game);

    expect((await saves.load('slot-1'))?.save.game).toEqual(game);
  });

  it('upgrades an unpaid bill from before bills kept their prices, pricing each line at the menu price', async () => {
    const { saves, raw } = freshSaves();
    const game = lived();
    const stored = { ...game, restaurant: { seated: false, bill: [{ itemId: 'fish-dish', quantity: 2 }] } };
    await set('slot-1', { schemaVersion: 13, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: stored }, raw);

    const priceInShifts = menuPrice('fish-dish', game.identity.culturePackId);
    expect((await saves.load('slot-1'))?.save.game.restaurant).toEqual({ seated: false, bill: [{ itemId: 'fish-dish', quantity: 2, priceInShifts }] });
  });

  it('keeps restaurant debt as it was', async () => {
    const { saves } = freshSaves();
    const game: GameState = { ...lived(), debts: [{ kind: 'restaurant', amountInShifts: 0.35 }] };
    await saves.write('slot-1', game);

    expect((await saves.load('slot-1'))?.save.game).toEqual(game);
  });

  it('upgrades a save from before regulars with no order run, no "on the house" yet and no park wave today', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 14, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeRegulars() }, raw);

    expect((await saves.load('slot-1'))?.save.game).toEqual(lived());
  });

  it('upgrades a save from before the clinic with no one waiting, no prescription and an untreated Illness', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', { schemaVersion: 15, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforeTheClinic() }, raw);

    expect((await saves.load('slot-1'))?.save.game).toEqual(lived());
  });

  it('keeps the clinic as it was: the check-in, the prescription, a treated flu and a payment plan', async () => {
    const { saves } = freshSaves();
    const game = lived();
    const atTheClinic: GameState = {
      ...game,
      character: { ...game.character, illness: { illnessId: 'flu', onsetDay: 2, treated: true } },
      clinic: { checkedInAt: { day: 3, minuteOfDay: 14 * 60 + 10.25 }, prescription: 'fever-reducer' },
    };
    await saves.write('slot-1', atTheClinic);

    expect((await saves.load('slot-1'))?.save.game).toEqual(atTheClinic);
  });

  it('keeps being a regular as it was: the order run, the last "on the house", the casual register and the park wave', async () => {
    const { saves } = freshSaves();
    const game = lived();
    const barista: NpcMemory = {
      ...game.people.barista!,
      lastOrder: { interactionId: 'order-drink', args: { items: [{ item: 'latte', quantity: 1 }] }, inARow: 4 },
      lastOnTheHouseDay: 2,
      registerOffered: true,
    };
    const regular: GameState = { ...game, parkWavedOnDay: 3, people: { barista } };
    await saves.write('slot-1', regular);

    expect((await saves.load('slot-1'))?.save.game).toEqual(regular);
  });

  it("keeps a restaurant table as it was: each diner's dish, drink and dietary need", async () => {
    const { saves } = freshSaves();
    const game = lived();
    const customer = {
      templateId: 'server-table-dietary',
      order: [
        { itemId: 'veggie-dish', quantity: 1 },
        { itemId: 'juice', quantity: 2 },
        { itemId: 'pork-dish', quantity: 1 },
      ],
      changedFrom: null,
      checkout: null,
      table: [
        { dish: 'veggie-dish', drink: 'juice', note: 'vegetarian' },
        { dish: 'pork-dish', drink: 'juice', note: null },
      ],
      voiceSeed: 9,
    } as const;
    const atTheTable = { ...game, possessions: { ...game.possessions, shift: { ...game.possessions.shift!, jobId: 'server' as const, customer } } };
    await saves.write('slot-1', atTheTable);

    expect((await saves.load('slot-1'))?.save.game).toEqual(atTheTable);
  });

  it('fails loudly, naming the field, when a save refers to content the game no longer has', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());
    const stored = (await get<{ game: GameState }>('slot-1', raw))!;
    await plant(raw, 'slot-1', { ...stored, game: { ...stored.game, placeId: 'library' } });

    await expect(saves.load('slot-1')).rejects.toThrow(/slot-1.*placeId/s);
  });

  it('fails loudly on an unknown Named NPC or item id', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());
    const stored = (await get<{ game: GameState }>('slot-1', raw))!;

    await plant(raw, 'slot-1', { ...stored, game: { ...stored.game, people: { ghost: stored.game.people.barista } } });
    await expect(saves.load('slot-1')).rejects.toThrow(/people/);

    const inventory = [{ itemId: 'espresso-tonic', quantity: 1, expiresOnDay: null }];
    await plant(raw, 'slot-1', { ...stored, game: { ...stored.game, possessions: { ...stored.game.possessions, inventory } } });
    await expect(saves.load('slot-1')).rejects.toThrow(/inventory/);
  });

  it('refuses a save from a newer version of the game', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());
    const stored = (await get<object>('slot-1', raw))!;
    await plant(raw, 'slot-1', { ...stored, schemaVersion: SAVE_SCHEMA_VERSION + 1 });

    await expect(saves.load('slot-1')).rejects.toThrow(/newer/);
  });
});

describe('the start-of-day backup', () => {
  it('is written with the first save of a slot, and rotated only at the first save of each new day', async () => {
    const { saves, raw } = freshSaves();
    const morning = lived();

    await saves.write('slot-1', morning);
    await saves.write('slot-1', later(morning));
    expect((await get<{ game: GameState }>('slot-1/start-of-day', raw))?.game).toEqual(morning);

    await saves.write('slot-1', nextDay(morning));
    await saves.write('slot-1', later(nextDay(morning)));
    expect((await get<{ game: GameState }>('slot-1/start-of-day', raw))?.game).toEqual(nextDay(morning));
  });

  it('is rotated by a save that starts a day, even on the same day number, as waking after a bedtime past midnight', async () => {
    const { saves, raw } = freshSaves();
    const night = nextDay(lived());
    const morning = { ...night, clock: { ...night.clock, minuteOfDay: 7 * 60 } };

    await saves.write('slot-1', night);
    await saves.write('slot-1', morning, { startsDay: true });
    expect((await get<{ game: GameState }>('slot-1/start-of-day', raw))?.game).toEqual(morning);
  });

  it('is loaded instead when the main save can’t be, and says so', async () => {
    const { saves, raw } = freshSaves();
    const morning = lived();
    await saves.write('slot-1', morning);
    await saves.write('slot-1', later(morning));
    await set('slot-1', garbled, raw);

    const loaded = await saves.load('slot-1');

    expect(loaded?.fromBackup).toBe(true);
    expect(loaded?.save.game).toEqual(morning);
    expect((await saves.slots())[0]).toMatchObject({ status: 'ready', fromBackup: true });
  });

  it('is upgraded through the migrations like any save', async () => {
    const { saves, raw } = freshSaves();
    await set('slot-1', 'not a save at all', raw);
    await set('slot-1/start-of-day', { schemaVersion: 1, slotId: 'slot-1', createdAt: '', lastPlayedAt: '', game: beforePhrasebooks() }, raw);

    expect((await saves.load('slot-1'))?.save.game).toEqual({ ...withNoShiftYet(), phrasebook: [] });
  });

  it('when it can’t be loaded either, the slot fails naming itself, and nothing is deleted', async () => {
    const { saves, raw } = freshSaves();
    await plant(raw, 'slot-1', garbled);

    await expect(saves.load('slot-1')).rejects.toThrow(/slot-1/);
    expect(await get('slot-1', raw)).toEqual(garbled);
    expect(await get('slot-1/start-of-day', raw)).toEqual(garbled);
  });

  it('once play goes on from it, the damaged main save is kept aside instead of written over', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());
    await set('slot-1', garbled, raw);

    await saves.write('slot-1', later(lived()));

    expect((await saves.load('slot-1'))?.save.game).toEqual(later(lived()));
    const aside = (await saves.backups('slot-1')).find((backup) => backup.name.startsWith('damaged-'));
    expect(await get(`slot-1/${aside?.name}`, raw)).toEqual(garbled);
  });
});

describe('a slot', () => {
  it('describes its backups by name, version, day and when they were played', async () => {
    const { saves } = freshSaves();
    await saves.write('slot-1', lived());

    expect(await saves.backups('slot-1')).toEqual([
      { name: 'start-of-day', schemaVersion: SAVE_SCHEMA_VERSION, day: 3, lastPlayedAt: '2026-10-03T09:00:00.000Z' },
    ]);
  });

  it('hands over everything it stores, as found, for Export raw', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());
    await set('slot-1', 'garbled', raw);

    const found = await saves.raw('slot-1');

    expect(found.save).toBe('garbled');
    expect(Object.keys(found.backups)).toEqual(['start-of-day']);
  });

  it('can be removed with its backups, leaving the other slots alone', async () => {
    const { saves, raw } = freshSaves();
    await saves.write('slot-1', lived());
    await saves.write('slot-2', lived());
    await set('slot-1/pre-migration-v1', {}, raw);

    await saves.remove('slot-1');

    expect(await saves.load('slot-1')).toBeNull();
    expect((await keys(raw)).sort()).toEqual(['slot-2', 'slot-2/start-of-day']);
  });

  it('takes a restored save only while empty, as the save it was, now in this slot', async () => {
    const { saves } = freshSaves();
    const original = await saves.write('slot-1', lived());

    const restored = await saves.restore('slot-2', original);

    expect(restored).toEqual({ ...original, slotId: 'slot-2' });
    expect((await saves.load('slot-2'))?.save).toEqual(restored);
    expect((await saves.backups('slot-2')).map((backup) => backup.name)).toEqual(['start-of-day']);
    await expect(saves.restore('slot-1', original)).rejects.toThrow(/slot-1.*empty/);
  });
});
