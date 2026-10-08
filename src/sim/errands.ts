import type { Refund } from '../content/index.ts';
import { isGoneOff } from './inventory.ts';
import type { GameState } from './state.ts';

/**
 * The supermarket takes back one of an item it sold, still in date, and pays its price back. It refuses one the
 * Character hasn't got, and one that has gone off.
 */
export function refundItem(state: GameState, { item, amountInShifts }: Refund): { kind: 'refunded'; state: GameState } | { kind: 'not_held' } | { kind: 'gone_off' } {
  const { inventory } = state.possessions;
  const held = inventory.filter(({ itemId }) => itemId === item.itemId);
  if (held.length === 0) return { kind: 'not_held' };
  const returned = held.find((stock) => !isGoneOff(stock, state.clock.day));
  if (!returned) return { kind: 'gone_off' };
  const kept = inventory.flatMap((stock) => (stock !== returned ? [stock] : stock.quantity > 1 ? [{ ...stock, quantity: stock.quantity - 1 }] : []));
  return {
    kind: 'refunded',
    state: {
      ...state,
      possessions: { ...state.possessions, inventory: kept },
      character: { ...state.character, moneyInShifts: state.character.moneyInShifts + amountInShifts },
    },
  };
}

/** The town office has registered the Character's address: recorded in the save, as flavour only. */
export function registerAddress(state: GameState): GameState {
  return { ...state, possessions: { ...state.possessions, addressRegistered: true } };
}
