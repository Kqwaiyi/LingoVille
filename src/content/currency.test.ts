import { describe, expect, it } from 'vitest';
import { PACK_CURRENCIES, toLocalMoney } from './index.ts';

describe('toLocalMoney', () => {
  it.each(Object.entries(PACK_CURRENCIES))('converts Shifts into the %s pack currency', (packId, { currency, perShift }) => {
    expect(toLocalMoney(2, packId as keyof typeof PACK_CURRENCIES)).toEqual({ currency, amount: 2 * perShift });
  });
});
