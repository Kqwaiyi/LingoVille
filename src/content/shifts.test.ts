import { describe, expect, it } from 'vitest';
import { LANGUAGE_CODES } from '../sim/index.ts';
import {
  CAFE_MENU,
  BEHIND_THE_COUNTER,
  CULTURE_PACKS,
  GROCERIES_SOLD,
  isCheckout,
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

describe('Jobs and their places', () => {
  it('find the Job by the place its staff door is at', () => {
    expect(jobAt('cafe')).toBe('barista');
    expect(jobAt('supermarket')).toBe('cashier');
    expect(jobAt('home')).toBeNull();
  });

  it("give the barista the café's whole menu to tap during a Shift", () => {
    expect(SHIFT_MENUS.barista).toEqual(CAFE_MENU);
    expect(shiftTemplates('barista')).toBe(SHIFT_TEMPLATES.barista);
    expect(shiftTemplates('server')).toEqual([]);
  });
});
