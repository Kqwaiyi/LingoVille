import type { LanguageCode } from '../sim/index.ts';

// Each Culture Pack's currency and what one Shift's base pay is worth in it.
// The full Culture Packs (ticket 11) take this over and add rounding to local
// price points.
export const PACK_CURRENCIES: Record<LanguageCode, { currency: string; perShift: number }> = {
  ja: { currency: 'JPY', perShift: 6000 },
  zh: { currency: 'CNY', perShift: 240 },
  de: { currency: 'EUR', perShift: 60 },
  en: { currency: 'GBP', perShift: 60 },
};

/** Converts an amount in Shifts to the pack's currency (ISO 4217 code and amount). */
export function toLocalMoney(shifts: number, packId: LanguageCode): { currency: string; amount: number } {
  const { currency, perShift } = PACK_CURRENCIES[packId];
  return { currency, amount: shifts * perShift };
}

/** The amount in the pack's currency for the UI, e.g. "¥450" or "£4.50". */
export function formatLocalMoney(shifts: number, packId: LanguageCode): string {
  const { currency, amount } = toLocalMoney(shifts, packId);
  return new Intl.NumberFormat('en', { style: 'currency', currency, trailingZeroDisplay: 'stripIfInteger' }).format(amount);
}
