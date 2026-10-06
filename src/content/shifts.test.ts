import { describe, expect, it } from 'vitest';
import { LANGUAGE_CODES } from '../sim/index.ts';
import {
  CAFE_MENU,
  BEHIND_THE_COUNTER,
  CULTURE_PACKS,
  DIETARY_NOTE_IDS,
  dishFits,
  GROCERIES_SOLD,
  isCheckout,
  isTable,
  RESTAURANT_DISHES,
  RESTAURANT_DRINKS,
  RESTAURANT_MENU,
  DRINK_EXTRAS,
  DRINK_OPTIONS,
  ITEMS,
  jobAt,
  JOB_PLACES,
  SHIFT_MENUS,
  SHIFT_TEMPLATES,
  shiftTemplates,
  type DrinkTemplate,
  type ShiftTemplate,
} from './index.ts';

const barista = (id: string): ShiftTemplate => SHIFT_TEMPLATES.barista.find((template) => template.id === id)!;

describe('Shift templates', () => {
  it("give the barista the spec's three templates, one at each band, at the café", () => {
    expect(SHIFT_TEMPLATES.barista.map(({ id, band }) => [id, band])).toEqual([
      ['barista-single-drink', 'B'],
      ['barista-made-to-order', 'I'],
      ['barista-change-of-mind', 'A'],
    ]);
    expect(JOB_PLACES.barista).toBe('cafe');
  });

  it('order a single drink alone at B, with a size, hot or iced and an extra at I, and change their mind at A', () => {
    expect(barista('barista-single-drink')).toMatchObject({ modifiers: null, changesMind: false });
    expect(barista('barista-made-to-order')).toMatchObject({ modifiers: expect.anything(), changesMind: false });
    expect(barista('barista-change-of-mind')).toMatchObject({ modifiers: expect.anything(), changesMind: true });
  });

  it.each(SHIFT_TEMPLATES.barista.map((template) => [template.id, template] as const))("%s orders only drinks from the café's menu", (_, { drinks }) => {
    expect(drinks.length).toBeGreaterThan(1);
    for (const drink of drinks) {
      expect(CAFE_MENU).toContain(drink);
      expect(ITEMS[drink].restores.thirst).toBeGreaterThan(0);
    }
  });

  it('give every drink made to order at least one extra it takes', () => {
    for (const { drinks, modifiers } of SHIFT_TEMPLATES.barista as readonly DrinkTemplate[]) {
      if (!modifiers) continue;
      for (const drink of drinks) {
        expect(modifiers.extras[drink]?.length).toBeGreaterThan(0);
        for (const extra of modifiers.extras[drink]!) expect(DRINK_EXTRAS).toContain(extra);
      }
    }
  });

  it.each(LANGUAGE_CODES)('name every drink and every drink option in the %s pack', (packId) => {
    for (const { drinks } of SHIFT_TEMPLATES.barista) for (const drink of drinks) expect(CULTURE_PACKS[packId].goods[drink].name).not.toBe('');
    for (const option of DRINK_OPTIONS) expect(CULTURE_PACKS[packId].drinkOptions[option].name).not.toBe('');
  });
});

describe('cashier Shift templates', () => {
  it("give the cashier the spec's two templates at the supermarket: pays (B), and pays cash for something from behind the counter (I)", () => {
    expect(SHIFT_TEMPLATES.cashier.map(({ id, band }) => [id, band])).toEqual([
      ['cashier-pays', 'B'],
      ['cashier-pays-cash', 'I'],
    ]);
    expect(SHIFT_TEMPLATES.cashier.every(isCheckout)).toBe(true);
    expect(SHIFT_TEMPLATES.barista.some(isCheckout)).toBe(false);
    expect(JOB_PLACES.cashier).toBe('supermarket');
  });

  it("bring shopping from the supermarket's shelves, and ask for something from behind the counter only at I", () => {
    const [pays, paysCash] = SHIFT_TEMPLATES.cashier;
    expect(pays).toMatchObject({ basket: GROCERIES_SOLD, behindTheCounter: null });
    expect(paysCash).toMatchObject({ basket: GROCERIES_SOLD, behindTheCounter: BEHIND_THE_COUNTER });
  });

  it.each(LANGUAGE_CODES)('name everything behind the counter in the %s pack', (packId) => {
    for (const itemId of BEHIND_THE_COUNTER) expect(CULTURE_PACKS[packId].goods[itemId].name).not.toBe('');
  });

  it('let the cashier scan the shelves and fetch from behind the counter', () => {
    expect(SHIFT_MENUS.cashier).toEqual([...GROCERIES_SOLD, ...BEHIND_THE_COUNTER]);
    expect(shiftTemplates('cashier')).toBe(SHIFT_TEMPLATES.cashier);
  });
});

