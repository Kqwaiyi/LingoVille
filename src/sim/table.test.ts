import { describe, expect, it } from 'vitest';
import type { DietaryNoteId, ItemId, ShiftTemplate, TableTemplate } from '../content/index.ts';
import {
  applyShiftCustomer,
  createSave,
  ECONOMY,
  hire,
  jobAids,
  LIFE_SKILLS,
  nextShiftCustomer,
  startShift,
  type GameState,
  type OpeningHours,
  type PadDiner,
} from './index.ts';
import { TEST_LOOKS, TEST_SETUP } from './testSetup.ts';

const RESTAURANT_HOURS: OpeningHours = { opensAt: 11 * 60, closesAt: 22 * 60, closedOn: [] };

const DISHES = ['pork-dish', 'chicken-dish', 'fish-dish', 'veggie-dish'] as const satisfies readonly ItemId[];
const DRINKS = ['juice', 'cola'] as const satisfies readonly ItemId[];
/** The dishes that keep to each need, as content works them out. */
const FITTING: Record<DietaryNoteId, readonly ItemId[]> = {
  vegetarian: ['veggie-dish'],
  'no-pork': ['chicken-dish', 'fish-dish', 'veggie-dish'],
  'no-seafood': ['pork-dish', 'chicken-dish', 'veggie-dish'],
};
const SINGLE: TableTemplate = { id: 'single', band: 'B', dishes: DISHES, drinks: DRINKS, party: 'one', dietary: null };
const TABLE: TableTemplate = { id: 'table', band: 'A', dishes: DISHES, drinks: DRINKS, party: 'table', dietary: FITTING };

/** A hired server at the restaurant at 12:00 on day 3, with a Shift under way. */
function serverShift(seed = TEST_SETUP.rngSeed): GameState {
  const state = hire(createSave({ ...TEST_SETUP, rngSeed: seed }), 'server');
  return startShift({ ...state, placeId: 'restaurant', clock: { day: 3, minuteOfDay: 12 * 60 } }, 'server', RESTAURANT_HOURS);
}

const customerOf = (state: GameState) => state.possessions.shift!.customer!;
const atTheTable = (template: ShiftTemplate = TABLE, seed = TEST_SETUP.rngSeed) => nextShiftCustomer(serverShift(seed), [template], TEST_LOOKS);
const drawn = (template: ShiftTemplate) => Array.from({ length: 80 }, (_, seed) => customerOf(atTheTable(template, seed)));

/** The order pad written exactly as the table wants it, diner by diner. */
const padFor = (state: GameState): PadDiner[] => customerOf(state).table!.map((diner) => ({ ...diner }));
/** Everything on a pad, as the lines the kitchen makes. */
const linesOf = (pad: readonly PadDiner[]) =>
  pad.flatMap(({ dish, drink }) => [dish, drink].filter((itemId) => itemId !== null).map((itemId) => ({ itemId, quantity: 1 })));

describe('nextShiftCustomer: a restaurant table', () => {
  it('brings a look for everyone at the table, each drawn from the seeded RNG', () => {
    const tables = drawn(TABLE);
    expect(tables.every((customer) => customer.appearances.length === customer.table!.length)).toBe(true);
    const seated = tables.flatMap((customer) => customer.appearances.map((look) => JSON.stringify(look)));
    expect(new Set(seated).size).toBeGreaterThan(5);
  });

  it('seats one diner with a dish and a drink and no dietary need, and orders just those', () => {
    for (const { table, order, checkout, changedFrom } of drawn(SINGLE)) {
      expect(table).toHaveLength(1);
      const { dish, drink, note } = table![0]!;
      expect(DISHES).toContain(dish);
      expect(DRINKS).toContain(drink);
      expect(note).toBeNull();
      expect(order).toEqual([{ itemId: dish, quantity: 1 }, { itemId: drink, quantity: 1 }]);
      expect(checkout).toBeNull();
      expect(changedFrom).toBeNull();
    }
  });

  it('seats a table of the tuned size, exactly one of them with a dietary need and a dish that keeps to it', () => {
    const customers = drawn(TABLE);
    for (const { table } of customers) {
      expect(table!.length).toBeGreaterThanOrEqual(ECONOMY.tableDiners.min);
      expect(table!.length).toBeLessThanOrEqual(ECONOMY.tableDiners.max);
      const withNeeds = table!.filter(({ note }) => note !== null);
      expect(withNeeds).toHaveLength(1);
      expect(FITTING[withNeeds[0]!.note!]).toContain(withNeeds[0]!.dish);
      for (const { dish, drink } of table!) {
        expect(DISHES).toContain(dish);
        expect(DRINKS).toContain(drink);
      }
    }
    expect(new Set(customers.map(({ table }) => table!.length))).toEqual(new Set([ECONOMY.tableDiners.min, ECONOMY.tableDiners.max]));
    expect(new Set(customers.map(({ table }) => table!.find(({ note }) => note)!.note))).toEqual(new Set(Object.keys(FITTING)));
  });

  it("orders every diner's dish and drink, the same ones together", () => {
    for (const { table, order } of drawn(TABLE)) {
      const wanted = new Map<ItemId, number>();
      for (const { dish, drink } of table!) for (const itemId of [dish, drink]) wanted.set(itemId, (wanted.get(itemId) ?? 0) + 1);
      expect(new Map(order.map(({ itemId, quantity }) => [itemId, quantity]))).toEqual(wanted);
      expect(order).toHaveLength(wanted.size);
    }
  });

  it('draws everything from the seeded RNG', () => {
    const shift = serverShift();
    expect(nextShiftCustomer(shift, [TABLE], TEST_LOOKS)).toEqual(nextShiftCustomer(shift, [TABLE], TEST_LOOKS));
    expect(new Set(drawn(TABLE).map(({ table }) => JSON.stringify(table))).size).toBeGreaterThan(1);
  });
});

