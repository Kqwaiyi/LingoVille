import { describe, expect, it } from 'vitest';
import { ECONOMY, LANGUAGE_CODES, MOOD } from '../sim/index.ts';
import {
  chargeInShifts,
  COMFORT_PURCHASES,
  CONVENIENCE_MENU,
  GIFTS_SOLD,
  GROCERIES_SOLD,
  ITEMS,
  ITEM_IDS,
  localPrice,
  menuPrice,
  RESTAURANT_DISHES,
  RESTAURANT_DRINKS,
} from './index.ts';

/** About 0.06 of a Shift per meal, from the spec's ratio ladder. */
const GROCERY_SHIFTS_PER_MEAL = 0.06;

const pricePerMeal = (id: (typeof GROCERIES_SOLD)[number]) => ITEMS[id].priceInShifts / ITEMS[id].meals!;
const foods = ITEM_IDS.filter((id) => (ITEMS[id].restores.hunger ?? 0) > 0);

describe('grocery prices', () => {
  it.each(GROCERIES_SOLD)('%s costs about 0.06 Shift per meal', (id) => {
    expect(pricePerMeal(id)).toBeCloseTo(GROCERY_SHIFTS_PER_MEAL, 3);
  });

  it('make groceries the cheapest food: cheaper per meal than anything ready to eat', () => {
    expect(foods.length).toBeGreaterThan(0);
    for (const grocery of GROCERIES_SOLD) {
      for (const food of foods) expect(pricePerMeal(grocery)).toBeLessThan(ITEMS[food].priceInShifts);
    }
  });

  it.each(LANGUAGE_CODES)('stay the cheapest food once rounded to %s price points', (packId) => {
    for (const grocery of GROCERIES_SOLD) {
      for (const food of foods) expect(localPrice(ITEMS[grocery].priceInShifts, packId)).toBeLessThan(localPrice(ITEMS[food].priceInShifts, packId));
    }
  });

  it('go into the inventory to cook, so they fill nothing when bought', () => {
    for (const grocery of GROCERIES_SOLD) expect(ITEMS[grocery].restores).toEqual({});
  });
});

describe('convenience store counter food', () => {
  it('fills Hunger, the bento more than the snack', () => {
    const [snack, bento] = CONVENIENCE_MENU.map((id) => ITEMS[id].restores.hunger ?? 0);
    expect(snack).toBeGreaterThan(0);
    expect(bento).toBeGreaterThan(snack!);
  });

  it('prices the bento at about 0.12 Shift', () => {
    expect(ITEMS.bento.priceInShifts).toBeCloseTo(0.12, 3);
  });
});

describe('Comfort Purchases', () => {
  it('cover café cake or a special drink, a book or magazine, a restaurant meal, and flowers or a gift', () => {
    expect(COMFORT_PURCHASES).toEqual(
      expect.arrayContaining(['cake', 'special-drink', 'mystery-novel', 'magazine', ...RESTAURANT_DISHES, 'flowers', 'chocolates']),
    );
  });

  it.each(LANGUAGE_CODES)('make a restaurant meal, a dish and a drink, about 0.25 Shift once rounded to %s price points', (packId) => {
    for (const dish of RESTAURANT_DISHES) {
      for (const drink of RESTAURANT_DRINKS) expect(menuPrice(dish, packId) + menuPrice(drink, packId)).toBeCloseTo(0.25, 1);
      expect(ITEMS[dish].comfort).toBe('meal');
    }
    for (const drink of RESTAURANT_DRINKS) expect(ITEMS[drink].comfort).toBeUndefined();
  });

  it.each(COMFORT_PURCHASES)('%s costs 0.1–0.3 Shift', (id) => {
    expect(ITEMS[id].priceInShifts).toBeGreaterThanOrEqual(ECONOMY.comfortPurchaseInShifts.min);
    expect(ITEMS[id].priceInShifts).toBeLessThanOrEqual(ECONOMY.comfortPurchaseInShifts.max);
  });

  it.each(LANGUAGE_CODES)('still cost 0.1–0.3 Shift once rounded to %s price points', (packId) => {
    const { min, max } = ECONOMY.comfortPurchaseInShifts;
    for (const id of COMFORT_PURCHASES) {
      expect(chargeInShifts(ITEMS[id].priceInShifts, packId)).toBeGreaterThanOrEqual(min);
      expect(chargeInShifts(ITEMS[id].priceInShifts, packId)).toBeLessThanOrEqual(max);
    }
  });

  it('each lift Mood by an amount set in the tuning module', () => {
    for (const id of COMFORT_PURCHASES) expect(MOOD.changes.comfortPurchase[ITEMS[id].comfort!]).toBeGreaterThan(0);
  });

  it('the gifts are kept to give, and nothing else is', () => {
    expect(ITEM_IDS.filter((id) => ITEMS[id].gift)).toEqual([...GIFTS_SOLD]);
  });
});
