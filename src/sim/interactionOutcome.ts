import type { Interaction, JobApplication, OrderLine, ServedItem } from '../content/index.ts';
import { hire, namesMatch } from './jobs.ts';
import type { GameState, JobId } from './state.ts';

/**
 * How a Goal Interaction ended, as the store saw it. `args` are the NPC's
 * completion arguments, unchecked.
 */
export type InteractionOutcome = { kind: 'success'; args: unknown } | { kind: 'failure' } | { kind: 'abandon' };

/**
 * What happened. `served` is what the Character was handed, and `hired` the Job
 * the Character got. `cannot_afford`, `invalid_arguments` and `wrong_name` (the NPC
 * misheard the Character's name) change nothing: the NPC is told, and the
 * conversation goes on.
 */
export type OutcomeResult =
  | {
      kind: 'success';
      served: ServedItem[];
      paidInShifts: number;
      hired?: JobId;
    }
  | { kind: 'failure' }
  | { kind: 'abandon' }
  | { kind: 'cannot_afford' }
  | { kind: 'invalid_arguments'; error: string }
  | { kind: 'wrong_name' };

function orderTotals(lines: OrderLine[]) {
  let costInShifts = 0;
  for (const { quantity, priceInShifts } of lines) {
    costInShifts += priceInShifts * quantity;
  }
  return { costInShifts };
}

/** A hiring completion: the Job, if the name the NPC heard is the Character's. */
function applyJobApplication(state: GameState, { jobId, name }: JobApplication): { state: GameState; result: OutcomeResult } {
  if (!namesMatch(name, state.identity.characterName)) return { state, result: { kind: 'wrong_name' } };
  return { state: hire(state, jobId), result: { kind: 'success', served: [], paidInShifts: 0, hired: jobId } };
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
      if (completion.application) return applyJobApplication(state, completion.application);
      const { costInShifts } = orderTotals(completion.lines);
      const { character } = state;
      if (costInShifts > character.moneyInShifts) return { state, result: { kind: 'cannot_afford' } };
      const paid: GameState = { ...state, character: { ...character, moneyInShifts: character.moneyInShifts - costInShifts } };
      const served = completion.lines.map(({ itemId, name, glosses, quantity }) => ({ itemId, name, glosses, quantity }));
      return { state: paid, result: { kind: 'success', served, paidInShifts: costInShifts } };
    }
  }
}