describe('applyShiftCustomer: the exact check at the table', () => {
  it("serves a table whose every diner's dish, drink and dietary note are on the pad", () => {
    for (const template of [SINGLE, TABLE]) {
      for (let seed = 0; seed < 20; seed++) {
        const state = atTheTable(template, seed);
        const pad = padFor(state);
        const { state: after, correct } = applyShiftCustomer(state, linesOf(pad), { atTheTable: pad });
        expect(correct).toBe(true);
        expect(after.possessions.shift).toMatchObject({ served: 1, failed: 0, customer: null });
      }
    }
  });

  it('takes the diners in any order on the pad: who sits where is not checked', () => {
    const state = atTheTable();
    const pad = padFor(state).reverse();
    expect(applyShiftCustomer(state, linesOf(pad), { atTheTable: pad }).correct).toBe(true);
  });

  it("fails a wrong dish or drink, even with every item on the pad somewhere: each diner's own order counts", () => {
    const state = Array.from({ length: 40 }, (_, seed) => atTheTable(TABLE, seed)).find((s) => {
      const [a, b] = customerOf(s).table!;
      return a!.drink !== b!.drink;
    })!;
    const pad = padFor(state);
    const swappedDrinks = pad.map((diner, i) => (i < 2 ? { ...diner, drink: pad[1 - i]!.drink } : diner));
    expect(applyShiftCustomer(state, linesOf(swappedDrinks), { atTheTable: swappedDrinks }).correct).toBe(false);
    const wrongDish = pad.map((diner, i) => (i === 0 ? { ...diner, dish: DISHES.find((dish) => dish !== diner.dish)! } : diner));
    expect(applyShiftCustomer(state, linesOf(wrongDish), { atTheTable: wrongDish }).correct).toBe(false);
  });

  it('fails a diner left off the pad, one too many, or one missing their drink', () => {
    const state = atTheTable();
    const pad = padFor(state);
    const extra = [...pad, { ...pad[0]! }];
    const noDrink = pad.map((diner, i) => (i === 0 ? { ...diner, drink: null } : diner));
    for (const written of [pad.slice(1), extra, noDrink, []]) {
      expect(applyShiftCustomer(state, linesOf(written), { atTheTable: written }).correct).toBe(false);
    }
  });

  it('fails a dietary note missed, put on the wrong diner, or the wrong need', () => {
    const state = atTheTable();
    const pad = padFor(state);
    const needy = pad.findIndex(({ note }) => note !== null);
    const other = needy === 0 ? 1 : 0;
    const need = pad[needy]!.note!;
    const missed = pad.map((diner) => ({ ...diner, note: null }));
    const wrongDiner = pad.map((diner, i) => ({ ...diner, note: i === other ? need : null }));
    const wrongNeed = pad.map((diner, i) => (i === needy ? { ...diner, note: (Object.keys(FITTING) as DietaryNoteId[]).find((n) => n !== need)! } : diner));
    for (const written of [missed, wrongDiner, wrongNeed]) {
      expect(applyShiftCustomer(state, linesOf(written), { atTheTable: written }).correct).toBe(false);
    }
  });

  it('fails a dietary note no one asked for', () => {
    const state = atTheTable(SINGLE);
    const pad = padFor(state).map((diner) => ({ ...diner, note: 'vegetarian' as const }));
    expect(applyShiftCustomer(state, linesOf(pad), { atTheTable: pad }).correct).toBe(false);
  });

  it('fails a table with nothing written on the pad', () => {
    const state = atTheTable(SINGLE);
    expect(applyShiftCustomer(state, customerOf(state).order).correct).toBe(false);
  });

  it('earns Server XP for each table served correctly, and none for a wrong one', () => {
    const state = atTheTable();
    const pad = padFor(state);
    const serverXp = (s: GameState) => s.progression.lifeSkillXp.server;
    expect(serverXp(applyShiftCustomer(state, linesOf(pad), { atTheTable: pad }).state)).toBeCloseTo(LIFE_SKILLS.xpPerShiftCustomer);
    expect(serverXp(applyShiftCustomer(state, [], { atTheTable: [] }).state)).toBe(0);
  });
});

describe('quick-pick dietary notes: the Server skill aid', () => {
  it('is an aid of the Server skill from the tuned level', () => {
    const at = (xp: number) => {
      const state = createSave(TEST_SETUP);
      return { ...state, progression: { ...state.progression, lifeSkillXp: { ...state.progression.lifeSkillXp, server: xp } } };
    };
    const level = LIFE_SKILLS.jobAidsFromLevel.server.quickPickNotes;
    expect(jobAids(at(LIFE_SKILLS.xpToReachLevel[level - 1]!), 'server')).toEqual([]);
    expect(jobAids(at(LIFE_SKILLS.xpToReachLevel[level]!), 'server')).toEqual(['quickPickNotes']);
  });
});
