import type { Interaction, JobApplication, OrderLine, Refund, RentChange, ServedItem, Shipment, TramStopId, Treatment } from '../content/index.ts';
import type { Basket } from './basket.ts';
import { checkIn, diagnose, dispense, settleHospitalBill } from './clinic.ts';
import { refundItem, registerAddress } from './errands.ts';
import { stockInventory } from './inventory.ts';
import { hire, namesMatch } from './jobs.ts';
import { goalInteractionFamiliarity } from './familiarity.ts';
import { completeFirstMorningStep } from './firstMorning.ts';
import { membershipBoughtUntil } from './gym.ts';
import { clampMeter } from './meters.ts';
import { metNpc, namedNpcOf } from './npcMemory.ts';
import { recordOrder } from './regulars.ts';
import { grantExtension, payRent } from './rent.ts';
import { billTotal, restaurantDebt } from './restaurant.ts';
import type { GameState, JobId, RestaurantTable } from './state.ts';
import { ILLNESS, MOOD } from './tuning.ts';

/**
 * How a Goal Interaction ended, as the store saw it. `args` are the NPC's
 * completion arguments, unchecked; `basket` is what the Character brought to the till.
 */
export type InteractionOutcome = { kind: 'success'; args: unknown; basket?: Basket } | { kind: 'failure' } | { kind: 'abandon' };

/**
 * What happened. `served` is what the Character was handed: eaten on the spot,
 * or for a purchase, put in the inventory. `pointedTo` is the item an NPC showed
 * the way to, `extendedDays` the more time the landlord gave, and `hired` the Job
 * the Character got. `refundedInShifts` is money paid back for an item returned, `registered` that the Character's
 * address now is, and `directedTo` the tram stop a passer-by said to get off at. `moodChange` is the change that
 * actually happened, after
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
      refundedInShifts?: number;
      registered?: true;
      directedTo?: TramStopId;
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

/** The chance of food poisoning after eating these lines on top of what was already risked: each cheap food eaten adds to it. */
function afterEating(foodPoisoningChance: number, eaten: OrderLine[]): number {
  const cheapEaten = eaten.reduce((count, { cheap, quantity }) => count + (cheap ? quantity : 0), 0);
  return 1 - (1 - foodPoisoningChance) * (1 - ILLNESS.cheapFoodPoisoningChance) ** cheapEaten;
}

/** What the Comfort Purchases among these lines lift Mood by: each kind once, however many are bought. */
function comfortMood(lines: OrderLine[]): number {
  const kinds = new Set(lines.flatMap(({ comfort }) => (comfort ? [comfort] : [])));
  return [...kinds].reduce((lift, kind) => lift + MOOD.changes.comfortPurchase[kind], 0);
}

/** A success that serves nothing: the Character seated, a bill paid, an address `registered`, or a tram stop named (`directedTo`). */
function succeeded(state: GameState, paidInShifts = 0, more: { directedTo?: TramStopId; registered?: true } = {}): { state: GameState; result: OutcomeResult } {
  const lifted = changeMood(state, MOOD.changes.goalInteractionSuccess);
  return { state: lifted.state, result: { kind: 'success', served: [], paidInShifts, moodChange: lifted.moodChange, ...more } };
}

