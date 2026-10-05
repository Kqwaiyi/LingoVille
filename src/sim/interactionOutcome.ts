import type { Interaction, OrderLine, ServedItem } from '../content/index.ts';
import type { Basket } from './basket.ts';
import { stockInventory } from './inventory.ts';
import { clampMeter } from './meters.ts';
import type { GameState } from './state.ts';
import { MOOD } from './tuning.ts';

/**
 * How a Goal Interaction ended, as the store saw it. `args` are the NPC's
 * completion arguments, unchecked; `basket` is what the Character brought to the till.
 */
export type InteractionOutcome = { kind: 'success'; args: unknown; basket?: Basket } | { kind: 'failure' } | { kind: 'abandon' };

/**
 * What happened. `served` is what the Character was handed: eaten on the spot,
 * or for a purchase, put in the inventory. `pointedTo` is the item an NPC showed
 * the way to. `moodChange` is the change that actually happened, after
 * clamping. `cannot_afford` and `invalid_arguments` change nothing: the NPC is
 * told, and the conversation goes on.
 */
export type OutcomeResult =
  | { kind: 'success'; served: ServedItem[]; paidInShifts: number; moodChange: number; pointedTo?: ServedItem }
  | { kind: 'failure'; moodChange: number }
  | { kind: 'abandon' }
  | { kind: 'cannot_afford' }
  | { kind: 'invalid_arguments'; error: string };

function changeMood(state: GameState, change: number) {
  const mood = clampMeter(state.character.mood + change);
  return { state: { ...state, character: { ...state.character, mood } }, moodChange: mood - state.character.mood };
}

function orderTotals(lines: OrderLine[]) {
  let costInShifts = 0;
  let hunger = 0;
  let thirst = 0;
  for (const { quantity, priceInShifts, restores } of lines) {
    costInShifts += priceInShifts * quantity;
    hunger += (restores.hunger ?? 0) * quantity;
    thirst += (restores.thirst ?? 0) * quantity;
  }
  return { costInShifts, hunger, thirst };
}

/**
 * Applies the end of a Goal Interaction. Success validates the completion
 * arguments and checks the Character can afford them (money is never in the
 * prompt), then pays, applies the effect and lifts Mood. Failure dips Mood a
 * little and charges nothing. Abandoning costs nothing.
 */
export function applyInteractionOutcome(
  state: GameState,
  interaction: Interaction,
  outcome: InteractionOutcome,
): { state: GameState; result: OutcomeResult } {
  switch (outcome.kind) {
    case 'abandon':
      return { state, result: { kind: 'abandon' } };

    case 'failure': {
      const failed = changeMood(state, MOOD.changes.goalInteractionFailure);
      return { state: failed.state, result: { kind: 'failure', moodChange: failed.moodChange } };
    }

    case 'success': {
      const completion = interaction.resolveCompletion(outcome.args, state.identity.culturePackId, outcome.basket);
      if (!completion.success) return { state, result: { kind: 'invalid_arguments', error: completion.error } };
      const { costInShifts, hunger, thirst } = orderTotals(completion.lines);
      const { character, possessions } = state;
      if (costInShifts > character.moneyInShifts) return { state, result: { kind: 'cannot_afford' } };

      // A purchase is taken home; an order is eaten or drunk on the spot (groceries fill nothing until cooked).
      const inventory =
        interaction.effect.kind === 'purchase' ? stockInventory(possessions.inventory, completion.lines, state.clock.day) : possessions.inventory;
      const paid: GameState = {
        ...state,
        possessions: { ...possessions, inventory },
        character: {
          ...character,
          moneyInShifts: character.moneyInShifts - costInShifts,
          hunger: clampMeter(character.hunger + hunger),
          thirst: clampMeter(character.thirst + thirst),
        },
      };
      const succeeded = changeMood(paid, MOOD.changes.goalInteractionSuccess);
      const served = completion.lines.map(({ itemId, name, glosses, quantity }) => ({ itemId, name, glosses, quantity }));
      return {
        state: succeeded.state,
        result: {
          kind: 'success',
          served,
          paidInShifts: costInShifts,
          moodChange: succeeded.moodChange,
          ...(completion.pointedTo && { pointedTo: completion.pointedTo }),
        },
      };
    }
  }
}
