import { describe, expect, it } from 'vitest';
import { LANGUAGE_CODES } from '../sim/index.ts';
import { CAFE_MENU, CULTURE_PACKS, ITEMS, jobAt, JOB_PLACES, SHIFT_MENUS, SHIFT_TEMPLATES, shiftTemplate } from './index.ts';

describe('Shift templates', () => {
  it('give the barista a single-drink template at band B, at the café', () => {
    expect(SHIFT_TEMPLATES.barista).toMatchObject({ id: 'barista-single-drink', band: 'B' });
    expect(JOB_PLACES.barista).toBe('cafe');
  });

  it("order only drinks from the café's menu", () => {
    const { drinks } = SHIFT_TEMPLATES.barista;
    expect(drinks.length).toBeGreaterThan(1);
    for (const drink of drinks) {
      expect(CAFE_MENU).toContain(drink);
      expect(ITEMS[drink].restores.thirst).toBeGreaterThan(0);
    }
  });

  it.each(LANGUAGE_CODES)('name every drink in the %s pack', (packId) => {
    for (const drink of SHIFT_TEMPLATES.barista.drinks) expect(CULTURE_PACKS[packId].goods[drink].name).not.toBe('');
  });
});

describe('Jobs and their places', () => {
  it('find the Job by the place its staff door is at', () => {
    expect(jobAt('cafe')).toBe('barista');
    expect(jobAt('home')).toBeNull();
  });

  it("give the barista the café's whole menu to tap during a Shift", () => {
    expect(SHIFT_MENUS.barista).toEqual(CAFE_MENU);
    expect(shiftTemplate('barista')).toBe(SHIFT_TEMPLATES.barista);
  });
});