/** The bill with these lines added to it, a line per item. */
function addToBill(bill: RestaurantTable['bill'], lines: OrderLine[]): RestaurantTable['bill'] {
  const added = bill.map((line) => ({ ...line }));
  for (const { itemId, quantity, priceInShifts } of lines) {
    const line = added.find((l) => l.itemId === itemId);
    if (line) line.quantity += quantity;
    else added.push({ itemId, quantity, priceInShifts });
  }
  return added;
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

/** The supermarket takes an item back: paid back, if the Character has it and it hasn't gone off. */
function applyRefund(state: GameState, refund: Refund): { state: GameState; result: OutcomeResult } {
  const refunded = refundItem(state, refund);
  const { name } = refund.item;
  if (refunded.kind === 'not_held') return { state, result: { kind: 'invalid_arguments', error: `The customer has no ${name} with them to bring back.` } };
  if (refunded.kind === 'gone_off') {
    return { state, result: { kind: 'invalid_arguments', error: `The ${name} the customer brought back is past its date, so it can't be refunded.` } };
  }
  const lifted = changeMood(refunded.state, MOOD.changes.goalInteractionSuccess);
  const result: OutcomeResult = { kind: 'success', served: [], paidInShifts: 0, moodChange: lifted.moodChange, refundedInShifts: refund.amountInShifts };
  return { state: lifted.state, result };
}

/** The town office registers the Character's address, once, if the name on the form is theirs. */
function applyRegistration(state: GameState, { name }: { name: string }): { state: GameState; result: OutcomeResult } {
  if (!namesMatch(name, state.identity.characterName)) return { state, result: { kind: 'wrong_name' } };
  if (state.possessions.addressRegistered) return { state, result: { kind: 'invalid_arguments', error: 'This resident has already registered their address.' } };
  return succeeded(registerAddress(state), 0, { registered: true });
}

/** The post office sends a parcel home: paid for, it lifts Mood more than a plain success. */
function applyShipment(state: GameState, { postageInShifts }: Shipment): { state: GameState; result: OutcomeResult } {
  if (postageInShifts > state.character.moneyInShifts) return { state, result: { kind: 'cannot_afford' } };
  const paid: GameState = { ...state, character: { ...state.character, moneyInShifts: state.character.moneyInShifts - postageInShifts } };
  const lifted = changeMood(paid, MOOD.changes.goalInteractionSuccess + MOOD.changes.parcelSent);
  return { state: lifted.state, result: { kind: 'success', served: [], paidInShifts: postageInShifts, moodChange: lifted.moodChange } };
}

/** The pharmacist's completion: the prescribed medicine, paid for and taken on the spot. */
function applyTreatment(state: GameState, treatment: Treatment, lines: OrderLine[]): { state: GameState; result: OutcomeResult } {
  const { costInShifts } = orderTotals(lines);
  const dispensed = dispense(state, treatment, costInShifts);
  if (dispensed.kind === 'cannot_afford') return { state, result: { kind: 'cannot_afford' } };
  if (dispensed.kind === 'not_prescribed') {
    return { state, result: { kind: 'invalid_arguments', error: 'That is not the medicine on the prescription in FACTS.' } };
  }
  const lifted = changeMood(dispensed.state, MOOD.changes.goalInteractionSuccess);
  const served = lines.map(({ itemId, name, glosses, quantity }) => ({ itemId, name, glosses, quantity }));
  return { state: lifted.state, result: { kind: 'success', served, paidInShifts: costInShifts, moodChange: lifted.moodChange } };
}

/**
 * Applies the end of a Goal Interaction. Success validates the completion
 * arguments and checks the Character can afford them (money is never in the
 * prompt), then pays, applies the effect and lifts Mood, more for a Comfort Purchase. Failure dips Mood a
 * little and charges nothing. Abandoning costs nothing. A finished conversation,
 * however it ended, counts as meeting the NPC once more, and a success makes them
 * a little more familiar, and for an order, counts toward the Character's usual. A passer-by remembers nothing.
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
  const npcId = namedNpcOf(interaction);
  if (!finished || !npcId) return applied;
  const met = metNpc(applied.state, npcId);
  if (kind !== 'success' || outcome.kind !== 'success') return { ...applied, state: met };
  return { ...applied, state: recordOrder(goalInteractionFamiliarity(met, npcId), interaction, outcome.args) };
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
      const { effect } = interaction;
      const { restaurant } = state;
      const completion = interaction.resolveCompletion(outcome.args, state.identity.culturePackId, outcome.basket);
      if (!completion.success) return { state, result: { kind: 'invalid_arguments', error: completion.error } };
      if (completion.rent) return applyRentChange(state, completion.rent);
      if (completion.application) return applyJobApplication(state, completion.application);
      if (completion.checkIn) return succeeded(checkIn(state));
      if (completion.diagnosis) {
        const diagnosed = diagnose(state, completion.diagnosis);
        return succeeded(diagnosed, state.character.moneyInShifts - diagnosed.character.moneyInShifts);
      }
      if (completion.treatment) return applyTreatment(state, completion.treatment, completion.lines);
      if (completion.paymentPlanWeeks !== undefined) {
        const settled = settleHospitalBill(state, completion.paymentPlanWeeks);
        if (settled.kind === 'nothing_owed') return { state, result: { kind: 'invalid_arguments', error: 'The patient owes the hospital nothing.' } };
        if (settled.kind === 'cannot_afford') return { state, result: { kind: 'cannot_afford' } };
        return succeeded(settled.state, settled.paidInShifts);
      }
      if (completion.refund) return applyRefund(state, completion.refund);
      if (completion.registration) return applyRegistration(state, completion.registration);
      if (completion.shipment) return applyShipment(state, completion.shipment);
      if (completion.directions) return succeeded(state, 0, { directedTo: completion.directions });
      if (effect.kind === 'seatGuest') return succeeded({ ...state, restaurant: { ...restaurant, seated: true } });
      if (effect.kind === 'orderMeal' && !restaurant.seated) {
        return { state, result: { kind: 'invalid_arguments', error: 'The customer has no table yet: they must be seated before they order.' } };
      }
      const { costInShifts, hunger, thirst } = orderTotals(completion.lines);
      const { character, possessions } = state;
      // The bill is the sim's to know: the server charges whatever is on it, and a meal is only served if it could be paid.
      if (effect.kind === 'settleBill') {
        // The bill, at the prices it was ordered at, and anything owed from a bill walked out on are paid together.
        const dueInShifts = billTotal(restaurant.bill) + restaurantDebt(state);
        if (dueInShifts === 0) return { state, result: { kind: 'invalid_arguments', error: 'The customer has nothing on their bill to pay.' } };
        if (dueInShifts > character.moneyInShifts) return { state, result: { kind: 'cannot_afford' } };
        // Paid up, the Character gets up from the table.
        const settled: GameState = {
          ...state,
          restaurant: { seated: false, bill: [] },
          debts: state.debts.filter((debt) => debt.kind !== 'restaurant'),
          character: { ...character, moneyInShifts: character.moneyInShifts - dueInShifts },
        };
        return succeeded(settled, dueInShifts);
      }
      // A meal at the restaurant goes on the bill rather than being paid now, but is only served if the bill could be paid with it on.
      const billed = effect.kind === 'orderMeal';
      const owedInShifts = billTotal(restaurant.bill);
      if (owedInShifts + costInShifts > character.moneyInShifts) return { state, result: { kind: 'cannot_afford' } };
      const paidInShifts = billed ? 0 : costInShifts;

      // A purchase is taken home, and so is a gift, to give. The rest of an order is eaten, drunk or read on the spot
      // (groceries fill nothing until cooked).
      const kept = effect.kind === 'purchase' ? completion.lines : completion.lines.filter(({ gift }) => gift);
      const inventory = stockInventory(possessions.inventory, kept, state.clock.day);
      const paid: GameState = {
        ...state,
        possessions: {
          ...possessions,
          inventory,
          // Gym membership is paid for once, here: it is never charged again unless the Character renews it.
          ...(effect.kind === 'registerMember' && { gymMembershipUntilDay: membershipBoughtUntil(state) }),
        },
        ...(billed && { restaurant: { ...restaurant, bill: addToBill(restaurant.bill, completion.lines) } }),
        character: {
          ...character,
          moneyInShifts: character.moneyInShifts - paidInShifts,
          hunger: clampMeter(character.hunger + hunger),
          thirst: clampMeter(character.thirst + thirst),
          foodPoisoningChance: effect.kind === 'purchase' ? character.foodPoisoningChance : afterEating(character.foodPoisoningChance, completion.lines),
        },
      };
      const lifted = changeMood(paid, MOOD.changes.goalInteractionSuccess + comfortMood(completion.lines));
      // For the First Morning, food eaten anywhere, or any order at the café, is breakfast, and anything drunk is a drink.
      const morningStep = hunger > 0 || interaction.placeId === 'cafe' ? 'breakfast' : thirst > 0 ? 'drink' : null;
      const served = completion.lines.map(({ itemId, name, glosses, quantity }) => ({ itemId, name, glosses, quantity }));
      return {
        state: morningStep ? completeFirstMorningStep(lifted.state, morningStep) : lifted.state,
        result: {
          kind: 'success',
          served,
          paidInShifts,
          moodChange: lifted.moodChange,
          ...(completion.pointedTo && { pointedTo: completion.pointedTo }),
        },
      };
    }
  }
}
