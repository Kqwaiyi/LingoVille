import { describe, expect, it } from 'vitest';
import { LANGUAGE_CODES } from '../sim/index.ts';
import {
  CAFE_MENU,
  CULTURE_PACKS,
  DRINK_EXTRAS,
  DRINK_OPTIONS,
  ITEMS,
  jobAt,
  JOB_PLACES,
  SHIFT_MENUS,
  SHIFT_TEMPLATES,
  shiftTemplates,
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
    for (const { drinks, modifiers } of SHIFT_TEMPLATES.barista as readonly ShiftTemplate[]) {
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

describe('Jobs and their places', () => {
  it('find the Job by the place its staff door is at', () => {
    expect(jobAt('cafe')).toBe('barista');
    expect(jobAt('home')).toBeNull();
  });

  it("give the barista the café's whole menu to tap during a Shift", () => {
    expect(SHIFT_MENUS.barista).toEqual(CAFE_MENU);
    expect(shiftTemplates('barista')).toBe(SHIFT_TEMPLATES.barista);
    expect(shiftTemplates('cashier')).toEqual([]);
  });
});