describe('server Shift templates', () => {
  it("give the server the spec's two templates at the restaurant: a single dish and drink (B), and a table with a dietary request (A)", () => {
    expect(SHIFT_TEMPLATES.server.map(({ id, band }) => [id, band])).toEqual([
      ['server-single-order', 'B'],
      ['server-table-dietary', 'A'],
    ]);
    expect(SHIFT_TEMPLATES.server.every(isTable)).toBe(true);
    expect([...SHIFT_TEMPLATES.barista, ...SHIFT_TEMPLATES.cashier].some(isTable)).toBe(false);
    expect(SHIFT_TEMPLATES.server.some(isCheckout)).toBe(false);
    expect(JOB_PLACES.server).toBe('restaurant');
  });

  it('seat one diner with no dietary need at B, and a table with one at A', () => {
    const [single, table] = SHIFT_TEMPLATES.server;
    expect(single).toMatchObject({ dishes: RESTAURANT_DISHES, drinks: RESTAURANT_DRINKS, party: 'one', dietary: null });
    expect(table).toMatchObject({ dishes: RESTAURANT_DISHES, drinks: RESTAURANT_DRINKS, party: 'table' });
    expect(Object.keys(table.dietary)).toEqual([...DIETARY_NOTE_IDS]);
  });

  it.each(DIETARY_NOTE_IDS)('offer a diner who is %s only dishes that keep to it, and always some', (noteId) => {
    const fitting = SHIFT_TEMPLATES.server[1].dietary[noteId];
    expect(fitting.length).toBeGreaterThan(0);
    expect(fitting).toEqual(RESTAURANT_DISHES.filter((dish) => dishFits(dish, noteId)));
  });

  it('know which dishes keep to which needs', () => {
    expect(dishFits('veggie-dish', 'vegetarian')).toBe(true);
    expect(dishFits('fish-dish', 'vegetarian')).toBe(false);
    expect(dishFits('chicken-dish', 'no-pork')).toBe(true);
    expect(dishFits('pork-dish', 'no-pork')).toBe(false);
    expect(dishFits('pork-dish', 'no-seafood')).toBe(true);
    expect(dishFits('fish-dish', 'no-seafood')).toBe(false);
  });

  it('price a dish and a drink at about a quarter of a Shift together', () => {
    for (const dish of RESTAURANT_DISHES) {
      for (const drink of RESTAURANT_DRINKS) expect(ITEMS[dish].priceInShifts + ITEMS[drink].priceInShifts).toBeCloseTo(0.25, 1);
    }
  });

  it.each(LANGUAGE_CODES)('name the restaurant, its menu and every dietary need in the %s pack', (packId) => {
    const pack = CULTURE_PACKS[packId];
    expect(pack.restaurant.name).not.toBe('');
    for (const itemId of RESTAURANT_MENU) expect(pack.goods[itemId].name).not.toBe('');
    for (const noteId of DIETARY_NOTE_IDS) expect(pack.dietaryNotes[noteId].name).not.toBe('');
  });

  it('let the server write the whole restaurant menu on the order pad', () => {
    expect(SHIFT_MENUS.server).toEqual(RESTAURANT_MENU);
    expect(shiftTemplates('server')).toBe(SHIFT_TEMPLATES.server);
  });
});

describe('Jobs and their places', () => {
  it('find the Job by the place its staff door is at', () => {
    expect(jobAt('cafe')).toBe('barista');
    expect(jobAt('supermarket')).toBe('cashier');
    expect(jobAt('restaurant')).toBe('server');
    expect(jobAt('home')).toBeNull();
  });

  it("give the barista the café's whole menu to tap during a Shift", () => {
    expect(SHIFT_MENUS.barista).toEqual(CAFE_MENU);
    expect(shiftTemplates('barista')).toBe(SHIFT_TEMPLATES.barista);
  });
});
