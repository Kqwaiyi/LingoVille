import type { Debt } from './state.ts';

/** Adds to what is owed: one debt per kind, so a new amount joins the debt of its kind already carried forward. */
export function addDebt(debts: Debt[], { kind, amountInShifts }: Debt): Debt[] {
  if (!debts.some((debt) => debt.kind === kind)) return [...debts, { kind, amountInShifts }];
  return debts.map((debt) => (debt.kind === kind ? { kind, amountInShifts: debt.amountInShifts + amountInShifts } : debt));
}
