import { ECONOMY, type LanguageCode } from '../sim/index.ts';
import { CULTURE_PACKS, type Currency } from './culturePacks.ts';
import { ITEMS, type ItemId } from './items.ts';

// Prices are authored as ratios of one Shift's base pay. Each pack converts
// them by its anchor and rounds them to local price points, so ¥380, 15元,
// 3,80 € and £3.75 all come from the same 0.0625.

/** A local amount, rid of floating-point dust (4.499999… → 4.5). */
const tidy = (amount: number) => Math.round(amount * 100) / 100;

function rounded(ratio: number, { perShift, priceSteps }: Currency) {
  const exact = ratio * perShift;
  const { step } = priceSteps.find(({ below }) => below === undefined || exact < below)!;
  return { exact, amount: tidy(Math.round(exact / step) * step) };
}

/** A price authored as `ratio` Shifts, in the pack's money at a local price point. */
export function localPrice(ratio: number, packId: LanguageCode): number {
  return rounded(ratio, CULTURE_PACKS[packId].currency).amount;
}

/** What a price authored as `ratio` Shifts actually costs, in Shifts: the local price on the menu, converted back. */
export function chargeInShifts(ratio: number, packId: LanguageCode): number {
  return localPrice(ratio, packId) / CULTURE_PACKS[packId].currency.perShift;
}

/** What an item costs on this pack's menu: its catalogue price at the local price point, in Shifts. */
export function menuPrice(itemId: ItemId, packId: LanguageCode): number {
  return chargeInShifts(ITEMS[itemId].priceInShifts, packId);
}

/** Why a price ratio doesn't convert in this currency, or null if it does. */
export function priceProblem(ratio: number, currency: Currency): string | null {
  const { exact, amount } = rounded(ratio, currency);
  const ok = Number.isFinite(amount) && amount > 0 && Math.abs(amount - exact) <= exact * ECONOMY.pricePointTolerance;
  return ok ? null : `${ratio} Shifts does not convert to a ${currency.code} price point (${exact} → ${amount}).`;
}

/** An amount of money held in Shifts, written as the pack writes it: ¥450, 18元, 4,50 € or £4.50. */
export function formatLocalMoney(shifts: number, packId: LanguageCode): string {
  const { code, locale, suffix, perShift } = CULTURE_PACKS[packId].currency;
  const amount = shifts * perShift;
  if (suffix) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)}${suffix}`;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code, trailingZeroDisplay: 'stripIfInteger' }).format(amount);
}
