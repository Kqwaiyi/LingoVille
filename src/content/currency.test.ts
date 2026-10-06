import { describe, expect, it } from 'vitest';
import { ECONOMY, FIRST_MORNING, LANGUAGE_CODES, type LanguageCode } from '../sim/index.ts';
import { CULTURE_PACKS, chargeInShifts, formatLocalAmount, formatLocalMoney, ITEM_IDS, ITEMS, localPrice, priceProblem, tillFor, type Currency } from './index.ts';

/** Intl puts a no-break space before €; the tests write a plain one. */
const written = (shifts: number, packId: LanguageCode) => formatLocalMoney(shifts, packId).replace(/\s/g, ' ');

describe('localPrice', () => {
  it.each([
    ['ja', 0.075, 450],
    ['ja', 0.0625, 380],
    ['ja', ECONOMY.weeklyRentInShifts, 12000],
    ['zh', 0.075, 18],
    ['zh', 0.0625, 15],
    ['zh', ECONOMY.faintingBillInShifts, 360],
    ['de', 0.0625, 3.8],
    ['de', 0.12, 7.2],
    ['en', 0.0625, 3.75],
    ['en', 0.258, 15.5],
  ] as const)('converts a %s price of %s Shifts to the local price point %s', (packId, ratio, amount) => {
    expect(localPrice(ratio, packId)).toBe(amount);
  });
});

describe('chargeInShifts', () => {
  it.each(LANGUAGE_CODES)('charges exactly the price on the %s menu', (packId) => {
    expect(chargeInShifts(0.0625, packId) * CULTURE_PACKS[packId].currency.perShift).toBeCloseTo(localPrice(0.0625, packId), 9);
  });
});

describe('formatLocalMoney', () => {
  it.each([
    ['ja', '¥10,000'],
    ['zh', '400元'],
    ['de', '100 €'],
    ['en', '£100'],
  ] as const)('starts a %s game with %s', (packId, balance) => {
    expect(written(FIRST_MORNING.moneyInShifts, packId)).toBe(balance);
  });

  it.each([
    ['ja', 0.075, '¥450'],
    ['zh', 0.075, '18元'],
    ['zh', 0.05 + 0.5 / 240, '12.5元'],
    ['de', 0.0625, '3,75 €'],
    ['en', 0.0625, '£3.75'],
  ] as const)('writes a %s amount of %s Shifts as %s', (packId, shifts, text) => {
    expect(written(shifts, packId)).toBe(text);
  });
});

describe('the till', () => {
  it.each([
    ['ja', [1, 5, 10, 50, 100, 500, 1000, 5000, 10000]],
    ['zh', [0.1, 0.5, 1, 5, 10, 20, 50, 100]],
    ['en', [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]],
    ['de', [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]],
  ] as const)('holds the %s coins and notes, smallest first', (packId, denominations) => {
    expect(tillFor(packId).denominations).toEqual(denominations);
  });

  it.each(LANGUAGE_CODES)('rings up every item at its %s price, which the smallest coin makes exactly', (packId) => {
    const { prices, denominations } = tillFor(packId);
    const smallest = Math.round(denominations[0]! * 100);
    for (const itemId of ITEM_IDS) {
      expect(prices[itemId]).toBe(localPrice(ITEMS[itemId].priceInShifts, packId));
      expect(Math.round(prices[itemId] * 100) % smallest).toBe(0);
    }
  });

  it.each([
    ['ja', 500, '¥500'],
    ['zh', 0.5, '0.5元'],
    ['de', 0.2, '0,20 €'],
    ['en', 0.05, '£0.05'],
  ] as const)('writes a %s coin of %s as %s', (packId, amount, text) => {
    expect(formatLocalAmount(amount, packId).replace(/\s/g, ' ')).toBe(text);
  });
});

describe('priceProblem', () => {
  const yen: Currency = { code: 'JPY', locale: 'en-JP', perShift: 6000, priceSteps: [{ below: 1000, step: 10 }, { step: 100 }], denominations: [1] };

  it('passes a ratio that rounds to a nearby local price point', () => {
    expect(priceProblem(0.0625, yen)).toBeNull();
  });

  it.each([
    ['rounds to nothing', 0.0005],
    ['is not a number', Number.NaN],
    ['is negative', -0.1],
  ])('fails a ratio that %s', (_, ratio) => {
    expect(priceProblem(ratio, yen)).toMatch(/does not convert/);
  });

  it('fails a ratio the price points move too far', () => {
    const coarse: Currency = { ...yen, priceSteps: [{ step: 1000 }] };
    expect(priceProblem(0.25, coarse)).toMatch(/does not convert/);
  });
});
