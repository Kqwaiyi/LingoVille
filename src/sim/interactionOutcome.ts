import type { Interaction, OrderLine, ServedItem } from '../content/index.ts';
import type { GameState } from './state.ts';

/**
 * How a Goal Interaction ended, as the store saw it. `args` are the NPC's
 * completion arguments, unchecked.
 */
export type InteractionOutcome = { kind: 'success'; args: unknown } | { kind: 'failure' } | { kind: 'abandon' };

/**
 * What happened. `served` is what the Character was handed. `cannot_afford` and
 * `invalid_arguments` change nothing: the NPC is told, and the conversation goes on.
 */
export type OutcomeResult =
  | {
      kind: 'success';
      served: ServedItem[];
      paidInShifts: number;
    }
  | { kind: 'failure' }
  | { kind: 'abandon' }
  | { kind: 'cannot_afford' }
  | { kind: 'invalid_arguments'; error: string };

function orderTotals(lines: OrderLine[]) {
  let costInShifts = 0;
  for (const { quantity, priceInShifts } of lines) {
    costInShifts += priceInShifts * quantity;
  }
  return { costInShifts };
}

/**
 * Applies the end of a Goal Interaction. Success validates the completion
 * arguments and checks the Character can afford them (money is never in the
 * prompt), then pays and applies the effect. Failure charges nothing. Abandoning costs nothing.
 */
export function applyInteractionOutcome(
  state: GameState,
  interaction: Interaction,
  outcome: InteractionOutcome,
): { state: GameState; result: OutcomeResult } {
  switch (outcome.kind) {
    case 'abandon':
      return { state, result: { kind: 'abandon' } };

    case 'failure':
      return { state, result: { kind: 'failure' } };

    case 'success': {
      const completion = interaction.resolveCompletion(outcome.args, state.identity.culturePackId);
      if (!completion.success) return { state, result: { kind: 'invalid_arguments', error: completion.error } };
      const { costInShifts } = orderTotals(completion.lines);
      const { character } = state;
      if (costInShifts > character.moneyInShifts) return { state, result: { kind: 'cannot_afford' } };
      const paid: GameState = { ...state, character: { ...character, moneyInShifts: character.moneyInShifts - costInShifts } };
      const served = completion.lines.map(({ itemId, name, glosses, quantity }) => ({ itemId, name, glosses, quantity }));
      return { state: paid, result: { kind: 'success', served, paidInShifts: costInShifts } };
    }
  }
}
