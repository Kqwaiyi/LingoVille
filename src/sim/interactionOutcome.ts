import type { Interaction, JobApplication, OrderLine, RentChange, ServedItem } from '../content/index.ts';
import type { Basket } from './basket.ts';
import { stockInventory } from './inventory.ts';
import { hire, namesMatch } from './jobs.ts';
import { clampMeter } from './meters.ts';
import { metNpc } from './npcMemory.ts';
import { grantExtension, payRent } from './rent.ts';
import type { GameState, JobId } from './state.ts';
import { MOOD } from './tuning.ts';

/**
 * How a Goal Interaction ended, as the store saw it. `args` are the NPC's
 * completion arguments, unchecked; `basket` is what the Character brought to the till.
 */
export type InteractionOutcome = { kind: 'success'; args: unknown; basket?: Basket } | { kind: 'failure' } | { kind: 'abandon' };

/**
 * What happened. `served` is what the Character was handed: eaten on the spot,
 * or for a purchase, put in the inventory. `pointedTo` is the item an NPC showed
 * the way to, `extendedDays` the more time the landlord gave, and `hired` the Job
 * the Character got. `moodChange` is the change that actually happened, after
 * clamping. `cannot_afford`, `invalid_arguments` and `wrong_name` (the NPC
 * misheard the Character's name) change nothing: the NPC is told, and the
 * conversation goes on.
 */
export type OutcomeResult =
  | {
      kind: 'success';
      served: ServedItem[];
      paidInShifts: number;
      moodChange: number;
      pointedTo?: ServedItem;
      extendedDays?: number;
      hired?: JobId;
    }
  | { kind: 'failure'; moodChange: number }
  | { kind: 'abandon' }
  | { kind: 'cannot_afford' }
  | { kind: 'invalid_arguments'; error: string }
  | { kind: 'wrong_name' };

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

/** The landlord's completion: rent paid, checked against what is owed and what the Character has, or more time given. */
function applyRentChange(state: GameState, change: RentChange): { state: GameState; result: OutcomeResult } {
  if (change.kind === 'extend') {
    const extended = changeMood(grantExtension(state, change.days), MOOD.changes.goalInteractionSuccess);
    const result: OutcomeResult = { kind: 'success', served: [], paidInShifts: 0, moodChange: extended.moodChange, extendedDays: change.days };
    return { state: extended.state, result };
  }
  const payment = payRent(state, change.amountInShifts);
  if (payment.kind === 'cannot_afford') return { state, result: { kind: 'cannot_afford' } };
  if (payment.kind === 'wrong_amount') return { state, result: { kind: 'invalid_arguments', error: 'That is more than the tenant owes.' } };
  const paid = changeMood(payment.state, MOOD.changes.goalInteractionSuccess);
  const paidInShifts = state.character.moneyInShifts - payment.state.character.moneyInShifts;
  return { state: paid.state, result: { kind: 'success', served: [], paidInShifts, moodChange: paid.moodChange } };
}

/** A hiring completion: the Job, if the name the NPC heard is the Character's. */
function applyJobApplication(state: GameState, { jobId, name }: JobApplication): { state: GameState; result: OutcomeResult } {
  if (!namesMatch(name, state.identity.characterName)) return { state, result: { kind: 'wrong_name' } };
  const hired = changeMood(hire(state, jobId), MOOD.changes.goalInteractionSuccess);
  return { state: hired.state, result: { kind: 'success', served: [], paidInShifts: 0, moodChange: hired.moodChange, hired: jobId } };
}

/**
 * Applies the end of a Goal Interaction. Success validates the completion
 * arguments and checks the Character can afford them (money is never in the
 * prompt), then pays, applies the effect and lifts Mood. Failure dips Mood a
 * little and charges nothing. Abandoning costs nothing. A finished conversation,
 * however it ended, counts as meeting the NPC once more.
 */
export function applyInteractionOutcome(
  state: GameState,
  interaction: Interaction,
  outcome: InteractionOutcome,
): { state: GameState; result: OutcomeResult } {
  const applied = applyOutcome(state, interaction, outcome);
  // Success, failure and abandon finish the conversation; anything else lets it go on.
  const { kind } = applied.result;
  const finished = kind === 'success' || kind === 'failure' || kind === 'abandon';
  return finished ? { ...applied, state: metNpc(applied.state, interaction.npcId) } : applied;
}

function applyOutcome(state: GameState, interaction: Interaction, outcome: InteractionOutcome): { state: GameState; result: OutcomeResult } {
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
      if (completion.rent) return applyRentChange(state, completion.rent);
      if (completion.application) return applyJobApplication(state, completion.application);
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
